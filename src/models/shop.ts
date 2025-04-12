import mongoose from "mongoose";
import { iUser } from "./user";

export interface iShop extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  note: string;
  averagePrice: string;
  minimumDelay: string;
  type: string;
  ville: string;
  district: string;
  // Ajout de reviews ici
  reviews: [
    {
      user: {
        type: string;
        required: true,
      },
      rating: { type: Number, required: true },
      comment: { type: String, required: true },
    },
  ],
  maxDistance: number;
  idUser: string;
  services: string[];
  deliveryPostalCodes: string[];
  trad: string;
  galleryImages: string[];
  promo?: {
    active: boolean;
    type: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  hours: {
    morning: {
      start: string;
      end: string;
    };
    afternoon: {
      start: string;
      end: string;
    };
  };
  // ✅ Ajout des nouvelles stats
    impressions: number;
    clics: number;
    taux_conversion: number;
    affichage_prioritaire: Boolean;
    temps_affichage_total: number;
    nombre_affichages_valides: number;
}

const shopSchema = new mongoose.Schema<iShop>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true, default:"default.png" },
  note: { type: String, required: true },
  deliveryPostalCodes: { type: [String], required: false },
  averagePrice: { type: String, required: false },
  minimumDelay: { type: String, required: false },
  type: { type: String, required: true },
  ville: { type: String, required: true },
  district: { type: String, required: false },
  trad: { type: String, required: true },
  galleryImages: { type: [String], required: false },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      rating: { type: Number, required: false },
      comment: { type: String, required: false },
    },
  ],
  maxDistance: { type: Number, required: true },
  idUser: {
    type: String,
    required: true,
  },
  services: [
    { type: String, required: true },
  ],
  promo: {
    active: { type: Boolean, required: true },
    type: { type: String, required: true },
  },
  location: {
    latitude: { type: Number, required: true},
    longitude: { type: Number, required: true },
  },
  hours: {
    morning: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    afternoon: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
  },
  // ✅ Ajout des stats
    impressions: { type: Number, default: 0 }, // Nombre d'affichages
    clics: { type: Number, default: 0 }, // Nombre de clics
    taux_conversion: { type: Number, default: 0 }, // Clics / Impressions
    affichage_prioritaire: { type: Boolean, default: false }, // Vérifie que l'hex est un code valide
    // ✅ Nouveaux champs pour le suivi du temps moyen d'affichage
    temps_affichage_total: { type: Number, default: 0 }, // Temps total d'affichage en secondes
    nombre_affichages_valides: { type: Number, default: 0 } // Nombre de fois où la pub a été vue suffisamment
});

const shopModel = mongoose.model<iShop>("Shop", shopSchema);
export default shopModel;