import mongoose from "mongoose";

export interface iCity extends mongoose.Document {
  code_insee: string;
  nom: string;
  code_postal: string;
  dep_nom: string;
  reg_nom: string;
  pays: string;
  latitude: number;
  longitude: number;
}

const citySchema = new mongoose.Schema<iCity>({
  code_insee: { type: String, required: true },
  nom: { type: String, required: true },
  code_postal: { type: String },
  dep_nom: { type: String },
  reg_nom: { type: String },
  pays: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
});

const CityModel = mongoose.model<iCity>("City", citySchema);
export default CityModel;
