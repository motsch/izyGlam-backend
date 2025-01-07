import { Request, Response } from "express";
import SubscriptionModel from "../models/subscription";

// Créer un nouvel abonnement
export const createSubscription = async (req: Request, res: Response) => {
  try {
    const newSubscription = new SubscriptionModel(req.body);
    await newSubscription.save();
    res.status(201).json(newSubscription);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la création de l'abonnement", error });
  }
};

// Récupérer tous les abonnements d'un utilisateur
export const getUserSubscriptions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const subscriptions = await SubscriptionModel.find({ userId });
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération des abonnements", error });
  }
};

// Récupérer un abonnement spécifique par ID
export const getSubscriptionById = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await SubscriptionModel.findById(subscriptionId);
    if (subscription) {
      res.status(200).json(subscription);
    } else {
      res.status(404).json({ message: "Abonnement non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération de l'abonnement", error });
  }
};

export default {
    createSubscription,
    getUserSubscriptions,
    getSubscriptionById,
  };
