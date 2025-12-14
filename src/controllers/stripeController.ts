// controllers/stripeController.ts
import * as express from "express";
import Stripe from "stripe";
import UserModel from "../models/user";
import * as dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

/**
 * Traite un remboursement en utilisant l'API Stripe.
 * Le corps de la requête doit contenir paymentIntentId et peut contenir amount.
 */
export const refundPayment = async (req: express.Request, res: express.Response) => {
  const { paymentIntentId, amount } = req.body;
  logger.info({
    msg: "stripe.refund.start",
    route: req.originalUrl,
    method: req.method,
    paymentIntentId,
    hasAmount: typeof amount === "number",
  });

  if (!paymentIntentId) {
    logger.warn({ msg: "stripe.refund.validation_failed", reason: "paymentIntentId missing" });
    return res.status(400).json({ error: "paymentIntentId est requis" });
  }
  try {
    const refundPayload: any = { payment_intent: paymentIntentId };
    if (amount) refundPayload.amount = amount;

    const refund = await stripe.refunds.create(refundPayload);

    logger.info({ msg: "stripe.refund.success", refundId: refund.id, status: refund.status });
    res.status(200).json(refund);
  } catch (error: any) {
    logger.error({
      msg: "stripe.refund.error",
      errorMessage: error?.message,
      code: error?.code,
      type: error?.type,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ error: error.message });
  }
};

/**
 * Crée une méthode de paiement à partir des détails de la carte.
 */
export const createPaymentMethodFromDetails = async (req: express.Request, res: express.Response) => {
  const { paymentMethodId } = req.body;
  logger.info({
    msg: "stripe.payment_method.retrieve.start",
    route: req.originalUrl,
    method: req.method,
    paymentMethodId,
  });

  if (!paymentMethodId) {
    logger.warn({ msg: "stripe.payment_method.retrieve.validation_failed", reason: "paymentMethodId missing" });
    return res.status(400).json({ error: "paymentMethodId est requis" });
  }
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    logger.info({ msg: "stripe.payment_method.retrieve.success", paymentMethodId: paymentMethod.id, type: paymentMethod.type });
    res.status(201).json({ paymentMethodId: paymentMethod.id });
  } catch (error: any) {
    logger.error({
      msg: "stripe.payment_method.retrieve.error",
      errorMessage: error?.message,
      code: error?.code,
      type: error?.type,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ error: error.message });
  }
};

/**
 * Enregistre une nouvelle carte pour un utilisateur.
 */
export const saveCard = async (req: express.Request, res: express.Response) => {
  const { paymentMethodId, userId } = req.body;
  logger.info({
    msg: "stripe.customer.create_with_pm.start",
    route: req.originalUrl,
    method: req.method,
    userId,
    hasPaymentMethodId: !!paymentMethodId,
  });

  if (!paymentMethodId || !userId) {
    logger.warn({ msg: "stripe.customer.create_with_pm.validation_failed", reason: "paymentMethodId or userId missing" });
    return res.status(400).json({ error: "paymentMethodId et userId sont requis" });
  }
  try {
    const customer = await stripe.customers.create({ payment_method: paymentMethodId });

    const user = await UserModel.findById(userId);
    if (!user) {
      logger.warn({ msg: "stripe.customer.create_with_pm.user_not_found", userId });
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    user.customerId = customer.id;
    await user.save();

    logger.info({ msg: "stripe.customer.create_with_pm.success", userId, customerId: customer.id });
    res.status(201).json({ customerId: customer.id });
  } catch (error: any) {
    logger.error({
      msg: "stripe.customer.create_with_pm.error",
      errorMessage: error?.message,
      code: error?.code,
      type: error?.type,
      route: req.originalUrl,
      method: req.method,
      userId,
    });
    res.status(500).json({ error: error.message });
  }
};

/**
 * Définit une carte comme méthode de paiement principale.
 */
export const setPrimaryCard = async (req: express.Request, res: express.Response) => {
  const { cardId, customerId } = req.body;

  logger.info({
    msg: "stripe.primary_card.set.start",
    route: req.originalUrl,
    method: req.method,
    cardId,
    customerId,
  });

  if (!cardId || !customerId) {
    logger.warn({ msg: "stripe.primary_card.set.validation_failed", reason: "cardId or customerId missing" });
    return res.status(400).json({ error: "cardId et customerId sont requis" });
  }

  try {
    await stripe.paymentMethods.attach(cardId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: cardId },
    });

    logger.info({ msg: "stripe.primary_card.set.success", customerId, cardId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error({
      msg: "stripe.primary_card.set.error",
      errorMessage: error?.message,
      code: error?.code,
      type: error?.type,
      route: req.originalUrl,
      method: req.method,
      customerId,
      cardId,
      stack: error?.stack,
    });
    res.status(500).json({ error: error.message });
  } finally {
    logger.info({ msg: "stripe.primary_card.set.end" });
  }
};

/**
 * Récupère toutes les cartes associées à un client.
 */
export const getCards = async (req: express.Request, res: express.Response) => {
  const { customerId } = req.query;
  logger.info({
    msg: "stripe.cards.list.start",
    route: req.originalUrl,
    method: req.method,
    customerId,
  });

  if (!customerId) {
    logger.warn({ msg: "stripe.cards.list.validation_failed", reason: "customerId missing" });
    return res.status(400).json({ error: "customerId est requis" });
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId as string,
      type: "card",
    });
    const customer = await stripe.customers.retrieve(customerId as string);

    if ((customer as any).deleted) {
      logger.warn({ msg: "stripe.cards.list.customer_deleted", customerId });
      return res.status(404).json({ error: "Le client est supprimé." });
    }

    const defaultPaymentMethod = (customer as any).invoice_settings?.default_payment_method;

    const cards = paymentMethods.data.map((pm: any) => ({
      id: pm.id,
      last4: pm.card.last4,
      brand: pm.card.brand,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      isDefault: pm.id === defaultPaymentMethod,
    }));

    logger.info({ msg: "stripe.cards.list.success", customerId, count: cards.length });
    res.status(200).json({ cards });
  } catch (error: any) {
    logger.error({
      msg: "stripe.cards.list.error",
      errorMessage: error?.message,
      code: error?.code,
      type: error?.type,
      route: req.originalUrl,
      method: req.method,
      customerId,
    });
    res.status(500).json({ error: error.message });
  }
};

export const createPaymentIntent = async (req: express.Request, res: express.Response) => {
  const { amount, currency, customerId } = req.body;
  logger.info({
    msg: "stripe.payment_intent.create.start",
    route: req.originalUrl,
    method: req.method,
    amount,
    currency,
    customerId,
  });

  if (!amount || !currency || !customerId) {
    logger.warn({ msg: "stripe.payment_intent.create.validation_failed", reason: "missing fields" });
    return res.status(400).json({ error: "amount, currency et customerId sont requis" });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
    });
    logger.info({
      msg: "stripe.payment_intent.create.success",
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      hasClientSecret: !!paymentIntent.client_secret,
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    logger.error({
      msg: "stripe.payment_intent.create.error",
      errorMessage: error?.message,
      code: error?.code,
      type: error?.type,
      route: req.originalUrl,
      method: req.method,
      customerId,
    });
    res.status(500).json({ error: error.message });
  }
};
