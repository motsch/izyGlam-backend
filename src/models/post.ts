import mongoose from "mongoose";

// Interface définissant la structure d'un document Post
export interface iPost extends mongoose.Document {
  userId: string;
  scheduled_time: Date,
  month: number;
  year: number;
  content: string;
  imageUrl: string;
  platform: string;
  status: { type: String, default: 'pending' }
}

// Schéma Mongoose pour le modèle Post
const postSchema = new mongoose.Schema<iPost>({
  userId: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    required: true,
    default: 'pending'
  },
  scheduled_time: { 
    type: Date, 
    required: false 
  },
  platform: { 
    type: String, 
    required: false,
    default: 'Instagram'
  },
  imageUrl: { 
    type: String, 
    required: false 
  },
  month: { 
    type: Number, 
    required: true 
  },
  year: { 
    type: Number, 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
});

// Création du modèle Post basé sur le schéma
const PostModel = mongoose.model<iPost>("Post", postSchema);
export default PostModel;
