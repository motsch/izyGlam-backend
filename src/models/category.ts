import mongoose from "mongoose";

export interface iCategory extends mongoose.Document {
  name: string;
  description: string;
  descriptionTrad: string;
  icon: string;
  trad: string;
  color: string;
  filter: string;
  position: number;
  active: boolean;
}

const categorySchema = new mongoose.Schema<iCategory>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  filter: { type: String, required: true },
  descriptionTrad: { type: String, required: true },
  icon: { type: String, required: true },
  trad: { type: String, required: true },
  color: { type: String, required: true },
  position: { type: Number, unique: true, required: false },
  active: { type: Boolean, default: false, required: true },
});

// Fonction pour réorganiser les positions correctement
async function reorganizePositions() {
  const categories = await categoryModel.find().sort({ position: 1 });

  for (let i = 0; i < categories.length; i++) {
    if (categories[i].position !== i + 1) {
      categories[i].position = i + 1;
      await categories[i].save();
    }
  }
}

// Middleware avant de sauvegarder une nouvelle catégorie
categorySchema.pre<iCategory>("save", async function (next) {
  if (!this.position) {
    const lastCategory = await categoryModel.findOne().sort({ position: -1 });
    this.position = lastCategory ? lastCategory.position + 1 : 1;
  }

  await reorganizePositions();
  next();
});

const categoryModel = mongoose.model<iCategory>("Category", categorySchema);
export default categoryModel;
