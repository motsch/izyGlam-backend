import mongoose from "mongoose";

export type AssistantStep = "ASK_SERVICE" | "ASK_SLOT" | "DONE";

export interface iAssistantSession extends mongoose.Document {
  callSid: string;
  userProId: string;
  shopId: string;
  fromPhone: string;
  step: AssistantStep;

  serviceId?: string;

  // 3 slots proposés au client (date/start/end)
  proposedSlots?: Array<{ date: string; start: string; end: string }>;

  createdAt: Date;
}

const assistantSessionSchema = new mongoose.Schema<iAssistantSession>(
  {
    callSid: { type: String, required: true, unique: true, index: true },
    userProId: { type: String, required: true, index: true },
    shopId: { type: String, required: true, index: true },
    fromPhone: { type: String, required: true, index: true },

    step: { type: String, enum: ["ASK_SERVICE", "ASK_SLOT", "DONE"], default: "ASK_SERVICE" },

    serviceId: { type: String, required: false },

    proposedSlots: {
      type: [
        {
          date: String,
          start: String,
          end: String,
        },
      ],
      required: false,
      default: [],
    },
  },
  { timestamps: true }
);

assistantSessionSchema.index({ fromPhone: 1, createdAt: -1 });

export default mongoose.model<iAssistantSession>("AssistantSession", assistantSessionSchema);
