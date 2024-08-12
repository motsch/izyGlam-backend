import mongoose from "mongoose";

export interface iBooking extends mongoose.Document {
  userId: mongoose.Schema.Types.ObjectId; // Référence à l'utilisateur qui fait la réservation
  serviceId: mongoose.Schema.Types.ObjectId; // Référence au service réservé
  shopId: mongoose.Schema.Types.ObjectId; // Référence à la boutique où le service est réservé
  date: Date; // Date et heure du créneau réservé
  status: "pending" | "confirmed" | "cancelled"; // Statut de la réservation
}

const bookingSchema = new mongoose.Schema<iBooking>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed", "no-show"],
    default: "pending",
  },
});

const bookingModel = mongoose.model<iBooking>("Booking", bookingSchema);
export default bookingModel;
