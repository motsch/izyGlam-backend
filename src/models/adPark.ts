import mongoose from "mongoose";

export interface iPlayground {
  title: string;
  description: string;
  button: string;
  image: string;
  action: string;
  extra?: string;
}

export interface iHero {
  videoBackground: boolean;
  background: string;
}

export interface iAdPark extends mongoose.Document {
  name: string;
  advertisementId: mongoose.Types.ObjectId;
  title: string;
  citation: string;
  playlist: string;
  hero: iHero;
  playgrounds: iPlayground[];
}

const heroSchema = new mongoose.Schema<iHero>(
  {
    videoBackground: { type: Boolean, required: true },
    background: { type: String, required: true },
  },
  { _id: false } // Pas de sous-ID car c'est un objet unique imbriqué
);

const playgroundSchema = new mongoose.Schema<iPlayground>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    button: { type: String, required: true },
    image: { type: String, required: true },
    action: { type: String, required: true },
    extra: { type: String, default: "" },
  },
  { _id: false } // Pas d'ID pour chaque playground sauf si tu veux les gérer individuellement
);

const adParkSchema = new mongoose.Schema<iAdPark>(
  {
    name: { type: String, required: true },
    advertisementId: { type: mongoose.Schema.Types.ObjectId, ref: "Advertisement", required: true },
    title: { type: String, required: true },
    citation: { type: String, required: true },
    playlist: { type: String, required: true },
    hero: { type: heroSchema, required: true },
    playgrounds: { type: [playgroundSchema], required: true },
  },
  { timestamps: true }
);

const adParkModel = mongoose.model<iAdPark>("adPark", adParkSchema);
export default adParkModel;
