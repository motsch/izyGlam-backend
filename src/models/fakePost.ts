import mongoose from "mongoose";

export type SocialPlatform = "instagram" | "tiktok" | "facebook";
export type LangCode = "fr"; // pour l’instant, FR only

export interface iFakePost extends mongoose.Document {
  platform: SocialPlatform;
  lang: LangCode;

  // Ex: "coiffure", "manucure", "massage", "all"
  shopTypes: string[];

  // texte avec variables {{shopName}}, {{city}}, etc.
  text: string;

  tone?: string; // optionnel (premium, warm, short...)
  active: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const fakePostSchema = new mongoose.Schema<iFakePost>(
  {
    platform: {
      type: String,
      enum: ["instagram", "tiktok", "facebook"],
      required: true,
      default: "instagram",
    },
    lang: {
      type: String,
      enum: ["fr"],
      required: true,
      default: "fr",
    },
    shopTypes: {
      type: [String],
      required: true,
      default: ["all"],
    },
    tone: { type: String, required: false },
    text: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index utile pour les recherches
fakePostSchema.index({ platform: 1, lang: 1, active: 1 });

const fakePostModel = mongoose.model<iFakePost>("FakePost", fakePostSchema);
export default fakePostModel;
