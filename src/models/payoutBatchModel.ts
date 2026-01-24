import mongoose from "mongoose";

export interface iPayoutBatch extends mongoose.Document {
  userProId: string;
  periodStart: Date;
  periodEnd: Date;
  amountCents: number;
  currency: "eur";
  stripeTransferId?: string;
  status: "created" | "paid" | "failed";
  errorMessage?: string;
  createdAt: Date;
}

const payoutBatchSchema = new mongoose.Schema<iPayoutBatch>({
  userProId: { type: String, required: true, index: true },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true, index: true },
  amountCents: { type: Number, required: true },
  currency: { type: String, enum: ["eur"], default: "eur" },
  stripeTransferId: { type: String },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

payoutBatchSchema.index({ userProId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export default mongoose.model<iPayoutBatch>("PayoutBatch", payoutBatchSchema);
