import mongoose from "mongoose";

export type SmsSessionStep = "NONE" | "SELECT_CANCEL" | "CONFIRM_CANCEL";

export interface iSmsSession extends mongoose.Document {
  key: string;        // from|to
  fromPhone: string;  // client
  toPhone: string;    // numéro Twilio du shop
  step: SmsSessionStep;

  // si plusieurs bookings à proposer : on stocke l'ordre proposé
  bookingIds?: string[];

  // booking sélectionné (après sélection, avant OUI)
  bookingId?: string;

  expiresAt: Date;    // TTL
}

const smsSessionSchema = new mongoose.Schema<iSmsSession>(
  {
    key: { type: String, required: true, unique: true, index: true },

    fromPhone: { type: String, required: true, index: true },
    toPhone: { type: String, required: true, index: true },

    step: { type: String, enum: ["NONE", "SELECT_CANCEL", "CONFIRM_CANCEL"], default: "NONE" },

    bookingIds: { type: [String], default: [] },
    bookingId: { type: String, required: false },

    // TTL
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// TTL index (Mongo supprimera après expiresAt)
smsSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<iSmsSession>("SmsSession", smsSessionSchema);
