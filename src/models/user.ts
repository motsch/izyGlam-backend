import mongoose, { Document, Schema } from "mongoose";
const bcrypt = require("bcryptjs");

export interface iUser extends Document {
  lastname: string;
  firstname: string;
  email: string;
  password: string;
  phone: string;
  companyId: string;
  shopIds: string[]; // Modifié pour un tableau de strings
  credit: number;
  proches: Array<{
    lastname: string;
    firstname: string;
    email: string;
    phone: string;
  }>;
  address: Array<{
    street: string;
    city: string;
    code_postal: string;
    country: string;
    main: boolean;
  }>;
  role: "particulier" | "entreprise" | "professionnel";
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<iUser>({
  lastname: { type: String, required: true },
  firstname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  companyId: { type: String, required: false },
  shopIds: {
    type: [String], // Tableau de chaînes de caractères
    validate: {
      validator: function (v: string[]) {
        return v.length <= 5; // Validation pour un maximum de 5 boutiques
      },
      message: (props) =>
        `Un utilisateur ne peut posséder plus de 5 boutiques.`,
    },
  },
  credit: { type: Number, required: false, default: 0 },
  proches: [
    {
      lastname: { type: String, required: false },
      firstname: { type: String, required: false },
      email: { type: String, required: false },
      phone: { type: String, required: false },
    },
  ],
  address: [
    {
      street: { type: String, required: false },
      city: { type: String, required: false },
      code_postal: { type: String, required: false },
      country: { type: String, required: false },
      main: { type: Boolean, required: false, default: false },
    },
  ],
  role: {
    type: String,
    required: true,
    enum: ["user", "entreprise", "professionnel"],
  },
});

// Fonction de hachage du mot de passe avant de le sauvegarder en base de données
userSchema.pre<iUser>("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error: any) {
    next(error);
  }
});

// Méthode pour vérifier le mot de passe saisi lors de la connexion
userSchema.methods.comparePassword = async function (password: string) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error: any) {
    throw new Error(error);
  }
};

const UserModel = mongoose.model<iUser>("Users", userSchema);
export default UserModel;
