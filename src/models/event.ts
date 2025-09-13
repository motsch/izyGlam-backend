import mongoose, { Schema } from "mongoose";

export interface IEvent extends mongoose.Document {
  professionalId?: mongoose.Types.ObjectId;
  type: string; // "EMAIL_SENT" | "WHATSAPP_SENT" | ...
  channel?: "email" | "whatsapp";
  payload?: Record<string, any>;
  at: string; // ISO string
}

const EventSchema = new Schema<IEvent>({
  professionalId: { type: Schema.Types.ObjectId, ref: "Professional", index: true },
  type: { type: String, required: true, index: true },
  channel: { type: String, enum: ["email", "whatsapp"] },
  payload: { type: Schema.Types.Mixed },
  at: { type: String, required: true, index: true },
}, { minimize: true });

const EventModel = mongoose.model<IEvent>("Event", EventSchema);
export default EventModel;
