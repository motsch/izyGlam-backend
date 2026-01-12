// controllers/orderController.ts
import * as express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";

import orderModel, { OrderChannel } from "../models/order";
import productModel from "../models/product"; // ton ProductModel sur catalogConnection
import { logger } from "../utils/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

type CheckoutItemInput = {
  productId: string; // Mongo _id
  qty: number;
};

function toCents(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}

function normalizeQty(qty: any): number {
  const n = Number(qty);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function getChannelFromUser(user: any): OrderChannel {
  // adapte à tes roles exacts si besoin
  const role = String(user?.role || "").toLowerCase();
  if (role.includes("pro") || role.includes("professionnel") || role.includes("provider")) return "PROVIDER";
  return "CLIENT";
}

/**
 * POST /api/orders/check
 * body:
 * {
 *   items: [{ productId, qty }],
 *   shippingAddress?: {...}  // optionnel pour l'instant
 * }
 */
export const checkOrder = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    const items: CheckoutItemInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, message: "Panier vide" });

    // validate ids
    const productIds = items
      .map((i) => String(i.productId || ""))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!productIds.length) return res.status(400).json({ ok: false, message: "Aucun productId valide" });

    // Fetch products from catalog DB
    const products = await productModel
      .find({ _id: { $in: productIds } })
      .select({
        title: 1,
        coverImage: 1,
        images: 1,
        "pricing.retailPrice": 1,
        "pricing.currency": 1,
        "pricing.taxRate": 1,
        "stock.supplierQty": 1,
        "supplier.bigbuyId": 1,
      })
      .lean();

    const byId = new Map<string, any>();
    products.forEach((p: any) => byId.set(String(p._id), p));

    const lines: any[] = [];
    const errors: any[] = [];

    let currency = "EUR";
    let subtotal = 0;
    let taxes = 0; // on met à 0 pour l’instant (TTC/TODO plus tard)
    const shippingFee = 0;

    for (const input of items) {
      const pid = String(input.productId || "");
      const qty = normalizeQty(input.qty);
      if (!pid || !mongoose.Types.ObjectId.isValid(pid) || qty <= 0) continue;

      const p = byId.get(pid);
      if (!p) {
        errors.push({ code: "PRODUCT_NOT_FOUND", productId: pid });
        continue;
      }

      const unitPrice = Number(p?.pricing?.retailPrice) || 0;
      const taxRate = Number(p?.pricing?.taxRate) || 0;
      const available = Number(p?.stock?.supplierQty) || 0;

      currency = String(p?.pricing?.currency || currency);

      if (available <= 0) {
        errors.push({
          code: "OUT_OF_STOCK",
          productId: pid,
          title: p.title,
          available,
          requested: qty,
        });
      } else if (available < qty) {
        errors.push({
          code: "INSUFFICIENT_STOCK",
          productId: pid,
          title: p.title,
          available,
          requested: qty,
        });
      }

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      lines.push({
        productId: pid,
        supplierBigbuyId: p?.supplier?.bigbuyId,
        title: p.title,
        qty,
        unitPrice,
        taxRate,
        available,
        lineTotal,
      });
    }

    if (!lines.length) return res.status(400).json({ ok: false, message: "Aucune ligne valide" });

    // Ici plus tard : appel BigBuy "order/check" pour shipping & contraintes
    // TODO: integrate BigBuy check with shippingAddress

    const total = subtotal + taxes + shippingFee;

    const ok = errors.length === 0;

    logger.info({
      msg: "orders.check",
      ok,
      lines: lines.length,
      errors: errors.length,
      subtotal,
      taxes,
      shippingFee,
      total,
      durationMs: Date.now() - t0,
    });

    return res.json({
      ok,
      currency,
      lines,
      pricing: {
        subtotal,
        taxes,
        shippingFee,
        total,
      },
      errors,
    });
  } catch (e: any) {
    logger.error({ msg: "orders.check.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ ok: false, message: "Impossible de checker la commande" });
  }
};

/**
 * POST /api/orders/create-payment-intent
 * body:
 * {
 *   items: [{ productId, qty }],
 *   shippingAddress?: {...},
 *   customerEmail?: string,
 *   notes?: string
 * }
 *
 * -> crée Order en DB + PaymentIntent avec metadata.orderId
 */
export const createPaymentIntentForOrder = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    const user = (req as any).user;
    if (!user?._id) return res.status(401).json({ ok: false, message: "Unauthorized" });

    // 1) Re-check serveur (très important)
    // On réutilise la logique du checkOrder, mais en interne
    const fakeReq: any = { body: { items: req.body?.items, shippingAddress: req.body?.shippingAddress } };
    const checkRes: any = {
      jsonPayload: null as any,
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.jsonPayload = payload;
        return this;
      },
    };

    // @ts-ignore
    await checkOrder(fakeReq as express.Request, checkRes as express.Response);

    if (checkRes.statusCode !== 200) {
      return res.status(checkRes.statusCode).json(checkRes.jsonPayload);
    }

    const checked = checkRes.jsonPayload;
    if (!checked?.ok) {
      return res.status(409).json({
        ok: false,
        message: "Commande invalide",
        ...checked,
      });
    }

    const currency = String(checked.currency || "EUR").toLowerCase();
    const total = Number(checked?.pricing?.total) || 0;
    if (total <= 0) return res.status(400).json({ ok: false, message: "Total invalide" });

    // 2) Créer Order en DB (PENDING_PAYMENT)
    const channel = getChannelFromUser(user);

    const order = await orderModel.create({
      channel,
      buyerId: new mongoose.Types.ObjectId(String(user._id)),
      items: checked.lines.map((l: any) => ({
        productId: new mongoose.Types.ObjectId(String(l.productId)),
        supplierBigbuyId: l.supplierBigbuyId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
      })),
      status: "PENDING_PAYMENT",
    });

    // 3) Créer PaymentIntent Stripe avec metadata.orderId
    const customerEmail = String(req.body?.customerEmail || user.email || "").trim();

    const pi = await stripe.paymentIntents.create({
      amount: toCents(total),
      currency,
      receipt_email: customerEmail || undefined,
      metadata: {
        orderId: String(order._id),
        channel,
        buyerId: String(user._id),
      },
      automatic_payment_methods: { enabled: true },
    });

    logger.info({
      msg: "orders.create_payment_intent",
      orderId: String(order._id),
      paymentIntentId: pi.id,
      amount: toCents(total),
      currency,
      durationMs: Date.now() - t0,
    });

    return res.json({
      ok: true,
      orderId: String(order._id),
      clientSecret: pi.client_secret,
      amount: toCents(total),
      currency,
    });
  } catch (e: any) {
    logger.error({ msg: "orders.create_payment_intent.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ ok: false, message: "Impossible de créer le paiement" });
  }
};

/**
 * GET /api/orders/my
 */
export const getMyOrders = async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const orders = await orderModel
      .find({ buyerId: new mongoose.Types.ObjectId(String(user._id)) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ ok: true, items: orders });
  } catch (e: any) {
    logger.error({ msg: "orders.get_my.failed", errorMessage: (e as any)?.message, stack: (e as any)?.stack });
    return res.status(500).json({ ok: false, message: "Impossible de récupérer vos commandes" });
  }
};

/**
 * GET /api/orders/:id
 * (protection minimale: owner only)
 */
export const getOrderById = async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const id = String(req.params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ ok: false, message: "Invalid id" });

    const order = await orderModel.findById(id).lean();
    if (!order) return res.status(404).json({ ok: false, message: "Commande introuvable" });

    if (String(order.buyerId) !== String(user._id)) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }

    return res.json({ ok: true, item: order });
  } catch (e: any) {
    logger.error({ msg: "orders.get_by_id.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ ok: false, message: "Impossible de récupérer la commande" });
  }
};

module.exports = {
  checkOrder,
  createPaymentIntentForOrder,
  getMyOrders,
  getOrderById,
};
