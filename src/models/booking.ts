import mongoose from "mongoose";

export interface iBooking extends mongoose.Document {
  clientId: string;
  userProId: string; // Référence à l'utilisateur qui fait la réservation
  serviceId: string; // Référence au service réservé
  shopId: string; // Référence à la boutique où le service est réservé
  date: Date; // Date et heure du créneau réservé
  status: "pending" | "confirmed" | "cancelled"; // Statut de la réservation
  price: string;
  commission: string;
}

const bookingSchema = new mongoose.Schema<iBooking>({
  clientId: { type: String, required: true },
  userProId: { type: String, ref: "User", required: true },
  serviceId: { type: String, ref: "Service", required: true },
  shopId: { type: String, ref: "Shop", required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed", "no-show"],
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
});

const bookingModel = mongoose.model<iBooking>("Booking", bookingSchema);
export default bookingModel;
