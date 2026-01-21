import mongoose from "mongoose";

export interface iServiceCategory extends mongoose.Document {
  name: string;
  description?: string;

  // Relations
  shopId: string;      // catégorie propre à un salon

  // UI / organisation
  color?: string;
  order?: number;      // pour tri manuel
}

const serviceCategorySchema = new mongoose.Schema<iServiceCategory>(
  {
    name: { type: String, required: true },
    description: { type: String },

    // ---- Relations ----
    shopId: { type: String, required: true },
    
    // ---- UI ----
    color: { type: String },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Index utiles
serviceCategorySchema.index({ shopId: 1, active: 1 });
serviceCategorySchema.index({ shopId: 1, name: 1 }, { unique: true });

const serviceCategoryModel = mongoose.model<iServiceCategory>("bookingcategories", serviceCategorySchema);
export default serviceCategoryModel;
