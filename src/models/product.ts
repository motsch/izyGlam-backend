import mongoose from "mongoose";

export interface iProduct extends mongoose.Document {
    title: string;
    description?: string;
    url?: string;
    isoCode?: string;
    descriptionHtml?: string;
    manufacturerId?: number;
    categoryId?: number;
    taxonomyId?: number;
    images: string[];
    tags: string[];
    weight?: number;
    height?: number;
    width?: number;
    depth?: number;
    condition?: string;
    logisticClass?: string;
    pricing: {
        wholesalePrice?: number;
        retailPrice?: number;
        salePrice?: number;
        currency: string;
        taxRate?: number;
    };
    supplier: {
        provider: "bigbuy";
        bigbuyId: number;
        sku?: string;
        ean13?: string;
        dateAdd?: Date;
        dateUpd?: Date;
        dateUpdStock?: Date;
        dateUpdImages?: Date;
        dateUpdDescription?: Date;
        dateUpdProperties?: Date;
        dateUpdCategories?: Date;
    };
    coverImage?: string;
    imagesMeta: any;
    stock: {
        supplierQty?: number;
        supplierUpdatedAt?: Date;
        byHandlingDays?: Array<{
            handlingDays: number;
            quantity: number;
        }>;
    };
    updatedAt: Date;
    createdAt: Date;
}

const productSchema = new mongoose.Schema<iProduct>(
    {
        url: { type: String },
        isoCode: { type: String, default: "fr" },
        title: { type: String, required: true, trim: true },
        description: { type: String },
        descriptionHtml: { type: String },

        manufacturerId: { type: Number },
        categoryId: { type: Number },
        taxonomyId: { type: Number },

        images: { type: [String], default: [] },
        coverImage: { type: String },

        tags: { type: [String], default: [] },

        weight: { type: Number },
        height: { type: Number },
        width: { type: Number },
        depth: { type: Number },

        condition: { type: String },
        logisticClass: { type: String },

        imagesMeta: {
            type: [
                {
                    id: { type: Number },
                    isCover: { type: Boolean, default: false },
                    name: { type: String },
                    url: { type: String },
                    position: { type: Number },
                    logo: { type: Boolean },
                    whiteBackground: { type: Boolean },
                    marketingPhoto: { type: Boolean },
                    packagingPhoto: { type: Boolean },
                    brand: { type: Boolean },
                    gpsrLabel: { type: Boolean },
                    gpsrWarning: { type: Boolean },
                    energyEfficiency: { type: Number },
                    icon: { type: Number },
                },
            ],
            default: [],
        },

        pricing: {
            wholesalePrice: { type: Number },
            retailPrice: { type: Number },
            salePrice: { type: Number },
            currency: { type: String, default: "EUR" },
            taxRate: { type: Number },
        },

        supplier: {
            provider: {
                type: String,
                enum: ["bigbuy"],
                required: true,
                default: "bigbuy",
            },
            bigbuyId: { type: Number, required: true },
            sku: { type: String },
            ean13: { type: String },
            dateAdd: { type: Date },
            dateUpd: { type: Date },
            dateUpdStock: { type: Date },
            dateUpdImages: { type: Date },
            dateUpdDescription: { type: Date },
            dateUpdProperties: { type: Date },
            dateUpdCategories: { type: Date },
        },

        stock: {
            supplierQty: { type: Number, default: 0 },
            supplierUpdatedAt: { type: Date },
            byHandlingDays: {
                type: [
                    {
                        handlingDays: { type: Number },
                        quantity: { type: Number },
                    },
                ],
                default: [],
            },
        },
    },
    { timestamps: true }
);

//
// ✅ INDEX NETTOYÉS ET UTILES
//

// Unicité fournisseur + produit BigBuy
productSchema.index(
    { "supplier.provider": 1, "supplier.bigbuyId": 1 },
    { unique: true }
);

// Recherches rapides fournisseur
productSchema.index({ "supplier.sku": 1 });
productSchema.index({ "supplier.ean13": 1 });

// Listing produits (catégorie / tri récent)
productSchema.index({ taxonomyId: 1, updatedAt: -1 });

// Tri global par date (home, nouveautés, etc.)
productSchema.index({ updatedAt: -1 });

const productModel = mongoose.model<iProduct>("Product", productSchema);
export default productModel;
