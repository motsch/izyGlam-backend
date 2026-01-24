import mongoose, { Document, Schema } from "mongoose";

export interface iFeedViewDedup extends Document {
  userId: mongoose.Types.ObjectId;
  postId: mongoose.Types.ObjectId;
  expireAt: Date; // TTL
  createdAt: Date;
}

const feedViewDedupSchema = new Schema<iFeedViewDedup>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    postId: { type: Schema.Types.ObjectId, ref: "FeedPost", required: true, index: true },
    expireAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 1 ticket par user/post (tant qu’il n’expire pas)
feedViewDedupSchema.index({ userId: 1, postId: 1 }, { unique: true });

// TTL: Mongo supprime le doc après expireAt
feedViewDedupSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const FeedViewDedupModel = mongoose.model<iFeedViewDedup>("FeedViewDedup", feedViewDedupSchema);
export default FeedViewDedupModel;
