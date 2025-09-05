import mongoose from "mongoose";

export interface iBooking extends mongoose.Document {
  title: string;
  establishmentName: string;
  productName: string;
  address: string;
  phoneNumber: string;
  clientId: string;
  userProId: string; // Référence à l'utilisateur qui fait la réservation
  serviceId: string; // Référence au service réservé
  shopId: string; // Référence à la boutique où le service est réservé
  status: "pending" | "refused" | "accepted" | "deleted" | "cancelled" | "finished" | "no-show-client" | "no-show-pro"; // Statut de la réservation
  price: string;
  commission: string;
  date: string; // Date et heure du passage de la commande
  orderDate: Date; // Date et heure du passage de la commande
  start: Date; // Date et heure de début du créneau réservé
  end: Date; // Date et heure de fin du créneau réservé
  color: string;
  tva: string;
  shopEarnings: string;
  reviewAdded: boolean;
  image: string;
  generatedCode: string;
  proCodeConfirmed: boolean;
  paymentIntentId?: string; // ID du paymentIntent Stripe
  closed: boolean;   // 👈 ajouté
  closedAt: Date,                    // 👈 ajouté
}

const bookingSchema = new mongoose.Schema<iBooking>({
  reviewAdded: { type: Boolean, default: false, required: false },
  title: { type: String, required: true },
  establishmentName: { type: String, required: true },
  image: { type: String, required: false },
  productName: { type: String, required: true },
  address: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  tva: { type: String, required: false },
  shopEarnings: { type: String, required: false },
  clientId: { type: String, required: true },
  userProId: { type: String, required: true },
  serviceId: { type: String, required: false },
  shopId: { type: String, required: true },
  closed: { type: Boolean, default: false },   // 👈 ajouté
  closedAt: { type: Date },                    // 👈 ajouté
  status: {
    type: String,
    enum: ["pending", "refused", "accepted", "deleted", "cancelled", "finished", "no-show-client", "no-show-pro"],
    default: "pending",
    required: true,
  },
  price: { type: String, required: false },
  commission: { type: String, required: false },
  date: { type: String, required: true },
  orderDate: { type: Date, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  color: { type: String, required: true },
  generatedCode: { type: String, required: false },
  proCodeConfirmed: { type: Boolean, default: false, required: false },
  paymentIntentId: { type: String, required: false }, // Champ ajouté pour stocker l'ID du paymentIntent
});

const bookingModel = mongoose.model<iBooking>("Booking", bookingSchema);
export default bookingModel;
