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
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no-show-client" | "no-show-pro"; // Statut de la réservation
  price: string;
  commission: string;
  date: Date; // Date et heure du passage de la commande
  start: Date; // Date et heure de début du créneau réservé
  end: Date; // Date et heure de fin du créneau réservé
  color: string;
  tva: string;
  shopEarnings: string;
}

const bookingSchema = new mongoose.Schema<iBooking>({
  title: { type: String, required: true },
  establishmentName: { type: String, required: true },
  productName: { type: String, required: true },
  address: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  tva: { type: String, required: true },
  shopEarnings: { type: String, required: true },
  clientId: { type: String, required: true },
  userProId: { type: String, required: true },
  serviceId: { type: String, required: true },
  shopId: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed", "no-show-client", "no-show-pro"],
    default: "pending",
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  commission: {
    type: String,
    required: true,
  },
  date: { type: Date, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  color: { type: String, required: true },
});

const bookingModel = mongoose.model<iBooking>("Booking", bookingSchema);
export default bookingModel;
