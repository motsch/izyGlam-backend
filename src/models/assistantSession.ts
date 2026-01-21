import mongoose from "mongoose";

export type AssistantStep = "ASK_CATEGORY" | "ASK_SERVICE" | "ASK_SLOT" | "DONE";

export interface iAssistantSession extends mongoose.Document {
  callSid: string;
  userProId: string;
  shopId: string;
  fromPhone: string;
  step: AssistantStep;

  // Catégorie choisie (après ASK_CATEGORY)
  categoryId?: string;

  // Service choisi (après ASK_SERVICE)
  serviceId?: string;

  // Ordre exact proposé au téléphone (important pour que "tapez 2" reste stable)
  proposedCategoryIds?: string[];
  proposedServiceIds?: string[];

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

    step: { type: String, enum: ["ASK_CATEGORY", "ASK_SERVICE", "ASK_SLOT", "DONE"], default: "ASK_CATEGORY" },

    categoryId: { type: String, required: false },
    serviceId: { type: String, required: false },

    proposedCategoryIds: { type: [String], default: [] },
    proposedServiceIds: { type: [String], default: [] },

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
