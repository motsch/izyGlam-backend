import mongoose from "mongoose";
import { iUser } from "./user";
import { iService } from "./service";

export interface iReservation extends mongoose.Document {
  client: iUser;
  service: iService;
  date: Date;
  statut: string;
}

const reservationSchema = new mongoose.Schema<iReservation>({
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  date: { type: Date, required: true },
  statut: {
    type: String,
    required: true,
    enum: ["en attente", "confirmée", "annulée"],
  },
});

const reservationModel = mongoose.model<iReservation>(
  "Reservation",
  reservationSchema
);
export default reservationModel;
