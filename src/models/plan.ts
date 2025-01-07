import mongoose from "mongoose";

// Interface définissant la structure d'un document Plan
export interface iPlan extends mongoose.Document {
  name: string;
  price: number;
  description: string;
  maxPostsPerWeek: number;
  includesPhotos: boolean;
  isAutomated: boolean;
}

// Schéma Mongoose pour le modèle Plan
const planSchema = new mongoose.Schema<iPlan>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  maxPostsPerWeek: { type: Number, required: true },
  includesPhotos: { type: Boolean, default: false },
  isAutomated: { type: Boolean, default: false },
});

// Création du modèle Plan basé sur le schéma
const planModel = mongoose.model<iPlan>("Plan", planSchema);
export default planModel;
