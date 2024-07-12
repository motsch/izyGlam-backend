import mongoose from "mongoose";
import { iUser } from "./user";

export interface iShop extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  note: string;
  averagePrice: string;
  minimumDelay: string;
  delayScale: string;
  type: string;
  price: number;
  professionnel: iUser;
  services: string[];
}

const shopSchema = new mongoose.Schema<iShop>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  note: { type: String, required: true },
  averagePrice: { type: String, required: true },
  minimumDelay: { type: String, required: true },
  delayScale: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: Number, required: true },
  professionnel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  services: [{ type: String, required: true }],
});

const shopModel = mongoose.model<iShop>("Shop", shopSchema);
export default shopModel;
