import mongoose, { Document, Schema } from "mongoose";

// Interface TypeScript pour un lead B2B
export interface IB2BLead extends Document {
  // Infos entreprise
  companyName: string;
  website?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;

  // Contact principal (DRH / RRH / Office Manager…)
  contactFirstName?: string;
  contactLastName?: string;
  contactJobTitle?: string;
  contactEmail: string;
  contactPhone?: string;
  linkedInUrl?: string;

  // Suivi & qualification
  status:
    | "new"
    | "in_drip"
    | "paused"
    | "meeting_scheduled"
    | "proposal_sent"
    | "won"
    | "lost";

  source?: "manual" | "import" | "api" | "other";
  tags?: string[];
  notes?: string; // commentaires libres

  // DRIP email (5 emails)
  dripStep: number; // 0 à 5

  email1Sent: boolean;
  email1SentAt?: Date;

  email2Sent: boolean;
  email2SentAt?: Date;

  email3Sent: boolean;
  email3SentAt?: Date;

  email4Sent: boolean;
  email4SentAt?: Date;

  email5Sent: boolean;
  email5SentAt?: Date;

  // Suivi temporel
  lastContactAt?: Date;
  nextActionAt?: Date;
}

// Schéma Mongoose pour le modèle B2BLead
const b2bLeadSchema = new Schema<IB2BLead>(
  {
    // --- Infos entreprise ---
    companyName: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    postalCode: { type: String, trim: true, index: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true, default: "FR" },

    // --- Contact principal ---
    contactFirstName: { type: String, trim: true },
    contactLastName: { type: String, trim: true },
    contactJobTitle: { type: String, trim: true },
    contactEmail: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    contactPhone: { type: String, trim: true },
    linkedInUrl: { type: String, trim: true },

    // --- Suivi & qualification ---
    status: {
      type: String,
      enum: [
        "new",
        "in_drip",
        "paused",
        "meeting_scheduled",
        "proposal_sent",
        "won",
        "lost",
      ],
      default: "new",
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "import", "api", "other"],
      default: "manual",
    },
    tags: [{ type: String, trim: true }],
    notes: { type: String },

    // --- DRIP email ---
    dripStep: { type: Number, default: 0, min: 0, max: 5 },

    email1Sent: { type: Boolean, default: false },
    email1SentAt: { type: Date },

    email2Sent: { type: Boolean, default: false },
    email2SentAt: { type: Date },

    email3Sent: { type: Boolean, default: false },
    email3SentAt: { type: Date },

    email4Sent: { type: Boolean, default: false },
    email4SentAt: { type: Date },

    email5Sent: { type: Boolean, default: false },
    email5SentAt: { type: Date },

    // --- Suivi temporel global ---
    lastContactAt: { type: Date },
    nextActionAt: { type: Date },
  },
  {
    timestamps: true, // createdAt / updatedAt auto
  }
);

// Un email de contact = un lead (tu peux changer si tu veux dupli)
b2bLeadSchema.index({ contactEmail: 1 }, { unique: true });

// Création du modèle
const B2BLeadModel = mongoose.model<IB2BLead>("B2BLead", b2bLeadSchema);
export default B2BLeadModel;
