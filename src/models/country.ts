import mongoose from "mongoose";

export interface iCountry extends mongoose.Document {
    flag: string;
    name: string;               // Nom local/officiel (ex: "France")
    translation: string;        // Traduction principale (ex: "France" en EN -> "France", pour "Deutschland" -> "Germany")
    active: boolean;            // Pays activé/désactivé
    languages: string[];        // Liste des codes langue disponibles (ex: ["fr","en","es"])
    createdAt: Date;
    updatedAt: Date;
}

const countrySchema = new mongoose.Schema<iCountry>(
    {
        flag: { type: String, required: true }, // Chemin ou URL de l'image
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true,
        },
        translation: {
            type: String,
            required: true,
            trim: true,
        },
        active: {
            type: Boolean,
            default: false,
            index: true,
        },
        languages: [
            {
                type: String,
                trim: true,
                lowercase: true,
                match: /^[a-z]{2}$/, // code langue ISO-639-1 (2 lettres)
            },
        ],
    },
    { timestamps: true }
);

// Optionnel: normaliser les doublons "name" en message clair
countrySchema.post("save", function (error: any, _doc: iCountry, next: Function) {
    if (error?.code === 11000 && error?.keyPattern?.name) {
        next(new Error("Un pays avec ce nom existe déjà."));
    } else {
        next(error);
    }
});

const countryModel = mongoose.model<iCountry>("Country", countrySchema);
export default countryModel;
