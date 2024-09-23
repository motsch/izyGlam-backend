import mongoose from "mongoose";

export interface iCategory extends mongoose.Document {
  name: string;
  description: string;
  descriptionTrad: string;
  icon: string;
  trad: string;
  color: number;
}

const categorySchema = new mongoose.Schema<iCategory>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  descriptionTrad: { type: String, required: true },
  icon: { type: String, required: true },
  trad: { type: String, required: true },
  color: { type: Number, required: true },
});

const categoryModel = mongoose.model<iCategory>("Category", categorySchema);
export default categoryModel;
