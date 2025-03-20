// src/models/conversation.ts

import mongoose, { Document, Schema, Types } from "mongoose";

// Interface pour un message dans une conversation
export interface IMessage {
  _id?: Types.ObjectId;
  sender: Types.ObjectId;  // Référence à l'utilisateur
  content?: string;        // Contenu textuel du message
  contentFr?: string;        // Contenu textuel du message
  messageType: "text" | "photo";
  mediaUrl?: string;       // URL de l'image si messageType === "photo"
  createdAt: Date;
  deleted?: boolean;       // Soft-delete (pour masquer aux utilisateurs classiques)
  deletedAt?: Date;
  deletedBy?: Types.ObjectId; // Référence à l'admin ayant supprimé le message
}

// Interface pour la conversation
export interface iConversation extends Document {
  participants: Types.ObjectId[]; // Liste des participants (User)
  name?: string;                  // Nom de la conversation (pour groupe)
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  user: any;
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
  deletedBy: { type: Schema.Types.ObjectId, ref: "User" }
});

const conversationSchema = new Schema<iConversation>({
  participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  name: { type: String },
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  user: { type: Object, required: false  },
});

// Middleware pour mettre à jour updatedAt à chaque sauvegarde
conversationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const ConversationModel = mongoose.model<iConversation>("Conversation", conversationSchema);
export default ConversationModel;
