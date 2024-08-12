import mongoose from "mongoose";

export interface iService extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  note: string;
  averagePrice: string;
  minimumDelay: string;
  delayScale: string;
  type: string;
  price: number;
  duration: number; // En minutes
  shopId: mongoose.Schema.Types.ObjectId; // Référence à la boutique où le service est proposé
}

const serviceSchema = new mongoose.Schema<iService>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  note: { type: String, required: true },
  averagePrice: { type: String, required: true },
  minimumDelay: { type: String, required: true },
  delayScale: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true }, // Durée de la prestation en minutes
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Shop", 
    required: true 
  },
});

const serviceModel = mongoose.model<iService>("Service", serviceSchema);
export default serviceModel;
