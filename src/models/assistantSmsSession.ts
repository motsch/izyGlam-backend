import mongoose, { Schema } from "mongoose";

export type SmsStep =
  | "IDLE"
  | "ASK_SERVICE"
  | "ASK_SLOT"
  | "WAIT_PAYMENT"
  | "DONE";

export type ProposedSlot = {
  date: string;  // "YYYY-MM-DD"
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
};

export interface iAssistantSmsSession extends mongoose.Document {
  shopId: string;
  userProId: string;
  toNumber: string;    // Twilio number (= pro number)
  fromPhone: string;   // client phone (E.164)
  step: SmsStep;

  serviceId?: string;
  proposedSlots?: ProposedSlot[];

  bookingId?: string;
  lastCheckoutUrl?: string;

  lastInboundBody?: string;
  lastInboundAt?: Date;

  // anti spam / debug
  attempts: number;

  // expire (optionnel)
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const proposedSlotSchema = new Schema<ProposedSlot>(
  {
    date: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const assistantSmsSessionSchema = new Schema<iAssistantSmsSession>(
  {
    shopId: { type: String, required: true, index: true },
    userProId: { type: String, required: true, index: true },

    toNumber: { type: String, required: true, index: true },
    fromPhone: { type: String, required: true, index: true },

    step: { type: String, required: true, default: "IDLE" },

    serviceId: { type: String, required: false },
    proposedSlots: { type: [proposedSlotSchema], default: [] },

    bookingId: { type: String, required: false },
    lastCheckoutUrl: { type: String, required: false },

    lastInboundBody: { type: String, required: false },
    lastInboundAt: { type: Date, required: false },

    attempts: { type: Number, default: 0 },

    // optionnel: tu pourras mettre un TTL plus tard
    expiresAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// Une session active par (shopId + fromPhone)
assistantSmsSessionSchema.index({ shopId: 1, fromPhone: 1 }, { unique: true });

const AssistantSmsSessionModel = mongoose.model<iAssistantSmsSession>(
  "AssistantSmsSession",
  assistantSmsSessionSchema
);

export default AssistantSmsSessionModel;
