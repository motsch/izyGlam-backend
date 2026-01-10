import mongoose from "mongoose";

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

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
        wholesalePrice?: number; // BigBuy
        retailPrice?: number;    // BigBuy
        salePrice?: number;      // ton prix affiché (si tu veux)
        currency: string;        // "EUR"
        taxRate?: number;        // ex: 21
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
    coverImage: string;
    imagesMeta: any;
    stock: {
        supplierQty?: number; // cache
        supplierUpdatedAt?: Date;
    };
    visibility: {
        status: ProductStatus;
        isFeatured: boolean;
        featuredRank?: number;
    };
    updatedAt: Date;
    createdAt: Date;
}

const productSchema = new mongoose.Schema<iProduct>(
    {
        url: { type: String },
        isoCode: { type: String, default: "fr" },
        descriptionHtml: { type: String },
        title: { type: String, required: true, trim: true },
        description: { type: String },
        manufacturerId: { type: Number },
        categoryId: { type: Number },
        taxonomyId: { type: Number },
        images: { type: [String], default: [] },
        tags: { type: [String], default: [] },
        weight: { type: Number },
        height: { type: Number },
        width: { type: Number },
        depth: { type: Number },
        condition: { type: String },
        logisticClass: { type: String },
        coverImage: { type: String },
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
                    // champs optionnels vus dans l'exemple
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
            provider: { type: String, enum: ["bigbuy"], required: true, default: "bigbuy" },
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
            // ✅ NEW (optionnel) : utile pour afficher “expédié sous X jours”
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
        visibility: {
            status: { type: String, enum: ["DRAFT", "ACTIVE", "ARCHIVED"], default: "DRAFT" },
            isFeatured: { type: Boolean, default: false },
            featuredRank: { type: Number },
        },
    },
    { timestamps: true }
);

// ✅ Index essentiels
productSchema.index({ "supplier.provider": 1, "supplier.bigbuyId": 1 }, { unique: true });
productSchema.index({ "supplier.sku": 1 });
productSchema.index({ "supplier.ean13": 1 });
productSchema.index({ "visibility.isFeatured": 1, "visibility.featuredRank": 1 });
productSchema.index({ taxonomyId: 1, "visibility.status": 1, updatedAt: -1 });
productSchema.index({ "visibility.status": 1, updatedAt: -1 });

const productModel = mongoose.model<iProduct>("Product", productSchema);
export default productModel;
