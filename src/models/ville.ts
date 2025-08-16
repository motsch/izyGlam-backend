import mongoose from "mongoose";

// Interface définissant la structure d'un document Ville
export interface iVille extends mongoose.Document {
  name: string;
  latitude: number;
  longitude: number;
  pays: string;
  city: string;
  code_postal: string;
  active: boolean;
  nb_habitnts: number;
}

// Schéma Mongoose pour le modèle Ville
const villeSchema = new mongoose.Schema<iVille>({
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  pays: { type: String, required: true },
  city: { type: String, required: true },
  code_postal: { type: String, required: true }, // Champ code_postal ajouté
  active: { type: Boolean, default: true, required: true },
  nb_habitnts: { type: Number, required: true },
});

// Création du modèle Ville basé sur le schéma
const VilleModel = mongoose.model<iVille>("Ville", villeSchema);
export default VilleModel;



