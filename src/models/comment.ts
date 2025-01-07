import mongoose from "mongoose";

// Interface pour un document Comment
export interface iComment extends mongoose.Document {
  platform: "facebook" | "instagram" | "linkedin" | "tiktok" | "bluesky" | "threads";
  postId: string; // ID du post sur lequel le commentaire a été fait
  commentId: string; // ID unique du commentaire sur la plateforme
  content: string; // Texte du commentaire
  author: {
    name: string; // Nom de l'auteur du commentaire
    platformId: string; // ID de l'utilisateur sur la plateforme
  };
  createdAt: Date; // Date de création du commentaire
  replied: boolean; // Indique si le commentaire a reçu une réponse
  reply?: {
    content: string; // Contenu de la réponse
    createdAt: Date; // Date de création de la réponse
  };
}

// Schéma Mongoose
const commentSchema = new mongoose.Schema<iComment>({
  platform: {
    type: String,
    required: true,
    enum: ["facebook", "instagram", "linkedin", "tiktok", "bluesky", "threads"],
  },
  postId: { type: String, required: true },
  commentId: { type: String, required: true, unique: true }, // Évite les doublons
  content: { type: String, required: true },
  author: {
    name: { type: String, required: true },
    platformId: { type: String, required: true },
  },
  createdAt: { type: Date, required: true },
  replied: { type: Boolean, required: true, default: false },
  reply: {
    content: { type: String, required: false },
    createdAt: { type: Date, required: false },
  },
});

const CommentModel = mongoose.model<iComment>("Comment", commentSchema);
export default CommentModel;
