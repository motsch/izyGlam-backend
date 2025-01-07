import mongoose from "mongoose";

// Interface définissant la structure d'un document Conversation
export interface iConversation extends mongoose.Document {
  userId: string;
  messages: any[]; // Typage générique
  createdAt: Date;
}

// Schéma Mongoose pour le modèle Conversation
const conversationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Liste des ID des participants
  messages: { type: [Object], default: [] }, // Tableau générique pour les messages
  createdAt: { type: Date, default: Date.now },
});

// Création du modèle Conversation basé sur le schéma
const ConversationModel = mongoose.model<iConversation>("Conversation", conversationSchema);
export default ConversationModel;
