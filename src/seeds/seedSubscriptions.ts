import mongoose from "mongoose";
import dotenv from "dotenv";
import SubscriptionModel from "../models/subscription";

/**
 * Lancer avec la commande: npx ts-node src/seeds/seedSubscriptions.ts
 */

// Charger les variables d’environnement (.env)
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/izyglam";

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connecté à MongoDB");

    // Nettoyer les anciens abonnements si besoin
    await SubscriptionModel.deleteMany({ country: "FR" });

    const subscriptions = [
      {
        name: "apprentie",
        label: "APPRENTIE",
        icon: "🌱",
        price: 0,
        currency: "EUR",
        country: "FR",
        maxSalons: 1,
        features: [
          "1 salon actif",
          "Nombre illimité de réservations et de clients",
          "Gestion des prestations et du planning",
          "Synchronisation calendrier personnel",
          "Parfait pour démarrer sereinement"
        ],
        supportLevel: "standard",
        isCustom: false,
        trialAvailable: false,
        order: 1,
        stripePriceId: null
      },
      {
        name: "elue",
        label: "ÉLUE",
        icon: "✨",
        price: 89,
        currency: "EUR",
        country: "FR",
        maxSalons: 3,
        features: [
          "Jusqu’à 3 salons actifs",
          "Gestion complète des prestations, clients et rendez-vous",
          "Synchronisation calendrier personnel",
          "Support email prioritaire : ressources exclusives pour faire évoluer ton activité"
        ],
        supportLevel: "email",
        isCustom: false,
        trialAvailable: true,
        order: 2,
        stripePriceId: null // à remplir après avoir créé le prix sur Stripe
      },
      {
        name: "reine",
        label: "REINE",
        icon: "👑",
        price: 299,
        currency: "EUR",
        country: "FR",
        maxSalons: 10,
        features: [
          "Jusqu’à 10 salons actifs",
          "Accès à des statistiques avancées sur vos performances",
          "Recommandations intelligentes pour booster votre CA",
          "Visibilité renforcée sur la plateforme IzyGlam",
          "Support prioritaire",
          "Pensé pour les indépendantes ambitieuses"
        ],
        supportLevel: "prioritaire",
        isCustom: false,
        trialAvailable: false,
        order: 3,
        stripePriceId: null
      },
      {
        name: "deesse",
        label: "DÉESSE",
        icon: "🔱",
        price: 0, // personnalisé
        currency: "EUR",
        country: "FR",
        maxSalons: null,
        features: [
          "Nombre illimité de salons",
          "Accompagnement stratégique personnalisé",
          "Visibilité boostée et mise en avant de vos salons",
          "Solutions sur mesure pour faire scaler votre activité"
        ],
        supportLevel: "prioritaire",
        isCustom: true,
        trialAvailable: false,
        order: 4,
        stripePriceId: null
      }
    ];

    await SubscriptionModel.insertMany(subscriptions);
    console.log("✅ Abonnements FR ajoutés avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors du seed :", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
};

seed();
