import mongoose from "mongoose";

export interface iAdminSettings extends mongoose.Document {
  commissionRate: number; // Taux de commission sur les ventes
  serviceFee: number; // Frais de service
  bookingWindowWeeks: number; // Nombre de semaines affichées pour la prise de rendez-vous
  cancellationPolicy24h: number; // Politique d'annulation à moins de 24h (% du paiement)
  cancellationPolicy48h: number; // Politique d'annulation à moins de 48h (frais de service)
  minimumBookingNotice: number; // Délai minimum de réservation (en heures)
  taxRate: number; // Taux de TVA
}

const adminSettingsSchema = new mongoose.Schema<iAdminSettings>({
  commissionRate: {
    type: Number,
    default: 15, // Par défaut 15% de commission
    required: true,
  },
  serviceFee: {
    type: Number,
    default: 2.9, // Par défaut 2,90€ de frais de service
    required: true,
  },
  bookingWindowWeeks: {
    type: Number,
    default: 6, // Par défaut 6 semaines d'affichage des créneaux
    required: true,
  },
  cancellationPolicy24h: {
    type: Number,
    default: 50, // 50% de frais en cas d'annulation à moins de 24h
    required: true,
  },
  cancellationPolicy48h: {
    type: Number,
    default: 0, // Frais de service uniquement en cas d'annulation à moins de 48h
    required: true,
  },
  minimumBookingNotice: {
    type: Number,
    default: 24, // 24h de préavis minimum pour les réservations
    required: true,
  },
  taxRate: {
    type: Number,
    default: 20, // Taux de TVA initial (modifiable)
    required: true,
  },
});

const adminSettingsModel = mongoose.model<iAdminSettings>("AdminSettings", adminSettingsSchema);
export default adminSettingsModel;
