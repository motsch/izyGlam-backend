import mongoose, { Document, Schema } from "mongoose";

export interface IProLead extends Document {
  // Identifiant Google Places pour éviter les doublons
  googlePlaceId?: string;

  // Infos prestataire / entreprise
  name: string;                 // nom affiché (ex: "Institut Belle & Zen")
  website?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;

  // Catégorie / type de prestation (liée à tes Category actives)
  categoryId?: string;          // id de Category (string pour rester souple)
  categoryName?: string;        // nom lisible ("massage", "coiffure", etc.)
  categoryFilter?: string;      // correspond à category.filter si tu veux

  // Contact
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  linkedInUrl?: string;

  // Contexte de ciblage
  source?: "manual" | "import" | "api";
  tags?: string[];
  notes?: string;

  // Ciblage par entreprises existantes
  matchedCompanies?: string[];  // ids de Company qui “justifient” ce lead
  estimatedEmployees?: number;  // estimation si utile

  // Suivi simple
  status: "new" | "contacted" | "qualified" | "rejected" | "onboarded";
  lastContactAt?: Date;
  nextActionAt?: Date;
}

const proLeadSchema = new Schema<IProLead>(
  {
    googlePlaceId: { type: String, trim: true, index: true },

    name: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    postalCode: { type: String, trim: true, index: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true, default: "FR" },

    categoryId: { type: String, trim: true },
    categoryName: { type: String, trim: true },
    categoryFilter: { type: String, trim: true },

    contactName: { type: String, trim: true },
    contactEmail: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    contactPhone: { type: String, trim: true },
    linkedInUrl: { type: String, trim: true },

    source: {
      type: String,
      enum: ["manual", "import", "api"],
      default: "api",
    },
    tags: [{ type: String, trim: true }],
    notes: { type: String },

    matchedCompanies: [{ type: String, trim: true }],
    estimatedEmployees: { type: Number },

    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "rejected", "onboarded"],
      default: "new",
      index: true,
    },
    lastContactAt: { type: Date },
    nextActionAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// contactEmail unique seulement quand défini
proLeadSchema.index({ contactEmail: 1 }, { unique: true, sparse: true });

// un même établissement Google Places = un seul lead
proLeadSchema.index({ googlePlaceId: 1 }, { unique: true, sparse: true });

const ProLeadModel = mongoose.model<IProLead>("ProLead", proLeadSchema);
export default ProLeadModel;
