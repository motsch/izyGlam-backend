import SubscriptionModel from "../models/subscription";
import * as express from "express";
import UserModel from "../models/user";
import stripe from "../config/stripe";

// Créer un abonnement
const createSubscription = async (req: express.Request, res: express.Response) => {
  try {
    // const userId = req.user.id; // récupéré via ton middleware d'auth
    const { paymentMethodId, subscriptionId, userId } = req.body;

    // Vérifie que l'abonnement demandé existe dans Mongo
    const subscriptionPlan: any = await SubscriptionModel.findById(subscriptionId);
    if (!subscriptionPlan)
      return res.status(404).json({ message: "Abonnement introuvable." });

    const user = await UserModel.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    // Crée un customer Stripe si inexistant
    if (!user.customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
        metadata: { mongoUserId: user._id.toString() },
      });
      user.customerId = customer.id;
      await user.save();
    }

    // Attache la carte au client
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.customerId,
    });

    // Déclare comme méthode par défaut
    await stripe.customers.update(user.customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Crée l’abonnement Stripe
    const subscription = await stripe.subscriptions.create({
      customer: user.customerId,
      items: [{ price: subscriptionPlan.stripePriceId }], // ce champ doit être dans ton modèle Mongo
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Met à jour l'utilisateur avec infos d'abonnement
    user.abonnement = subscriptionPlan.type;
    user.abonnement_end = new Date(subscription.current_period_end * 1000);
    await user.save();

    return res.status(201).json({
      message: "Abonnement créé avec succès.",
      subscription,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Erreur lors de la création d'abonnement", error });
  }
};

// Récupérer tous les abonnements (avec filtre pays si fourni)
const getAllSubscriptions = async (req: express.Request, res: express.Response) => {
  try {
    const { country } = req.query;
    const query = country ? { country } : {};
    const subscriptions = await SubscriptionModel.find(query).sort({ order: 1 });
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les abonnements", error });
  }
};

// Récupérer un abonnement par ID
const getSubscriptionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const subscription = await SubscriptionModel.findById(id);
    if (subscription) {
      res.json(subscription);
    } else {
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer l'abonnement", error });
  }
};

// Mettre à jour un abonnement
const updateSubscriptionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedSubscription = await SubscriptionModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedSubscription) {
      res.json(updatedSubscription);
    } else {
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour l'abonnement", error });
  }
};

// Supprimer un abonnement
const deleteSubscriptionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedSubscription = await SubscriptionModel.findByIdAndDelete(id);
    if (deletedSubscription) {
      res.json({ message: "Abonnement supprimé avec succès" });
    } else {
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error) {
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
