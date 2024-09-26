import mongoose from "mongoose";
import { iUser } from "./user";

interface iReview {
  user: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
}

export interface iShop extends mongoose.Document {
  name: string;
  description: string;
  image: string;
  note: string;
  averagePrice: string;
  minimumDelay: string;
  type: string;
  ville: string;
  reviews: iReview[];
  maxDistance: number;
  idUser: string;
  services: string[];
  trad: string;
  promo?: {
    active: boolean;
    type: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  hours: {
    morning: {
      start: string;
      end: string;
    };
    afternoon: {
      start: string;
      end: string;
    };
  };
}

const shopSchema = new mongoose.Schema<iShop>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  note: { type: String, required: true },
  averagePrice: { type: String, required: false },
  minimumDelay: { type: String, required: false },
  type: { type: String, required: true },
  ville: { type: String, required: true },
  trad: { type: String, required: true },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      rating: { type: Number, required: false },
      comment: { type: String, required: false },
    },
  ],
  maxDistance: { type: Number, required: true },
  idUser: {
    type: String,
    required: true,
  },
  services: [
    { type: String, required: true },
  ],
  promo: {
    active: { type: Boolean, required: true },
    type: { type: String, required: true },
  },
  location: {
    latitude: { type: Number, required: false },
    longitude: { type: Number, required: false },
  },
  hours: {
    morning: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    afternoon: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
  },
});

const shopModel = mongoose.model<iShop>("Shop", shopSchema);
export default shopModel;
