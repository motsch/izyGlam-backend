import mongoose, { Schema } from "mongoose";

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

type ModerationDesc = {
  safe: boolean;
  reasons: string[];  // ex: ["adult", "drugs", "hate", "parse_error"]
  score: number;      // 0..1
  raw?: any;          // si tu veux stocker la réponse complète de l'IA
};

type Moderation = {
  desc: ModerationDesc;
  reviewedAt: Date;
  reviewedBy?: string;
  source?: "ai" | "human";
};

export interface iShop extends mongoose.Document {
  name: string;
  description: string;               // description corrigée (si approuvée)
  description_original?: string;     // copie avant correction
  image: string;
  note: string;
  averagePrice?: string;
  minimumDelay: string;
  type: string;
  ville: string;
  district?: string;
  reviews: Array<{
    user: mongoose.Types.ObjectId;
    rating?: number;
    comment?: string;
  }>;
  maxDistance: number;
  idUser: string;
  services: string[];
  deliveryPostalCodes?: string[];
  trad: string;
  ondaybooking: boolean;
  galleryImages?: string[];
  promo?: {
    active: boolean;
    type: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  hours: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
  impressions: number;
  clics: number;
  taux_conversion: number;
  affichage_prioritaire: boolean;
  temps_affichage_total: number;
  nombre_affichages_valides: number;
  temps_affichage_moyen: number;

  // 🔒 Modération / statut
  active?: boolean;
  status?: "pending" | "approved" | "blocked" | "needs_manual_review";
  flags?: string[];           // raisons synthétiques (mots-clés)
  moderation?: Moderation;    // détail de modération IA/humain
}

const defaultDaySchedule: DaySchedule = {
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "13:00", end: "18:00" },
  closed: false,
};

const shopSchema = new Schema<iShop>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },             // texte final affiché côté app
    description_original: { type: String, required: false },    // trace avant correction
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
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: false },
        comment: { type: String, required: false },
      },
    ],

    maxDistance: { type: Number, required: true },
    idUser: { type: String, required: true },
    services: [{ type: String, required: true }],

    promo: {
      active: { type: Boolean, required: true, default: true },
      type: { type: String, required: true },
    },

    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    hours: {
      monday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
        closed: { type: Boolean, default: false },
      },
      tuesday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
        closed: { type: Boolean, default: false },
      },
      wednesday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
        closed: { type: Boolean, default: false },
      },
      thursday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
        closed: { type: Boolean, default: false },
      },
      friday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
        closed: { type: Boolean, default: false },
      },
      saturday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
        closed: { type: Boolean, default: false },
      },
      sunday: {
        morning: { type: Object, default: { start: "09:00", end: "12:00" } },
        afternoon: { type: Object, default: { start: "13:00", end: "18:00" } },
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

    // 🔒 Modération / statut
    active: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["pending", "approved", "blocked", "needs_manual_review"],
      default: "pending",
    },
    flags: { type: [String], default: [] },
    moderation: {
      desc: {
        safe: { type: Boolean, default: true },
        reasons: { type: [String], default: [] },
        score: { type: Number, default: 0 },
        raw: { type: Schema.Types.Mixed },
      },
      reviewedAt: { type: Date },
      reviewedBy: { type: String },
      source: { type: String, enum: ["ai", "human"], default: "ai" },
    },
  },
  { timestamps: true }
);

// Index utiles pour les vues d’admin/modération
shopSchema.index({ status: 1 });
shopSchema.index({ active: 1 });
shopSchema.index({ "moderation.desc.safe": 1 });

const shopModel = mongoose.model<iShop>("Shop", shopSchema);
export default shopModel;