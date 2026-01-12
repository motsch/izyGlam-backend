import mongoose, { Document, Schema } from "mongoose";

export interface iFeedFollow extends Document {
  userId: mongoose.Types.ObjectId;
  proId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const feedFollowSchema = new Schema<iFeedFollow>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    proId: { type: Schema.Types.ObjectId, ref: "Users", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

feedFollowSchema.index({ userId: 1, proId: 1 }, { unique: true });

const FeedFollowModel = mongoose.model<iFeedFollow>("FeedFollow", feedFollowSchema);
export default FeedFollowModel;
