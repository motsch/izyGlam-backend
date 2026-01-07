import mongoose, { Schema } from "mongoose";

export interface iSmsOptOut extends mongoose.Document {
  phone: string;      // client phone E.164
  shopId?: string;    // optionnel: opt-out global ou par shop
  reason?: string;    // "STOP"
  createdAt: Date;
  updatedAt: Date;
}

const smsOptOutSchema = new Schema<iSmsOptOut>(
  {
    phone: { type: String, required: true, index: true },
    shopId: { type: String, required: false, index: true },
    reason: { type: String, required: false, default: "STOP" },
  },
  { timestamps: true }
);

// opt-out unique global si shopId null, sinon unique par shop
smsOptOutSchema.index({ phone: 1, shopId: 1 }, { unique: true });

const SmsOptOutModel = mongoose.model<iSmsOptOut>("SmsOptOut", smsOptOutSchema);
export default SmsOptOutModel;
