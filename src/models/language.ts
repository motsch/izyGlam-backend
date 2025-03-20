import mongoose from "mongoose";

// Interface définissant la structure d'un document Language
export interface ILanguage extends mongoose.Document {
  code: string;
  name: string;
  flag: string; // URL du drapeau
  trad: string;
  active: boolean;
}

// Schéma Mongoose pour le modèle Language
const languageSchema = new mongoose.Schema<ILanguage>({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  flag: { type: String, required: true }, // Chemin ou URL de l'image
  active: { type: Boolean, default: false, required: true },
  trad: { type: String, required: true },
});

// Création du modèle Language basé sur le schéma
const LanguageModel = mongoose.model<ILanguage>("Language", languageSchema);
export default LanguageModel;
