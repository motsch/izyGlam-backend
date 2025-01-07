import mongoose from "mongoose";

// Interface définissant la structure d'un document Profile
export interface iProfile extends mongoose.Document {
  activity: {
    name: string;
    trad: string;
  };
  visualStyle: string;
  color: string;
  categories: {
    name: string;
    trad: string;
  }[];
  introduction: string;
  highlights: {
    name: string;
    trad: string;
    detail: string;
    detail_trad: string;
    examples: string[];
  }[];
  tones: {
    name: string;
    trad: string;
  }[];
  country: string;
  language: string;
  userId: string;
  active: boolean;
}

// Schéma Mongoose pour le modèle Profile
const profileSchema = new mongoose.Schema<iProfile>({
  activity: {
    name: { type: String, required: true },
    trad: { type: String, required: true },
  },
  visualStyle: { type: String },
  color: { type: String },
  categories: [
    {
      name: { type: String, required: true },
      trad: { type: String, required: true },
    },
  ],
  introduction: { type: String },
  highlights: [
    {
      name: { type: String, required: true },
      trad: { type: String, required: true },
      detail: { type: String },
      detail_trad: { type: String },
      examples: { type: [String], default: [] },
    },
  ],
  tones: [
    {
      name: { type: String, required: true },
      trad: { type: String, required: true },
    },
  ],
  country: { type: String },
  language: { type: String },
  userId: { type: String, required: true },
  active: { type: Boolean, default: true },
});

// Création du modèle Profile basé sur le schéma
const ProfileModel = mongoose.model<iProfile>("Profile", profileSchema);
export default ProfileModel;
