import mongoose, { Model } from "mongoose";
import { catalogConnection } from "../db/mongo";

export interface iBigbuySyncState extends mongoose.Document {
  key: string;        // "stock" | "prices" | "productsinformation" | "productsimages" | "catalog"
  lastPage: number;
  lastRunAt?: Date;
  meta?: any;         // optionnel pour debug (rate limit, lastCount, etc)
}

const schema = new mongoose.Schema<iBigbuySyncState>(
  {
    key: { type: String, required: true, unique: true },
    lastPage: { type: Number, default: 0 },
    lastRunAt: { type: Date },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

schema.index({ key: 1 }, { unique: true });

const BigbuySyncStateModel: Model<iBigbuySyncState> =
  catalogConnection.model<iBigbuySyncState>("BigbuySyncState", schema);

export default BigbuySyncStateModel;
