import mongoose from "mongoose";

export interface iServiceTemplate extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  type: string;
  price: number;
  duration: number; // En minutes
}

const serviceTemplateSchema = new mongoose.Schema<iServiceTemplate>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true }, // Durée de la prestation en minutes
});

const serviceTemplateModel = mongoose.model<iServiceTemplate>("ServiceTemplate", serviceTemplateSchema);
export default serviceTemplateModel;
