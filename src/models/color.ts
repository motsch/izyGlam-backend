import mongoose from "mongoose";

// Interface définissant la structure d'un document Color
export interface iColor extends mongoose.Document {
  name: string;
  hex: string;
}

// Schéma Mongoose pour le modèle Color
const colorSchema = new mongoose.Schema<iColor>({
  name: { type: String, required: true },
  hex: { type: String, required: true, match: /^#([0-9A-F]{3}){1,2}$/i }, // Vérifie que l'hex est un code valide
});

// Création du modèle Color basé sur le schéma
const colorModel = mongoose.model<iColor>("Color", colorSchema);
export default colorModel;
