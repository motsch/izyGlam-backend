import mongoose from "mongoose";

// Interface définissant la structure d'un document Suggestion
export interface iSuggestion extends mongoose.Document {
  description: string;
  userId: string;
  createdAt: Date;
}

// Schéma Mongoose pour le modèle Suggestion
const suggestionSchema = new mongoose.Schema<iSuggestion>({
  description: { type: String, required: true, minlength: 10 },
  userId: { type: String, required: true, minlength: 10 },
  createdAt: { type: Date, default: Date.now },
});

// Création du modèle Suggestion basé sur le schéma
const suggestionModel = mongoose.model<iSuggestion>("Suggestion", suggestionSchema);
export default suggestionModel;
