import mongoose from "mongoose";

export interface iServiceTemplate extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  type: string;
  price: number;
  duration: number; // En minutes
  color: string;
  active: boolean;
}

const serviceTemplateSchema = new mongoose.Schema<iServiceTemplate>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true }, // Durée de la prestation en minutes
  color: { type: String, required: true },
  active: { type: Boolean, default: false, required: true },
});

const serviceTemplateModel = mongoose.model<iServiceTemplate>("ServiceTemplate", serviceTemplateSchema);
export default serviceTemplateModel;
