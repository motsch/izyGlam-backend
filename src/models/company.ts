import mongoose, { Schema, Document, Model } from "mongoose";

export type CompanyRoleKey = "employee" | "manager" | "executive";

export interface RoleCreditConfig {
  employee: number;
  manager: number;
  executive: number;
}

export interface iCompany extends Document {
  name: string;
  adminId: string;                // Référence à l'administrateur de l'entreprise
  credit: number;                 // Solde global disponible pour l'entreprise (diminue quand les salariés consomment)
  nbEmployees: number;
  siret: string;                  // Numéro SIRET de l'entreprise
  address: string;                // Adresse de l'entreprise
  phone: string;                  // Numéro de téléphone de l'entreprise
  defaultPassword: string;        // Mot de passe par défaut des nouveaux employés
  email: string;                  // Adresse e-mail de l'entreprise
  website?: string;               // Site web de l'entreprise (optionnel)
  industry: string;               // Secteur d'activité de l'entreprise
  createdAt: Date;                // Date de création du compte
  updatedAt: Date;                // Date de la dernière mise à jour du compte

  /** 💸 Montant mensuel par employé (valeur par défaut si pas de barème spécifique) */
  monthlyBaseCreditPerEmployee: number;

  /** 💸 Montant mensuel total (utilisé pour Stripe) */
  monthlyTotalAmount: number;

  /** 📅 Jour du mois de facturation (1–28) */
  billingDayOfMonth: number;

  /** ✅ Autorise des montants personnalisés par employé */
  allowCustomEmployeeCredit: boolean;

  /** 👔 Barème de crédit par rôle d'entreprise */
  roleCreditConfig: RoleCreditConfig;

  /** 🔗 Intégration Stripe (plus tard) */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const roleCreditConfigSchema = new Schema<RoleCreditConfig>(
  {
    employee: { type: Number, default: 100 },  // ex: 100€/mois
    manager:  { type: Number, default: 150 },  // ex: 150€/mois
    executive:{ type: Number, default: 200 },  // ex: 200€/mois
  },
  { _id: false }
);

const companySchema = new Schema<iCompany>({
  name: { type: String, required: true },
  adminId: { type: String, required: true },

  // 💰 Solde global de l’entreprise
  credit: { type: Number, required: true, default: 0 },

  nbEmployees: { type: Number, required: true, default: 0 },

  siret: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },

  // 💡 Mot de passe par défaut pour les nouveaux employés
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

  // --- Partie B2B / crédits ---

  monthlyBaseCreditPerEmployee: {
    type: Number,
    required: true,
    default: 0,
  },

  monthlyTotalAmount: {
    type: Number,
    required: true,
    default: 0,
  },

  billingDayOfMonth: {
    type: Number,
    required: true,
    default: 1, // 1er du mois
    min: 1,
    max: 28,
  },

  allowCustomEmployeeCredit: {
    type: Boolean,
    required: true,
    default: true,
  },

  roleCreditConfig: {
    type: roleCreditConfigSchema,
    required: true,
    default: {
      employee: 100,
      manager: 150,
      executive: 200,
    },
  },

  // --- Stripe (placeholder pour plus tard) ---
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
});

// Met à jour updatedAt automatiquement
companySchema.pre<iCompany>("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const CompanyModel: Model<iCompany> = mongoose.model<iCompany>(
  "Company",
  companySchema
);

export default CompanyModel;
