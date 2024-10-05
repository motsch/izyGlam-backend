import mongoose, { Document, Schema } from "mongoose";
const bcrypt = require("bcryptjs");

export interface iUser extends Document {
  lastname: string;
  firstname: string;
  email: string;
  password: string;
  phone: string;
  companyId: string;
  credit: number;
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
    day: string;  // e.g., "Monday"
    periods: Array<{
      start: string;  // e.g., "09:00"
      end: string;    // e.g., "18:00"
    }>;
  }>;
  unavailability?: Array<{
    start: Date;
    end: Date;
  }>;
  breaks?: {
    duration: string;  // e.g., "00:20" for 20-minute buffer
  };
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<iUser>({
  lastname: { type: String, required: true },
  firstname: { type: String, required: true },
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
      day: { type: String, required: false },  // e.g., "Monday"
      periods: [
        {
          start: { type: String, required: false },  // e.g., "09:00"
          end: { type: String, required: false },    // e.g., "18:00"
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
    duration: { type: String, required: false },  // e.g., "00:20" for 20-minute buffer
  },
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
    return await bcrypt.compare(password, this.password);
  } catch (error: any) {
    throw new Error(error);
  }
};

const UserModel = mongoose.model<iUser>("Users", userSchema);
export default UserModel;
