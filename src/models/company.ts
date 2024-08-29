import mongoose from "mongoose";

export interface iCompany extends mongoose.Document {
  name: string;
  adminId: string; // Référence à l'administrateur de l'entreprise
  credit: number; // Crédit disponible pour l'entreprise
  siret: string; // Numéro SIRET de l'entreprise
  address: string; // Adresse de l'entreprise
  phone: string; // Numéro de téléphone de l'entreprise
  defaultPassword: string; // Numéro de téléphone de l'entreprise
  email: string; // Adresse e-mail de l'entreprise
  website?: string; // Site web de l'entreprise (optionnel)
  industry: string; // Secteur d'activité de l'entreprise
  createdAt: Date; // Date de création du compte
  updatedAt: Date; // Date de la dernière mise à jour du compte
}

const companySchema = new mongoose.Schema<iCompany>({
  name: { type: String, required: true },
  adminId: { type: String, required: true },
  credit: { type: Number, required: true, default: 0 },
  siret: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  defaultPassword: { type: String, required: false, default: "izyGl@m"+new Date().getFullYear()+"!" },
  email: { type: String, required: true },
  website: { type: String },
  industry: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

companySchema.pre<iCompany>("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const companyModel = mongoose.model<iCompany>("Company", companySchema);
export default companyModel;
