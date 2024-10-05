import mongoose from "mongoose";

export interface iService extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  type: string;
  price: number;
  duration: number; // En minutes
  shopId: string; // Référence à la boutique où le service est proposé
  color: string;
}

const serviceSchema = new mongoose.Schema<iService>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true }, // Durée de la prestation en minutes
  shopId: { 
    type: String, 
    required: true 
  },
  color: { type: String, required: true },
});

const serviceModel = mongoose.model<iService>("Service", serviceSchema);
export default serviceModel;
