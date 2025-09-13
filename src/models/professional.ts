import mongoose, { Schema } from "mongoose";

export interface IChannelKV {
  value?: string;
  validated?: boolean;
  url?: string;
}

export interface IProfessional extends mongoose.Document {
  fullName?: string;
  businessName?: string;
  language?: string;
  categories?: string[];
  tags?: string[];
  ownerAgent?: string;
  doNotContact?: boolean;
  score?: number;

  geo?: {
    city?: string;
    country?: string; // ISO-2 préférable (FR, GB…)
    lat?: number;
    lng?: number;
  };

  channels?: {
    website?: { url?: string };
    phone?: { value?: string; validated?: boolean };
    email?: { value?: string; validated?: boolean };
    instagram?: { url?: string };
    facebook?: { url?: string };
    whatsapp?: { url?: string };
  };

  source?: {
    type?: string; // "google-places", "manual", etc.
    ref?: string;  // ex: place_id
    query?: string;
  };

  status?: "DISCOVERED" | "FOUND" | "ENRICHED" | "VERIFIED" | "QUEUED_FOR_OUTREACH" | "OUTREACHED";
  sequence?: {
    name?: string;
    step?: number;
    lastTouchAt?: string | null;
    nextActionAt?: string | null;
    lastChannel?: "email" | "whatsapp" | null;
  };

  extras?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  enrichedAt?: string;
  verifiedAt?: string;
}

const channelKV = new Schema<IChannelKV>({
  value: { type: String },
  validated: { type: Boolean },
  url: { type: String },
}, { _id: false });

const ProfessionalSchema = new Schema<IProfessional>({
  fullName: { type: String },
  businessName: { type: String },
  language: { type: String },
  categories: [{ type: String }],
  tags: [{ type: String }],
  ownerAgent: { type: String, default: "fetcher-places" },
  doNotContact: { type: Boolean, default: false },
  score: { type: Number, default: 0 },

  geo: {
    city: { type: String },
    country: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },

  channels: {
    website: { type: channelKV, default: {} },
    phone:   { type: channelKV, default: {} },
    email:   { type: channelKV, default: {} },
    instagram: { type: channelKV, default: {} },
    facebook:  { type: channelKV, default: {} },
    whatsapp:  { type: channelKV, default: {} },
  },

  source: {
    type: { type: String },
    ref: { type: String, index: true, sparse: true, unique: true },
    query: { type: String },
  },

  status: {
    type: String,
    enum: ["DISCOVERED", "FOUND", "ENRICHED", "VERIFIED", "QUEUED_FOR_OUTREACH", "OUTREACHED"],
    default: "DISCOVERED",
    index: true
  },

  sequence: {
    name: { type: String },
    step: { type: Number, default: 0 },
    lastTouchAt: { type: String, default: null },
    nextActionAt: { type: String, default: null },
    lastChannel: { type: String, enum: ["email", "whatsapp", null], default: null }
  },

  extras: { type: Schema.Types.Mixed },
  createdAt: { type: String },
  updatedAt: { type: String },
  enrichedAt: { type: String },
  verifiedAt: { type: String },
}, { minimize: true });

// Index unique sur site si présent
ProfessionalSchema.index({ "channels.website.url": 1 }, { unique: true, sparse: true });
// Déjà un index sur source.ref (unique+sparse) via la définition du champ
ProfessionalSchema.index({ status: 1 });

const ProfessionalModel = mongoose.model<IProfessional>("Professional", ProfessionalSchema);
export default ProfessionalModel;
