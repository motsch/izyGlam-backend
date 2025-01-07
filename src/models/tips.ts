import mongoose from "mongoose";

// Interface définissant la structure d'un tip
export interface ITip extends mongoose.Document {
  elem: string; // Phrase en français
  trad: string; // Traduction ou identifiant
  actif: boolean; // Indicate si le tip est actif
}

// Schéma Mongoose pour le modèle Tip
const tipSchema = new mongoose.Schema<ITip>({
  elem: { type: String, required: true },
  trad: { type: String, required: true },
  actif: { type: Boolean, default: true },
});

// Création du modèle Tip basé sur le schéma
const tipModel = mongoose.model<ITip>("Tip", tipSchema);

export default tipModel;
