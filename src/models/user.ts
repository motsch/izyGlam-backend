import mongoose, { Document, Schema } from "mongoose";
const bcrypt = require("bcryptjs");

export interface iUser extends Document {
  lastname: string;
  firstname: string;
  facebook: any;
  instagram: any;
  linkedin: any;
  bluesky: any;
  x: any;
  thread: any;
  tiktok: any;
  email: string;
  conversationId: string;
  password: string;
  phone: string;
  companyId: string;
  abonnement: string;
  abonnement_end: Date | null;
  credit: number;
  favoriteShops: Array<string>;  // Modification pour que ce soit un array de strings
  sex: "male" | "female";
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
    floor: string;
    main: boolean;
  }>;
  role: "user" | "entreprise" | "professionnel" | "admin";
  shopCompany?: {
    name: string;
    adresse: string;
    etage: number;
    companyType: string;
    firstname: string;
    lastname: string;
    email: string;
    countryIndication: string;
    phone: string;
    ccvaccepted: boolean;
  };
  availability?: Array<{
    day: string;
    periods: Array<{
      start: string;
      end: string;
    }>;
  }>;
  unavailability?: Array<{
    start: Date;
    end: Date;
  }>;
  breaks?: {
    duration: string;
  };
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<iUser>({
  lastname: { type: String, required: true },
  abonnement: { type: String, required: false, default: "free" },
  facebook: {
    accessToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
    userId: { type: String, required: false }, // Facebook User ID
  },
  instagram: {
    accessToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
    businessAccountId: { type: String, required: false }, // Pour Instagram Business
  },
  linkedin: {
    accessToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
    userId: { type: String, required: false },
    email: { type: String, required: false },
  },
  tiktok: {
    accessToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
    userId: { type: String, required: false },
  },
  x: {
    accessToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
    userId: { type: String, required: false },
  },
  thread: {
    accessToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
    userId: { type: String, required: false },
  },
  bluesky: {
    handle: { type: String, required: false },
    accessToken: { type: String, required: false },
    refreshToken: { type: String, required: false },
    tokenExpiresAt: { type: Date, required: false },
  },  
  abonnement_end: { type: Date, required: false },
  firstname: { type: String, required: true },
  favoriteShops: { type: [String], default: [] },  // Modification ici pour stocker des strings
  sex: {
    type: String,
    required: true,
    enum: ["male", "female"],
  },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  shopCompany: { type: Object, required: false },
  companyId: { type: String, required: false },
  conversationId: { type: String, required: true },
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
      floor: { type: String, required: false },
      main: { type: Boolean, required: false, default: false },
    },
  ],
  role: {
    type: String,
    required: true,
    enum: ["user", "entreprise", "professionnel", "admin"],
  },
  availability: [
    {
      day: { type: String, required: false },
      periods: [
        {
          start: { type: String, required: false },
          end: { type: String, required: false },
        },
      ],
    },
  ],
  unavailability: [
    {
      start: { type: Date, required: false },
      end: { type: Date, required: false },
    },
  ],
  breaks: {
    duration: { type: String, required: false },
  },
  resetPasswordToken: { type: String, required: false },
  resetPasswordExpires: { type: Date, required: false },
});

// Hashing password before saving it to the database
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

// Method for comparing entered password during login
userSchema.methods.comparePassword = async function (password: string) {
  try {
    console.log(password)
    console.log(this.password)
    return await bcrypt.compare(password, this.password);
  } catch (error: any) {
    throw new Error(error);
  }
};

const UserModel = mongoose.model<iUser>("Users", userSchema);
export default UserModel;
