// controllers/stripeController.ts
import * as express from "express";
import Stripe from "stripe";
import UserModel from "../models/user";
import * as dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia", // Version de l'API Stripe
});

/**
 * Traite un remboursement en utilisant l'API Stripe.
 * Le corps de la requête doit contenir paymentIntentId et peut contenir amount.
 */
export const refundPayment = async (req: express.Request, res: express.Response) => {
  const { paymentIntentId, amount } = req.body;
  if (!paymentIntentId) {
    return res.status(400).json({ error: "paymentIntentId est requis" });
  }
  try {
    // Préparer le payload pour le remboursement
    const refundPayload: any = {
      payment_intent: paymentIntentId,
    };
    // Si un montant est fourni, l'ajouter au payload
    if (amount) {
      refundPayload.amount = amount;
    }
    // Créez un remboursement pour le payment intent spécifié
    const refund = await stripe.refunds.create(refundPayload);
    res.status(200).json(refund);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Crée une méthode de paiement à partir des détails de la carte.
 */
export const createPaymentMethodFromDetails = async (
  req: express.Request,
  res: express.Response
) => {
  const { paymentMethodId } = req.body;
  if (!paymentMethodId) {
    return res.status(400).json({ error: "paymentMethodId est requis" });
  }
  try {
    // Récupérez les détails de la méthode de paiement pour validation
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    res.status(201).json({ paymentMethodId: paymentMethod.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Enregistre une nouvelle carte pour un utilisateur.
 */
export const saveCard = async (
  req: express.Request,
  res: express.Response
) => {
  const { paymentMethodId, userId } = req.body; // Ajoutez userId dans la requête
  if (!paymentMethodId || !userId) {
    return res.status(400).json({ error: "paymentMethodId et userId sont requis" });
  }
  try {
    // Créez un client Stripe et attachez la méthode de paiement
    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
    });

    // Récupérez l'utilisateur depuis la base de données
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    // Mettez à jour le champ customerId de l'utilisateur
    user.customerId = customer.id;
    await user.save();

    res.status(201).json({ customerId: customer.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Définit une carte comme méthode de paiement principale.
 */
export const setPrimaryCard = async (
  req: express.Request,
  res: express.Response
) => {
  const { cardId, customerId } = req.body;

  console.log("Début de la fonction setPrimaryCard");
  console.log("cardId:", cardId);
  console.log("customerId:", customerId);

  if (!cardId || !customerId) {
    console.error("Erreur : cardId et customerId sont requis");
    return res.status(400).json({ error: "cardId et customerId sont requis" });
  }

  try {
    console.log("Tentative d'attachement du payment_method au client...");
    // Attachez la méthode de paiement au client
    await stripe.paymentMethods.attach(cardId, {
      customer: customerId,
    });
    console.log("Payment_method attaché avec succès");

    console.log("Tentative de mise à jour du moyen de paiement par défaut...");
    // Définissez la méthode de paiement comme principale
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: cardId },
    });
    console.log("Moyen de paiement par défaut mis à jour avec succès");

    res.json({ success: true });
  } catch (error: any) {
    console.error("Erreur lors de l'exécution de setPrimaryCard:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ error: error.message });
  } finally {
    console.log("Fin de la fonction setPrimaryCard");
  }
};

/**
 * Récupère toutes les cartes associées à un client.
 */
export const getCards = async (
  req: express.Request,
  res: express.Response
) => {
  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ error: "customerId est requis" });
  }

  try {
    // Récupérez les méthodes de paiement du client
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId as string,
      type: 'card',
    });

    // Récupérez les informations du client pour obtenir le default_payment_method
    const customer = await stripe.customers.retrieve(customerId as string);

    // Vérifiez si le client est supprimé
    if ((customer as any).deleted) {
      return res.status(404).json({ error: "Le client est supprimé." });
    }

    // Accédez à invoice_settings.default_payment_method
    const defaultPaymentMethod = (customer as any).invoice_settings?.default_payment_method;

    // Mapper les cartes en ajoutant isDefault
    const cards = paymentMethods.data.map((paymentMethod: any) => ({
      id: paymentMethod.id,
      last4: paymentMethod.card.last4,
      brand: paymentMethod.card.brand,
      exp_month: paymentMethod.card.exp_month,
      exp_year: paymentMethod.card.exp_year,
      isDefault: paymentMethod.id === defaultPaymentMethod,
    }));

    res.status(200).json({ cards });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPaymentIntent = async (
  req: express.Request,
  res: express.Response
) => {
  const { amount, currency, customerId } = req.body; // Ajoutez customerId ici
  console.log(amount);
  console.log(currency);
  if (!amount || !currency || !customerId) {
    return res.status(400).json({ error: "amount, currency et customerId sont requis" });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId, // Incluez customerId ici
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};