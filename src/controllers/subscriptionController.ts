import SubscriptionModel from "../models/subscription";
import * as express from "express";
import UserModel from "../models/user";
import stripe from "../config/stripe";
import { logger } from "../utils/logger";

// Créer un abonnement
const createSubscription = async (req: express.Request, res: express.Response) => {
  try {
    const { paymentMethodId, subscriptionId, userId } = req.body;

    logger.info({
      msg: "subscription.create.start",
      route: req.originalUrl,
      method: req.method,
      userId,
      subscriptionId,
      hasPaymentMethodId: Boolean(paymentMethodId),
    });

    // Vérifie que l'abonnement demandé existe dans Mongo
    const subscriptionPlan: any = await SubscriptionModel.findById(subscriptionId);
    if (!subscriptionPlan) {
      logger.warn({
        msg: "subscription.create.plan_not_found",
        subscriptionId,
      });
      return res.status(404).json({ message: "Abonnement introuvable." });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      logger.warn({
        msg: "subscription.create.user_not_found",
        userId,
      });
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // Crée un customer Stripe si inexistant
    if (!user.customerId) {
      logger.info({
        msg: "subscription.create.create_customer.start",
        userId,
        email: user.email,
      });

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
        metadata: { mongoUserId: user._id.toString() },
      });

      user.customerId = customer.id;
      await user.save();

      logger.info({
        msg: "subscription.create.create_customer.success",
        userId,
        customerId: customer.id,
      });
    } else {
      logger.info({
        msg: "subscription.create.customer_exists",
        userId,
        customerId: user.customerId,
      });
    }

    // Attache la carte au client
    logger.info({
      msg: "subscription.create.attach_pm.start",
      customerId: user.customerId,
      hasPaymentMethodId: Boolean(paymentMethodId),
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.customerId,
    });

    // Déclare comme méthode par défaut
    await stripe.customers.update(user.customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    logger.info({
      msg: "subscription.create.attach_pm.success",
      customerId: user.customerId,
    });

    // Crée l’abonnement Stripe
    logger.info({
      msg: "subscription.create.stripe_subscription.start",
      customerId: user.customerId,
      stripePriceId: subscriptionPlan.stripePriceId,
      planType: subscriptionPlan.type,
    });

    const subscription = await stripe.subscriptions.create({
      customer: user.customerId,
      items: [{ price: subscriptionPlan.stripePriceId }],
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    logger.info({
      msg: "subscription.create.stripe_subscription.success",
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    });

    // Met à jour l'utilisateur avec infos d'abonnement
    user.abonnement = subscriptionPlan.type;
    user.abonnement_end = new Date(subscription.current_period_end * 1000);
    await user.save();

    logger.info({
      msg: "subscription.create.success",
      userId,
      abonnement: user.abonnement,
      abonnement_end: user.abonnement_end?.toISOString(),
      stripeSubscriptionId: subscription.id,
    });

    return res.status(201).json({
      message: "Abonnement créé avec succès.",
      subscription,
    });
  } catch (error: any) {
    console.error(error);
    logger.error({
      msg: "subscription.create.error",
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res
      .status(500)
      .json({ message: "Erreur lors de la création d'abonnement", error });
  }
};

// Récupérer tous les abonnements (avec filtre pays si fourni)
const getAllSubscriptions = async (req: express.Request, res: express.Response) => {
  try {
    const { country } = req.query;
    logger.info({
      msg: "subscription.list.start",
      route: req.originalUrl,
      method: req.method,
      country: country || null,
    });

    const query = country ? { country } : {};
    const subscriptions = await SubscriptionModel.find(query).sort({ order: 1 });

    logger.info({
      msg: "subscription.list.success",
      count: subscriptions.length,
    });

    res.json(subscriptions);
  } catch (error: any) {
    logger.error({
      msg: "subscription.list.error",
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
    });
    res.status(500).json({ message: "Impossible de récupérer les abonnements", error });
  }
};

// Récupérer un abonnement par ID
const getSubscriptionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({
      msg: "subscription.get_by_id.start",
      id,
      route: req.originalUrl,
      method: req.method,
    });

    const subscription = await SubscriptionModel.findById(id);
    if (subscription) {
      logger.info({
        msg: "subscription.get_by_id.success",
        id,
      });
      res.json(subscription);
    } else {
      logger.warn({
        msg: "subscription.get_by_id.not_found",
        id,
      });
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "subscription.get_by_id.error",
      id: req.params?.id,
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
    });
    res.status(500).json({ message: "Impossible de récupérer l'abonnement", error });
  }
};

// Mettre à jour un abonnement
const updateSubscriptionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({
      msg: "subscription.update.start",
      id,
      route: req.originalUrl,
      method: req.method,
    });

    const updatedSubscription = await SubscriptionModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedSubscription) {
      logger.info({
        msg: "subscription.update.success",
        id,
      });
      res.json(updatedSubscription);
    } else {
      logger.warn({
        msg: "subscription.update.not_found",
        id,
      });
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "subscription.update.error",
      id: req.params?.id,
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
    });
    res.status(500).json({ message: "Impossible de mettre à jour l'abonnement", error });
  }
};

// Supprimer un abonnement
const deleteSubscriptionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({
      msg: "subscription.delete.start",
      id,
      route: req.originalUrl,
      method: req.method,
    });

    const deletedSubscription = await SubscriptionModel.findByIdAndDelete(id);
    if (deletedSubscription) {
      logger.info({
        msg: "subscription.delete.success",
        id,
      });
      res.json({ message: "Abonnement supprimé avec succès" });
    } else {
      logger.warn({
        msg: "subscription.delete.not_found",
        id,
      });
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "subscription.delete.error",
      id: req.params?.id,
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
    });
    res.status(500).json({ message: "Impossible de supprimer l'abonnement", error });
  }
};

module.exports = {
  createSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscriptionById,
  deleteSubscriptionById,
};
