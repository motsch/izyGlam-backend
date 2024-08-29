import mongoose from "mongoose";

// Interface définissant la structure d'un document Schedule
export interface iSchedule extends mongoose.Document {
  date: Date;
  coiffeuseId: string; // Référence à la coiffeuse
  boutiqueId: string; // Référence à la boutique
  morningSlots: Array<{
    clienntId: string | null;
    startTime: string;
    endTime: string;
    available: boolean;
  }>;
  afternoonSlots: Array<{
    clienntId: string | null;
    startTime: string;
    endTime: string;
    available: boolean;
  }>;
}

// Schéma Mongoose définissant la structure d'un Schedule
const scheduleSchema = new mongoose.Schema<iSchedule>({
  date: { type: Date, required: true },
  coiffeuseId: { type: String, required: true }, // Assure que l'ID de la coiffeuse est obligatoire
  boutiqueId: { type: String, required: true }, // Assure que l'ID de la boutique est obligatoire
  morningSlots: [
    {
      clientId: {type: String, required: false, default: null},
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      available: { type: Boolean, required: true, default: true }
    }
  ],
  afternoonSlots: [
    {
      clientId: {type: String, required: false, default: null},
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      available: { type: Boolean, required: true, default: true }
    }
  ]
});

// Modèle Mongoose pour le Schedule
const scheduleModel = mongoose.model<iSchedule>("Schedule", scheduleSchema);

export default scheduleModel;
