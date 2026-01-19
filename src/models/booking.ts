import mongoose from "mongoose";

/**
 * Booking = réservation payée par le client
 * Sert de base unique pour :
 * - CA
 * - commissions
 * - paiements prestataires
 */
export interface iBooking extends mongoose.Document {
  title: string;
  establishmentName: string;
  productName: string;
  address: string;
  phoneNumber: string;

  clientId: string;
  userProId: string; // Prestataire
  serviceId: string;
  shopId: string;

  status:
    | "pending"
    | "refused"
    | "accepted"
    | "deleted"
    | "cancelled"
    | "finished"
    | "no-show-client"
    | "no-show-pro";

  price: string; // Prix total payé par le client
  serviceFee: string; // Frais plateforme
  commission: string; // Commission IzyGlam
  shopEarnings: string; // 💰 Montant à reverser au prestataire

  tva: string;

  date: string; // Affichage humain
  orderDate: Date; // Date de commande
  start: Date;
  end: Date;

  color: string;
  image: string;

  // ---- Validation prestation ----
  generatedCode: string;
  proCodeConfirmed: boolean;

  paymentIntentId?: string; // Stripe PaymentIntent

  // ✅ NOUVEAU : pour éviter double remboursement
  refundId?: string; // Stripe Refund id (re_...)
  refundedAt?: Date;

  reviewAdded: boolean;

  /**
   * 🔒 Clôture comptable
   * true = déjà inclus dans un payout hebdomadaire
   */
  closed: boolean;
  closedAt?: Date;
}

const bookingSchema = new mongoose.Schema<iBooking>(
  {
    // ---- Infos générales ----
    title: { type: String, required: true },
    establishmentName: { type: String, required: true },
    productName: { type: String, required: true },
    image: { type: String, required: false },

    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },

    // ---- Relations ----
    clientId: { type: String, required: true },
    userProId: { type: String, required: true },
    serviceId: { type: String, required: false },
    shopId: { type: String, required: true },

    // ---- Statut métier ----
    status: {
      type: String,
      enum: [
        "pending",
        "refused",
        "accepted",
        "deleted",
        "cancelled",
        "finished",
        "no-show-client",
        "no-show-pro",
      ],
      default: "pending",
      required: true,
    },

    // ---- Paiement ----
    price: { type: String, required: false },
    serviceFee: { type: String, required: false },
    commission: { type: String, required: false },
    shopEarnings: { type: String, required: false },
    tva: { type: String, required: false },

    paymentIntentId: { type: String, required: false },

    // ✅ NOUVEAU : refund tracking (idempotence)
    refundId: { type: String, required: false },
    refundedAt: { type: Date, required: false },

    // ---- Dates ----
    date: { type: String, required: true },
    orderDate: { type: Date, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },

    // ---- UI / UX ----
    color: { type: String, required: true },

    // ---- Validation prestation ----
    generatedCode: { type: String, required: false },
    proCodeConfirmed: { type: Boolean, default: false },

    // ---- Avis ----
    reviewAdded: { type: Boolean, default: false },

    // ---- 🔒 Clôture comptable ----
    closed: { type: Boolean, default: false },
    closedAt: { type: Date },
  },
  {
    timestamps: true, // utile pour audit / debug
  }
);

// Index utiles (optionnels mais recommandés)
bookingSchema.index({ shopId: 1, status: 1 });
bookingSchema.index({ paymentIntentId: 1 });
bookingSchema.index({ refundId: 1 });
bookingSchema.index({ shopId: 1, start: 1, end: 1 }, { unique: true });

const bookingModel = mongoose.model<iBooking>("Booking", bookingSchema);
export default bookingModel;
