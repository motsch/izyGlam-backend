import mongoose, { Document, Schema } from "mongoose";
const bcrypt = require("bcryptjs");

// Définis Fidelity
interface Fidelity {
  stars: number;
  card_expiration: Date;
  rewards_history: Array<{
    type: string;
    reward_name: string;
    reward_date: Date;
  }>;
}

interface BankInformation {
  iban?: string;
  bic?: string;
  bank_name?: string;
  holder_name?: string;
  country?: string;
}

// ✅ AJOUT STRIPE (Connect)
interface StripeInformation {
  accountId?: string; // acct_...
  onboardingStatus?: "not_started" | "pending" | "complete";
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  weeklyPayoutConfigured?: boolean; // 👈 AJOUT
}

export interface iUser extends Document {
  lastname: string;
  firstname: string;
  active: boolean; // ✅ nouvel indicateur d'activation
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  facebook: any;
  instagram: any;
  bank?: BankInformation;
  stripe?: StripeInformation; // ✅ AJOUT STRIPE
  linkedin: any;
  bluesky: any;
  companyMonthlyCredit?: number; // allocation mensuelle "théorique" de l'employé
  companyRole?: "employee" | "manager" | "executive"; // rôle interne à l'entreprise
  companyContractEnd?: Date | null; // date de fin de contrat (pour gérer les 90 jours de grâce)

  x: any;
  thread: any;
  tiktok: any;
  email: string;
  conversationId: string;
  password: string;
  phone: string;
  companyId: string;
  abonnement: "free" | "basic" | "pro" | "custom";
  abonnement_end: Date | null;
  credit: number;
  favoriteShops: Array<string>;
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
  createdAt: string;
  updatedAt: string;
  lastSeen: string;
  role: "user" | "entreprise" | "professionnel" | "admin" | "boss";
  managerId?: string; // ID du patron si ce user est un employé
  employeesIds?: string[]; // Liste des IDs des employés si ce user est un boss
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
  customerId?: string;
  fidelity: Fidelity;
  language: string; // ✅ langue préférée de l'utilisateur
  country: string;
  twilioPhoneNumber?: string; // ex: +337...
  assistantProEnabled?: boolean; // active le standard IA
  assistantShopId?: string;

  comparePassword(password: string): Promise<boolean>;
}

// Sous-schema pour les infos bancaires
const BankInformationSchema = new Schema(
  {
    iban: { type: String },
    bic: { type: String },
    bank_name: { type: String },
    holder_name: { type: String },
    country: { type: String },
  },
  { _id: false }
);

// ✅ Sous-schema Stripe Connect
const StripeInformationSchema = new Schema(
  {
    accountId: { type: String },
    onboardingStatus: {
      type: String,
      enum: ["not_started", "pending", "complete"],
      default: "not_started",
    },
    chargesEnabled: { type: Boolean, default: false },
    payoutsEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new Schema<iUser>({
  lastname: { type: String, required: true },
  firstname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  bank: { type: BankInformationSchema, required: false },
  stripe: { type: StripeInformationSchema, required: false }, // ✅ AJOUT STRIPE
  conversationId: { type: String, required: false },
  companyId: { type: String, required: false },
  active: { type: Boolean, default: false }, // ✅ par défaut à false
  emailVerificationToken: { type: String },

  companyMonthlyCredit: { type: Number, default: 0 },
  companyRole: {
    type: String,
    enum: ["employee", "manager", "executive"],
    default: "employee",
  },
  companyContractEnd: { type: Date },

  createdAt: { type: String },
  updatedAt: { type: String },
  lastSeen: { type: String },
  emailVerificationExpires: { type: Date },
  abonnement: {
    type: String,
    required: false,
    enum: ["free", "basic", "pro", "custom"],
    default: "free",
  },
  abonnement_end: { type: Date, required: false },
  credit: { type: Number, default: 0 },
  favoriteShops: { type: [String], default: [] },
  sex: {
    type: String,
    required: true,
    enum: ["male", "female"],
  },
  fidelity: {
    stars: { type: Number, default: 0 },
    card_expiration: { type: Date },
    rewards_history: [
      {
        type: { type: String },
        reward_name: { type: String, required: true },
        reward_date: { type: Date, required: true },
      },
    ],
  },
  proches: [
    {
      lastname: { type: String },
      firstname: { type: String },
      email: { type: String },
      phone: { type: String },
    },
  ],
  address: [
    {
      street: { type: String },
      city: { type: String },
      code_postal: { type: String },
      country: { type: String },
      floor: { type: String },
      main: { type: Boolean, default: false },
    },
  ],
  role: {
    type: String,
    required: true,
    enum: ["user", "entreprise", "professionnel", "admin", "boss"],
  },
  managerId: { type: String, required: false },
  employeesIds: { type: [String], default: [] },
  shopCompany: {
    type: Object,
    required: false,
  },
  availability: [
    {
      day: { type: String },
      periods: [
        {
          start: { type: String },
          end: { type: String },
        },
      ],
    },
  ],
  unavailability: [
    {
      start: { type: Date },
      end: { type: Date },
    },
  ],
  breaks: {
    duration: { type: String },
  },
  customerId: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  facebook: {
    accessToken: { type: String },
    tokenExpiresAt: { type: Date },
    userId: { type: String },
  },
  instagram: {
    accessToken: { type: String },
    tokenExpiresAt: { type: Date },
    businessAccountId: { type: String },
  },
  linkedin: {
    accessToken: { type: String },
    tokenExpiresAt: { type: Date },
    userId: { type: String },
    email: { type: String },
  },
  tiktok: {
    accessToken: { type: String },
    tokenExpiresAt: { type: Date },
    userId: { type: String },
  },
  x: {
    accessToken: { type: String },
    tokenExpiresAt: { type: Date },
    userId: { type: String },
  },
  thread: {
    accessToken: { type: String },
    tokenExpiresAt: { type: Date },
    userId: { type: String },
  },
  bluesky: {
    handle: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
  },
  twilioPhoneNumber: { type: String, required: false, index: true },
  assistantProEnabled: { type: Boolean, default: false },
  assistantShopId: { type: String, required: false, index: true },
  country: { type: String },
  language: {
    type: String,
    enum: [
      "ar",
      "be",
      "bn",
      "ca",
      "da",
      "de",
      "en",
      "es",
      "et",
      "eu",
      "fa",
      "fi",
      "fr",
      "gl",
      "hi",
      "id",
      "it",
      "ja",
      "ko",
      "ku",
      "ms",
      "nl",
      "pl",
      "pt",
      "ro",
      "ru",
      "so",
      "sq",
      "sv",
      "th",
      "tl",
      "tr",
      "uk",
      "vi",
      "zh",
    ],
    default: "fr", // ✅ valeur par défaut
  },
});

// Hash le mot de passe avant sauvegarde
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

// Méthode de comparaison du mot de passe
userSchema.methods.comparePassword = async function (password: string) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error: any) {
    throw new Error(error);
  }
};

const UserModel = mongoose.model<iUser>("Users", userSchema);
export default UserModel;
