import mongoose from "mongoose";

export interface iSubscription extends mongoose.Document {
  name: string;                     // Nom technique ex: "apprentie"
  label: string;                    // Label affiché ex: "APPRENTIE"
  icon: string;                     // Emoji ou icône ex: "🌱"
  price: number;                    // Prix en euros
  currency: string;                 // "EUR", "USD"...
  country: string;                  // Code pays ISO ex: "FR"
  maxSalons: number | null;         // ex: 1, 3, 10, null (= illimité)
  features: string[];               // Liste des bullet points
  supportLevel?: string;           // "standard", "email", "prioritaire"
  isCustom: boolean;                // Pour l'offre Déesse
  trialAvailable: boolean;          // 1 mois gratuit ?
  order: number;                    // Pour l’ordre d’affichage
  stripePriceId?: string;           // Lien avec Stripe (ex: prix_1N...)
}

const subscriptionSchema = new mongoose.Schema<iSubscription>({
  name: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  icon: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, required: true, default: "EUR" },
  country: { type: String, required: true },
  maxSalons: { type: Number, default: null }, // null = illimité
  features: { type: [String], default: [] },
  supportLevel: { type: String, enum: ["standard", "email", "prioritaire"], default: "standard" },
  isCustom: { type: Boolean, default: false },
  trialAvailable: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  stripePriceId: { type: String }, // Peut être undefined au départ
});

const subscriptionModel = mongoose.model<iSubscription>("Subscription", subscriptionSchema);
export default subscriptionModel;
