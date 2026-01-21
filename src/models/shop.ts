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
  reasons: string[]; // ex: ["adult", "drugs", "hate", "parse_error"]
  score: number; // 0..1
  raw?: any; // si tu veux stocker la réponse complète de l'IA
};

// ✅ Résumé des prestations (services) flagguées, stocké sur le shop
type ModerationServicesSummary = {
  flaggedCount: number; // nb de services signalés dans ce shop
  topReasons: string[]; // ex: ["adult", "drugs"]
  lastFlaggedAt?: Date; // dernière fois qu'un service a été signalé
};

type Moderation = {
  desc: ModerationDesc;
  services?: ModerationServicesSummary; // ✅ NEW
  reviewedAt: Date;
  reviewedBy?: string;
  source?: "ai" | "human";
};

type VerificationDocStatus = "missing" | "pending" | "approved" | "rejected";

type VerificationDoc = {
  file?: string; // chemin du fichier ex: /uploads/docs/xxx.pdf
  status: VerificationDocStatus; // état du doc
  checkedAt?: Date | null; // date de validation / refus
};

type Verification = {
  identity: VerificationDoc; // CNI / Passeport / Titre de séjour
  insurance: VerificationDoc; // Assurance obligatoire
  kbis?: VerificationDoc; // Kbis optionnel
  globalStatus: "unverified" | "pending" | "verified" | "rejected";
  method?: "manual" | "stripe_identity" | "mixed"; // pour plus tard, Stripe Identity
};

export type ShopServiceMode = "SALON" | "DOMICILE";

type PlaceAddress = {
  label?: string;       // "12 rue ...", texte complet
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;     // "FR"
};

export interface iShop extends mongoose.Document {
  name: string;
  handle: string;
  description: string; // description corrigée (si approuvée)
  description_original?: string; // copie avant correction
  image: string;
  note: string;
  averagePrice?: string;
  minimumDelay: string;
  type: string;
  ville: string;
  filter: string;
  district?: string;

  // ✅ NEW : sur place / à domicile
  serviceMode?: ShopServiceMode; // default "SALON"

  // ✅ NEW : adresse du lieu (utile si SALON)
  placeAddress?: PlaceAddress;

  stats?: {
    bookings?: {
      finished?: {
        last24h: number;
        week: number;
        month: number;
        total: number;
      };
    };
    computedAt?: Date;
  };

  reviews: Array<{
    user: mongoose.Types.ObjectId;
    rating?: number;
    comment?: string;
  }>;

  maxDistance: number;
  idUser: string;
  country: string;
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
  facebook: string;
  instagram: string;
  tiktok: string;

  // 🔒 Modération / statut
  active?: boolean;
  status?: "pending" | "approved" | "blocked" | "needs_manual_review";
  flags?: string[];
  moderation?: Moderation;

  // ✅ Vérification pro & documents
  verification?: Verification;
  timeZone?: string;

  legal?: {
    companyName?: string;
    legalForm?: string;
    siret?: string;
    siren?: string;
    vatNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
}

const defaultDaySchedule: DaySchedule = {
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "13:00", end: "18:00" },
  closed: false,
};

const shopSchema = new Schema<iShop>(
  {
    name: { type: String, required: true },
    handle: { type: String, required: true, unique: true, index: true },
    country: { type: String, required: true },
    description: { type: String, required: true },
    filter: { type: String, required: true },
    description_original: { type: String, required: false },
    image: { type: String, required: true, default: "default.png" },
    note: { type: String, required: true },

    // ✅ NEW : mode de prestation
    serviceMode: {
      type: String,
      enum: ["SALON", "DOMICILE"],
      default: "SALON",
      required: false,
      index: true,
    },

    // ✅ NEW : adresse du lieu (si salon)
    placeAddress: {
      label: { type: String, required: false },
      addressLine1: { type: String, required: false },
      addressLine2: { type: String, required: false },
      postalCode: { type: String, required: false },
      city: { type: String, required: false },
      country: { type: String, required: false, default: "FR" },
    },

    // 📊 Stats (calculées par cron)
    stats: {
      bookings: {
        finished: {
          last24h: { type: Number, default: 0 },
          week: { type: Number, default: 0 },
          month: { type: Number, default: 0 },
          total: { type: Number, default: 0 },
        },
      },
      computedAt: { type: Date },
    },

    facebook: { type: String },
    instagram: { type: String },
    tiktok: { type: String },
    deliveryPostalCodes: { type: [String], required: false },
    averagePrice: { type: String, required: false },
    minimumDelay: { type: String, required: false, default: "30" },
    type: { type: String, required: true },
    ville: { type: String, required: true },
    ondaybooking: { type: Boolean, required: false, default: false },
    district: { type: String, required: false },
    trad: { type: String, required: true },
    galleryImages: { type: [String], required: false },
    timeZone: { type: String, required: false, default: "Europe/Paris" },

    reviews: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: false },
        comment: { type: String, required: false },
      },
    ],

    maxDistance: { type: Number, required: true },
    idUser: { type: String, required: true },
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

    // ✅ Vérification & documents
    verification: {
      identity: {
        file: { type: String },
        status: {
          type: String,
          enum: ["missing", "pending", "approved", "rejected"],
          default: "missing",
        },
        checkedAt: { type: Date, default: null },
      },
      insurance: {
        file: { type: String },
        status: {
          type: String,
          enum: ["missing", "pending", "approved", "rejected"],
          default: "missing",
        },
        checkedAt: { type: Date, default: null },
      },
      kbis: {
        file: { type: String },
        status: {
          type: String,
          enum: ["missing", "pending", "approved", "rejected"],
          default: "missing",
        },
        checkedAt: { type: Date, default: null },
      },
      globalStatus: {
        type: String,
        enum: ["unverified", "pending", "verified", "rejected"],
        default: "unverified",
      },
      method: {
        type: String,
        enum: ["manual", "stripe_identity", "mixed"],
        default: "manual",
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

      // ✅ NEW : résumé des services signalés pour ce shop
      services: {
        flaggedCount: { type: Number, default: 0 },
        topReasons: { type: [String], default: [] },
        lastFlaggedAt: { type: Date },
      },

      reviewedAt: { type: Date },
      reviewedBy: { type: String },
      source: { type: String, enum: ["ai", "human"], default: "ai" },
    },

    legal: {
      companyName: { type: String },
      legalForm: { type: String },
      siret: { type: String },
      siren: { type: String },
      vatNumber: { type: String },
      addressLine1: { type: String },
      addressLine2: { type: String },
      postalCode: { type: String },
      city: { type: String },
      country: { type: String, default: "FR" },
      email: { type: String },
      phone: { type: String },
    },
  },
  { timestamps: true }
);

// Index utiles pour les vues d’admin/modération
shopSchema.index({ status: 1 });
shopSchema.index({ active: 1 });
shopSchema.index({ "moderation.desc.safe": 1 });
shopSchema.index({ "moderation.services.flaggedCount": 1 });

// ✅ NEW : filtrage rapide mode
shopSchema.index({ serviceMode: 1 });

const shopModel = mongoose.model<iShop>("Shop", shopSchema);
export default shopModel;
