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

// ✅ AJOUT STRIPE BILLING (Subscription)
interface SubscriptionInformation {
  plan?: "free" | "basic" | "pro" | "premium" | "custom";
  stripeCustomerId?: string; // cus_...
  stripeSubscriptionId?: string; // sub_...
  status?:
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused";
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

interface BankInformation {
  iban?: string;
  bic?: string;
  bank_name?: string;
  holder_name?: string;
  country?: string;
}

// ✅ STRIPE CONNECT (pour les pros / payouts)
interface StripeInformation {
  accountId?: string; // acct_...
  onboardingStatus?: "not_started" | "pending" | "complete";
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  weeklyPayoutConfigured?: boolean;
}

/** ✅ NEW : Note interne laissée par un prestataire sur un client */
interface ProClientNote {
  authorId: string;        // pro qui écrit
  shopId?: string;         // optionnel
  bookingId?: string;      // optionnel
  comment: string;
  createdAt: Date;
}

export interface iUser extends Document {
  lastname: string;
  firstname: string;
  active: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  facebook: any;
  instagram: any;

  bank?: BankInformation;
  stripe?: StripeInformation;
  subscription?: SubscriptionInformation; // ✅ AJOUT

  companyMonthlyCredit?: number;
  companyRole?: "employee" | "manager" | "executive";
  companyContractEnd?: Date | null;

  email: string;
  conversationId: string;
  password: string;
  phone: string;
  companyId: string;

  // ✅ IMPORTANT : ajout de "premium" pour matcher ton UI Angular
  abonnement: "free" | "basic" | "pro" | "premium" | "custom";
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
  managerId?: string;
  employeesIds?: string[];

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

  // Legacy (tu peux garder, mais à terme tu utiliseras subscription.stripeCustomerId)
  customerId?: string;

  fidelity: Fidelity;

  language: string;
  country: string;

  twilioPhoneNumber?: string;
  assistantProEnabled?: boolean;
  assistantShopId?: string;

  /** ✅ NEW : notes internes sur le client */
  proClientNotes?: ProClientNote[];

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

    // ✅ Manquait dans ton schema (mais présent dans l'interface)
    weeklyPayoutConfigured: { type: Boolean, default: false },
  },
  { _id: false }
);

// ✅ Sous-schema Stripe Billing (Subscription)
const SubscriptionInformationSchema = new Schema(
  {
    plan: {
      type: String,
      enum: ["free", "basic", "pro", "premium", "custom"],
      default: "free",
    },
    stripeCustomerId: { type: String }, // cus_...
    stripeSubscriptionId: { type: String }, // sub_...
    status: {
      type: String,
      enum: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { _id: false }
);

/** ✅ NEW : Sous-schema Mongoose pour les notes pro -> client */
const ProClientNoteSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "Users", required: true },

    // Optionnel : adapte les refs si tes modèles ont un autre nom
    shopId: { type: Schema.Types.ObjectId, ref: "Shops", required: false },
    bookingId: { type: Schema.Types.ObjectId, ref: "Bookings", required: false },

    comment: { type: String, required: true, trim: true, maxlength: 1500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new Schema<iUser>({
  lastname: { type: String, required: true },
  firstname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },

  bank: { type: BankInformationSchema, required: false },

  // Stripe Connect (payouts pro)
  stripe: { type: StripeInformationSchema, required: false },

  // ✅ Stripe Billing (subscription)
  subscription: { type: SubscriptionInformationSchema, required: false },

  conversationId: { type: String, required: false },
  companyId: { type: String, required: false },

  active: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },

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

  // ✅ IMPORTANT : ajout de premium
  abonnement: {
    type: String,
    required: false,
    enum: ["free", "basic", "pro", "premium", "custom"],
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

  // Legacy Stripe customer id (optionnel)
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

  twilioPhoneNumber: { type: String, required: false, index: true },
  assistantProEnabled: { type: Boolean, default: false },
  assistantShopId: { type: String, required: false, index: true },

  country: { type: String },

  /** ✅ NEW : Notes internes pro -> client */
  proClientNotes: { type: [ProClientNoteSchema], default: [] },

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
    default: "fr",
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
