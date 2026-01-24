import mongoose, { Document, Schema } from "mongoose";

export type FeedInteractionType =
  | "VIEW"
  | "LIKE"
  | "UNLIKE"
  | "SAVE"
  | "UNSAVE"
  | "CTA_BOOK"
  | "OPEN_PROFILE"
  | "FOLLOW"
  | "UNFOLLOW";

export interface iFeedInteraction extends Document {
  userId: mongoose.Types.ObjectId; // viewer
  postId?: mongoose.Types.ObjectId; // pour FOLLOW/UNFOLLOW, postId peut être absent
  proId: mongoose.Types.ObjectId;

  type: FeedInteractionType;
  meta?: any;

  createdAt: Date;
}

const feedInteractionSchema = new Schema<iFeedInteraction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    postId: { type: Schema.Types.ObjectId, ref: "FeedPost", required: false, index: true },
    proId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },

    type: {
      type: String,
      enum: ["VIEW", "LIKE", "UNLIKE", "SAVE", "UNSAVE", "CTA_BOOK", "OPEN_PROFILE", "FOLLOW", "UNFOLLOW"],
      required: true,
      index: true,
    },

    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Pour analytics
feedInteractionSchema.index({ createdAt: -1 });
feedInteractionSchema.index({ userId: 1, createdAt: -1 });
feedInteractionSchema.index({ postId: 1, type: 1, createdAt: -1 });

// Idempotence likes/saves (un enregistrement actif par user/post/type LIKE ou SAVE)
// -> on empêche 2 likes "LIKE" identiques. UNLIKE reste un event séparé si tu veux historiser.
feedInteractionSchema.index(
  { userId: 1, postId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: { $in: ["LIKE", "SAVE"] } } }
);

const FeedInteractionModel = mongoose.model<iFeedInteraction>("FeedInteraction", feedInteractionSchema);
export default FeedInteractionModel;
