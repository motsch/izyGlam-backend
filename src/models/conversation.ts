// src/models/conversation.ts

import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage {
  _id?: Types.ObjectId;
  sender: Types.ObjectId;
  content?: string;
  contentFr?: string;
  messageType: "text" | "photo";
  mediaUrl?: string;
  createdAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  clientId?: string;
}

export type ConversationStatus = "open" | "closed";

export interface iConversation extends Document {
  participants: Types.ObjectId[];
  name?: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  flagged: boolean;
  user: any;
  bookingId?: Types.ObjectId;
  // ✅ NEW
  status: ConversationStatus;         // open/closed
  closedAt?: Date;                    // date de clôture
  bookingRef?: {
    title?: string;
    establishmentName?: string;
    productName?: string;
    date?: string;
    start?: Date;
    end?: Date;
    price?: string;
    status?: string;
    shopId?: string;
    clientId?: string;
    userProId?: string;
  };

}

const messageSchema = new Schema<IMessage>({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String },
  contentFr: { type: String },
  messageType: { type: String, enum: ["text", "photo"], default: "text" },
  mediaUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  clientId: { type: String, index: true },
});

const conversationSchema = new Schema<iConversation>({
  participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  name: { type: String },
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  flagged: { type: Boolean, default: false },
  user: { type: Object, required: false },

  // ✅ NEW
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: false, index: true },
  status: { type: String, enum: ["open", "closed"], default: "open", index: true },
  closedAt: { type: Date, required: false },

  bookingRef: {
    title: { type: String },
    establishmentName: { type: String },
    productName: { type: String },
    date: { type: String },
    start: { type: Date },
    end: { type: Date },
    price: { type: String },
    status: { type: String },
    shopId: { type: String },
    clientId: { type: String },
    userProId: { type: String },
  },

});

// Middleware pour mettre à jour updatedAt à chaque sauvegarde
conversationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// ✅ Recommandé : éviter les doublons de conversation pour un booking
conversationSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { bookingId: { $exists: true } } }
);

const ConversationModel = mongoose.model<iConversation>("Conversation", conversationSchema);
export default ConversationModel;
