// controllers/stripeController.ts
import * as express from "express";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import UserModel from "../models/user";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-01-27.acacia", // Version de l'API Stripe
});

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

        // Si nécessaire, vous pouvez attacher cette méthode de paiement à un client
        // const customerId = 'customer_id'; // Remplacez par l'ID du client réel
        // await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

        res.status(201).json({ paymentMethodId: paymentMethod.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

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
export const setPrimaryCard = async (
    req: express.Request,
    res: express.Response
) => {
    const { cardId, customerId } = req.body;
    if (!cardId || !customerId) {
        return res.status(400).json({ error: "cardId et customerId sont requis" });
    }
    try {
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: cardId },
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getCards = async (
    req: express.Request,
    res: express.Response
  ) => {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: "customerId est requis" });
    }
  
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId as string,
        type: 'card',
      });
  
      const cards = paymentMethods.data.map((paymentMethod: any) => ({
        id: paymentMethod.id,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
        isDefault: paymentMethod.id === paymentMethod.customer.default_payment_method,
      }));
  
      res.status(200).json({ cards });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };