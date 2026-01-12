import mongoose, { Document, Schema } from "mongoose";

/**
 * =========================
 * Types
 * =========================
 */

export type OrderChannel = "CLIENT" | "PROVIDER";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SUPPLIER_PROCESSING"
  | "SUPPLIER_ORDERED"
  | "SUPPLIER_FAILED"
  | "SHIPPED"
  | "CANCELED"
  | "REFUNDED";

export type SupplierProvider = "bigbuy";
export type SupplierStatus = "IDLE" | "CHECKING" | "REJECTED" | "ORDERING" | "ORDERED" | "ERROR";

export interface iOrderItem {
  productId: mongoose.Types.ObjectId;

  // BigBuy product id
  supplierBigbuyId?: number;

  qty: number;

  // prix "shop" (ce que le client paye) en €
  unitPrice: number;

  // utile pour affichage / debug
  title?: string;
  sku?: string;
  ean?: string;

  taxRate?: number; // ex: 21
}

export interface iOrderShipping {
  firstName: string;
  lastName: string;
  company?: string;

  country: string; // "FR" idéalement
  address1: string;
  address2?: string;
  city: string;
  zipCode: string;

  phone: string;
  email: string;

  notes?: string;
}

export interface iOrderTotals {
  currency: "eur" | "EUR";
  subtotal: number; // €
  shippingFee: number; // €
  total: number; // €
  amountCents: number; // centimes (Stripe)
}

/**
 * Historique (audit trail)
 * ✅ at optionnel côté TS (la DB met Date.now)
 */
export interface iOrderHistoryEntry {
  status: OrderStatus;
  note?: string;
  meta?: any;
  at?: Date;
}

export interface iOrderStripe {
  customerId?: string;
  paymentIntentId?: string;
  paymentIntentStatus?: string;
  lastStripeEventId?: string;
}

export interface iOrderBigBuy {
  internalReference: string; // ref interne
  language?: string; // 'fr'
  paymentMethod?: string; // 'wallet'
  chosenShipping?: any;

  lastCheckAt?: Date;
  lastCheckRaw?: any;

  lastCreateAt?: Date;
  lastCreateRaw?: any;

  orderId?: string;
}

/**
 * ✅ Bloc supplier utilisé par processBigBuyForPaidOrder()
 * (CHECKING/ORDERING/ORDERED/ERROR...)
 */
export interface iOrderSupplier {
  provider?: SupplierProvider;
  status?: SupplierStatus;
  bigbuyOrderId?: string;
  updatedAt?: Date;
  lastError?: string | null;
}

export interface iOrder extends Document {
  channel: OrderChannel;
  buyerId: mongoose.Types.ObjectId;

  status: OrderStatus;

  items: iOrderItem[];

  // ✅ champ canon (utilisé dans webhook)
  shippingAddress: iOrderShipping;

  // ✅ alias "shipping" pour compat avec ton bigbuyOrderService actuel
  shipping?: iOrderShipping;

  totals: iOrderTotals;

  stripe: iOrderStripe;
  bigbuy: iOrderBigBuy;
  supplier?: iOrderSupplier;

  history: iOrderHistoryEntry[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * =========================
 * Schemas
 * =========================
 */

const OrderItemSchema = new Schema<iOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    supplierBigbuyId: { type: Number },

    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },

    title: { type: String },
    sku: { type: String },
    ean: { type: String },

    taxRate: { type: Number },
  },
  { _id: false }
);

const OrderShippingSchema = new Schema<iOrderShipping>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    company: { type: String },

    country: { type: String, required: true },
    address1: { type: String, required: true },
    address2: { type: String },
    city: { type: String, required: true },
    zipCode: { type: String, required: true },

    phone: { type: String, required: true },
    email: { type: String, required: true },

    notes: { type: String },
  },
  { _id: false }
);

const OrderTotalsSchema = new Schema<iOrderTotals>(
  {
    currency: { type: String, required: true, default: "eur" },
    subtotal: { type: Number, required: true, default: 0 },
    shippingFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    amountCents: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const OrderHistoryEntrySchema = new Schema<iOrderHistoryEntry>(
  {
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAID",
        "SUPPLIER_PROCESSING",
        "SUPPLIER_ORDERED",
        "SUPPLIER_FAILED",
        "SHIPPED",
        "CANCELED",
        "REFUNDED",
      ],
      required: true,
    },
    note: { type: String },
    meta: { type: Schema.Types.Mixed },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OrderStripeSchema = new Schema<iOrderStripe>(
  {
    customerId: { type: String },
    paymentIntentId: { type: String },
    paymentIntentStatus: { type: String },
    lastStripeEventId: { type: String },
  },
  { _id: false }
);

const OrderBigBuySchema = new Schema<iOrderBigBuy>(
  {
    internalReference: { type: String, required: true },
    language: { type: String, default: "fr" },
    paymentMethod: { type: String, default: "wallet" },

    chosenShipping: { type: Schema.Types.Mixed },

    lastCheckAt: { type: Date },
    lastCheckRaw: { type: Schema.Types.Mixed },

    lastCreateAt: { type: Date },
    lastCreateRaw: { type: Schema.Types.Mixed },

    orderId: { type: String },
  },
  { _id: false }
);

const OrderSupplierSchema = new Schema<iOrderSupplier>(
  {
    provider: { type: String, enum: ["bigbuy"] },
    status: { type: String, enum: ["IDLE", "CHECKING", "REJECTED", "ORDERING", "ORDERED", "ERROR"], default: "IDLE" },
    bigbuyOrderId: { type: String },
    updatedAt: { type: Date },
    lastError: { type: String, default: null },
  },
  { _id: false }
);

/**
 * =========================
 * Main schema
 * =========================
 */

const orderSchema = new Schema<iOrder>(
  {
    channel: { type: String, enum: ["CLIENT", "PROVIDER"], required: true },
    buyerId: { type: Schema.Types.ObjectId, required: true, ref: "Users" },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAID",
        "SUPPLIER_PROCESSING",
        "SUPPLIER_ORDERED",
        "SUPPLIER_FAILED",
        "SHIPPED",
        "CANCELED",
        "REFUNDED",
      ],
      default: "PENDING_PAYMENT",
    },

    items: { type: [OrderItemSchema], required: true },

    // ✅ champ canon
    shippingAddress: { type: OrderShippingSchema, required: true },

    totals: { type: OrderTotalsSchema, required: true },

    stripe: { type: OrderStripeSchema, required: true, default: () => ({}) },
    bigbuy: { type: OrderBigBuySchema, required: true },
    supplier: { type: OrderSupplierSchema, required: false, default: () => ({ status: "IDLE" }) },

    history: { type: [OrderHistoryEntrySchema], default: [] },
  },
  { timestamps: true }
);

/**
 * ✅ Alias : order.shipping <-> order.shippingAddress
 * Comme ça ton bigbuyOrderService peut continuer d'utiliser order.shipping
 */
orderSchema.virtual("shipping").get(function (this: any) {
  return this.shippingAddress;
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

/**
 * Indexes utiles
 */
orderSchema.index({ createdAt: -1 });
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ "bigbuy.orderId": 1 });
orderSchema.index({ "supplier.bigbuyOrderId": 1 });
orderSchema.index({ "stripe.paymentIntentId": 1 });

const OrderModel = mongoose.model<iOrder>("Order", orderSchema);
export default OrderModel;
