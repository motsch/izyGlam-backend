import mongoose, { Schema, Document, Model } from "mongoose";

export type CompanyRoleKey = "employee" | "manager" | "executive";

export interface RoleCreditConfig {
  employee: number;
  manager: number;
  executive: number;
}

export interface iCompany extends Document {
  name: string;
  adminId: string;

  credit: number;
  nbEmployees: number;

  siret: string;
  address: string;
  phone: string;
  defaultPassword: string;
  email: string;
  website?: string;
  industry: string;

  createdAt: Date;
  updatedAt: Date;

  monthlyBaseCreditPerEmployee: number;
  monthlyTotalAmount: number;
  billingDayOfMonth: number;
  allowCustomEmployeeCredit: boolean;
  roleCreditConfig: RoleCreditConfig;

  // ✅ Stripe
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  /** ✅ Price Stripe : 1€ / mois (unit_amount=100) */
  stripePriceId?: string;

  /** ✅ Statut de subscription (synchro depuis Stripe webhook) */
  subscriptionStatus?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "unpaid"
    | "paused"
    | "unknown";

  /** ✅ fin de période Stripe (équivalent “date de fin d’abonnement” si non renouvelé) */
  abonnement_end?: Date | null;

  /** ✅ date de désactivation/cancel si besoin */
  canceledAt?: Date | null;

  /** ✅ 90 jours après abonnement_end => reset crédits employés */
  graceDaysAfterEnd: number;

  /** ✅ pour éviter de remettre à 0 tous les jours après la deadline */
  creditsZeroedAt?: Date | null;
}

const roleCreditConfigSchema = new Schema<RoleCreditConfig>(
  {
    employee: { type: Number, default: 100 },
    manager: { type: Number, default: 150 },
    executive: { type: Number, default: 200 },
  },
  { _id: false }
);

const companySchema = new Schema<iCompany>({
  name: { type: String, required: true },
  adminId: { type: String, required: true },

  credit: { type: Number, required: true, default: 0 },
  nbEmployees: { type: Number, required: true, default: 0 },

  siret: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },

  defaultPassword: {
    type: String,
    required: false,
    default: "izyGl@m" + new Date().getFullYear() + "!",
  },

  email: { type: String, required: true },
  website: { type: String },
  industry: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  monthlyBaseCreditPerEmployee: { type: Number, required: true, default: 0 },
  monthlyTotalAmount: { type: Number, required: true, default: 0 },

  billingDayOfMonth: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 28,
  },

  allowCustomEmployeeCredit: { type: Boolean, required: true, default: true },

  roleCreditConfig: {
    type: roleCreditConfigSchema,
    required: true,
    default: {
      employee: 100,
      manager: 150,
      executive: 200,
    },
  },

  // --- Stripe ---
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  stripePriceId: { type: String },

  subscriptionStatus: {
    type: String,
    enum: [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "incomplete",
      "unpaid",
      "paused",
      "unknown",
    ],
    default: "unknown",
  },

  abonnement_end: { type: Date, default: null },
  canceledAt: { type: Date, default: null },

  graceDaysAfterEnd: { type: Number, default: 90 },
  creditsZeroedAt: { type: Date, default: null },
});

companySchema.pre<iCompany>("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const CompanyModel: Model<iCompany> = mongoose.model<iCompany>("Company", companySchema);
export default CompanyModel;
