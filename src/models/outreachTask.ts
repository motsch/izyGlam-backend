import mongoose, { Schema } from "mongoose";

export interface IOutreachTask extends mongoose.Document {
  professionalId: mongoose.Types.ObjectId;
  status: "QUEUED" | "SENT" | "ERROR" | "SKIPPED";
  channel: "email" | "whatsapp";
  template?: string;
  seqName?: string;
  nextAt?: string;
  sentAt?: string;
  createdAt?: string;
  meta?: Record<string, any>;
  error?: string;
}

const OutreachTaskSchema = new Schema<IOutreachTask>({
  professionalId: { type: Schema.Types.ObjectId, ref: "Professional", required: true, index: true },
  status: { type: String, enum: ["QUEUED", "SENT", "ERROR", "SKIPPED"], default: "QUEUED", index: true },
  channel: { type: String, enum: ["email", "whatsapp"], required: true },
  template: { type: String },
  seqName: { type: String },
  nextAt: { type: String, index: true },
  sentAt: { type: String },
  createdAt: { type: String },
  meta: { type: Schema.Types.Mixed },
  error: { type: String },
}, { minimize: true });

OutreachTaskSchema.index({ status: 1, nextAt: 1 });

const OutreachTaskModel = mongoose.model<IOutreachTask>("OutreachTask", OutreachTaskSchema);
export default OutreachTaskModel;
