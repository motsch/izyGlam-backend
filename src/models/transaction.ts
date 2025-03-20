import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  // Pour le prestataire ou la plateforme (dans le cas de "earnings", "withdrawal", etc.)
  userProId?: string;
  // Pour le client (dans le cas de remboursements par exemple)
  idUser?: string;
  // Indique si la transaction est un crédit (entrée) ou un débit (sortie)
  operation: "credit" | "debit";
  // Catégorie de la transaction pour préciser l'origine
  category: "earnings" | "withdrawal" | "adjustment" | "refund" | "payout" | "penalty";
  // Montant de la transaction, exprimé en cents pour éviter les problèmes de précision
  amount: number;
  description: string;
  status: "pending" | "completed" | "failed";
  date: Date;
  // Optionnel : pour tracer l'origine (ex. id d'un booking)
  idBooking?: string;
}

const TransactionSchema: Schema = new Schema({
  userProId: { type: String, required: false },
  idUser: { type: String, required: false },
  operation: { type: String, enum: ["credit", "debit"], required: true },
  category: {
    type: String,
    enum: ["earnings", "withdrawal", "adjustment", "refund", "payout", "penalty"],
    required: true,
  },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    required: true,
  },
  date: { type: Date, default: Date.now },
  idBooking: { type: String, required: false },
});

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
