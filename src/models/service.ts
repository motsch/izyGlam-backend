import mongoose, { Schema } from "mongoose";

type ModerationDesc = {
  safe: boolean;
  reasons: string[];
  score: number;    // 0..1
  raw?: any;
};

type Moderation = {
  desc: ModerationDesc;
  reviewedAt: Date;
  reviewedBy?: string;
  source?: "ai" | "human";
};

export interface iService extends mongoose.Document {
  blocked: boolean;
  name: string;
  description: string;               // texte final (corrigé si approuvé)
  description_original?: string;     // copie avant correction
  image?: string;
  type: string;
  price: number;
  duration: number;                  // minutes
  shopId: string;                    // id de la boutique
  color: string;

  // 🔒 Modération
  flags?: string[];                  // raisons synthétiques
  moderation?: Moderation;           // détail de modération
}

const serviceSchema = new Schema<iService>(
  {
    blocked: { type: Boolean, default: false },

    name: { type: String, required: true },
    description: { type: String, required: true },
    description_original: { type: String, required: false },

    image: { type: String, required: false },
    type: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true },

    shopId: { type: String, required: true },

    color: { type: String, required: false, default: "#ff4081" }, // Rose IzyGlam 💖

    // 🔒 Modération
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

// Index utiles
serviceSchema.index({ blocked: 1 });
serviceSchema.index({ "moderation.desc.safe": 1 });

const serviceModel = mongoose.model<iService>("Service", serviceSchema);
export default serviceModel;