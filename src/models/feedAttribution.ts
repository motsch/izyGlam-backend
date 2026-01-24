import mongoose, { Document, Schema } from "mongoose";

export type AttributionTarget = "ORDER" | "BOOKING";
export type AttributionReason = "CTA_BOOK" | "VIEW_ASSISTED";

export interface iFeedAttribution extends Document {
  userId: mongoose.Types.ObjectId;
  proId: mongoose.Types.ObjectId;

  postId?: mongoose.Types.ObjectId;

  targetType: AttributionTarget;
  targetId: mongoose.Types.ObjectId;

  reason: AttributionReason;

  // optionnel: montant (si tu veux dashboard direct)
  amount?: number;
  currency?: string;

  createdAt: Date;
}

const feedAttributionSchema = new Schema<iFeedAttribution>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    proId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    postId: { type: Schema.Types.ObjectId, ref: "FeedPost", required: false, index: true },

    targetType: { type: String, enum: ["ORDER", "BOOKING"], required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },

    reason: { type: String, enum: ["CTA_BOOK", "VIEW_ASSISTED"], required: true, index: true },

    amount: { type: Number },
    currency: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 1 attribution max par target (ORDER/BOOKING)
feedAttributionSchema.index({ targetType: 1, targetId: 1 }, { unique: true });

const FeedAttributionModel = mongoose.model<iFeedAttribution>("FeedAttribution", feedAttributionSchema);
export default FeedAttributionModel;
