import mongoose from "mongoose";

export interface iBigBuySyncState extends mongoose.Document {
  key: string;               // ex: "stock" | "prices"
  lastPage: number;
  lastRunAt?: Date;
}

const schema = new mongoose.Schema<iBigBuySyncState>(
  {
    key: { type: String, required: true, unique: true },
    lastPage: { type: Number, default: 0 },
    lastRunAt: { type: Date },
  },
  { timestamps: true }
);

const bigbuySyncStateModel = mongoose.model<iBigBuySyncState>("BigBuySyncState", schema);
export default bigbuySyncStateModel;
