import mongoose from "mongoose";
import { iUser } from "./user";

type DaySchedule = {
  morning: {
    start: string;
    end: string;
  };
  afternoon: {
    start: string;
    end: string;
  };
  closed: boolean;
};

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
  reviews: [
    {
      user: {
        type: string;
        required: true;
      },
      rating: { type: Number; required: true };
      comment: { type: String; required: true };
    }
  ];
  maxDistance: number;
  idUser: string;
  services: string[];
  deliveryPostalCodes: string[];
  trad: string;
  ondaybooking:boolean;
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
    [key in
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
      | "sunday"]: DaySchedule;
  };
  impressions: number;
  clics: number;
  taux_conversion: number;
  affichage_prioritaire: Boolean;
  temps_affichage_total: number;
  nombre_affichages_valides: number;
  temps_affichage_moyen: number;
}

// Fonction pour générer un bloc d'horaire avec des valeurs par défaut
const defaultDaySchedule = {
  morning: {
    start: "09:00",
    end: "12:00",
  },
  afternoon: {
    start: "13:00",
    end: "18:00",
  },
  closed: false,
};

const shopSchema = new mongoose.Schema<iShop>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true, default: "default.png" },
  note: { type: String, required: true },
  deliveryPostalCodes: { type: [String], required: false },
  averagePrice: { type: String, required: false },
  minimumDelay: { type: String, required: false, default: "30" },
  type: { type: String, required: true },
  ville: { type: String, required: true },
  ondaybooking: { type: Boolean, required: false, default: false },
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
  idUser: { type: String, required: true },
  services: [{ type: String, required: true }],
  promo: {
    active: { type: Boolean, required: true },
    type: { type: String, required: true },
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  hours: {
    monday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
    tuesday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
    wednesday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
    thursday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
    friday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
    saturday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
    sunday: {
      morning: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "12:00" },
      },
      afternoon: {
        start: { type: String, default: "13:00" },
        end: { type: String, default: "18:00" },
      },
      closed: { type: Boolean, default: false },
    },
  },
  impressions: { type: Number, default: 0 },
  clics: { type: Number, default: 0 },
  taux_conversion: { type: Number, default: 0 },
  affichage_prioritaire: { type: Boolean, default: false },
  temps_affichage_total: { type: Number, default: 0 },
  nombre_affichages_valides: { type: Number, default: 0 },
  temps_affichage_moyen: { type: Number, default: 0 },
});

const shopModel = mongoose.model<iShop>("Shop", shopSchema);
export default shopModel;
