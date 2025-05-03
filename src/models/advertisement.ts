import mongoose from "mongoose";

// Interface définissant la structure d'un document Color
export interface iAdvertisement extends mongoose.Document {
    image: string;
    date_expiration: Date;
    lien: string;
    annonceur: string;
    budget: number;
    impressions: number;
    clics: number;
    taux_conversion: number;
    affichage_prioritaire: Boolean;
    temps_affichage_total: number;
    nombre_affichages_valides: number;
    type: "PREMIUM" | "CLASSIC"; // type de la publicité réservation
    temps_affichage_moyen: number; // Ce champ reste ici pour TypeScript, mais il est virtuel en base
}

// Schéma Mongoose pour le modèle advertisementM
const advertisementSchema = new mongoose.Schema<iAdvertisement>({
    image: { type: String, required: true },
    date_expiration: { type: Date, required: true },
    lien: { type: String, required: true },
    annonceur: { type: String, required: true },
    budget: { type: Number, default: 0 }, // Budget alloué
    impressions: { type: Number, default: 0 }, // Nombre d'affichages
    type: {
        type: String,
        enum: ["PREMIUM", "CLASSIC"],
        default: "CLASSIC",
        required: true,
    },
    clics: { type: Number, default: 0 }, // Nombre de clics
    taux_conversion: { type: Number, default: 0 }, // Clics / Impressions
    affichage_prioritaire: { type: Boolean, default: false },
    // ✅ Nouveaux champs pour le suivi du temps moyen d'affichage
    temps_affichage_total: { type: Number, default: 0 }, // Temps total d'affichage en secondes
    nombre_affichages_valides: { type: Number, default: 0 } // Nombre de fois où la pub a été vue suffisamment
    // ❌ temps_affichage_moyen supprimé ici car défini comme champ virtuel
});

// ✅ Ajouter un champ virtuel pour le temps moyen d'affichage
advertisementSchema.virtual("temps_affichage_moyen").get(function () {
    return this.nombre_affichages_valides > 0
        ? this.temps_affichage_total / this.nombre_affichages_valides
        : 0;
});

// ✅ Pour que le champ virtuel apparaisse dans les objets JSON renvoyés
advertisementSchema.set("toJSON", {
    virtuals: true,
});

// Création du modèle basé sur le schéma
const AdvertisementModel = mongoose.model<iAdvertisement>("Advertisement", advertisementSchema);
export default AdvertisementModel;
