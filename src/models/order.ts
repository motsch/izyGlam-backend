import mongoose from "mongoose";

export type OrderChannel = "CLIENT" | "PROVIDER";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SUPPLIER_PROCESSING"
  | "SUPPLIER_ORDERED"
  | "SHIPPED"
  | "CANCELED"
  | "REFUNDED";

export interface iOrderItem {
  productId: mongoose.Types.ObjectId;
  supplierBigbuyId?: number;
  qty: number;
  unitPrice: number;
  taxRate?: number;
}

export interface iOrder extends mongoose.Document {
  channel: OrderChannel;
  buyerId: mongoose.Types.ObjectId; // clientId OU providerId
  items: iOrderItem[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new mongoose.Schema<iOrder>(
  {
    channel: { type: String, enum: ["CLIENT", "PROVIDER"], required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        supplierBigbuyId: { type: Number },
        qty: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        taxRate: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAID",
        "SUPPLIER_PROCESSING",
        "SUPPLIER_ORDERED",
        "SHIPPED",
        "CANCELED",
        "REFUNDED",
      ],
      default: "PENDING_PAYMENT",
    },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ "items.productId": 1 });

const orderModel = mongoose.model<iOrder>("Order", orderSchema);
export default orderModel;
