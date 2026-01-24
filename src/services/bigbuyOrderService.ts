import OrderModel from "../models/order";
import { bigbuyApi } from "./bigbuyApi.service";
import { logger } from "../utils/logger";

type BigBuyCheckResult =
  | { ok: true; bigbuyCheckRaw?: any }
  | { ok: false; reason: string; bigbuyCheckRaw?: any };

/**
 * Build payload BigBuy depuis order (format officiel: { order: {...} })
 * IMPORTANT:
 * - internalReference: ton id interne (string)
 * - paymentMethod: "wallet" (BigBuy)
 * - carriers: vient du choix shipping (order.bigbuy.chosenShipping.carriers)
 */
function buildBigBuyOrderPayload(order: any) {
  const products = (order.items || []).map((it: any) => ({
    id: it.supplierBigbuyId,
    quantity: it.qty,
  }));

  const carriers = order.bigbuy?.chosenShipping?.carriers || [];

  return {
    order: {
      internalReference: order.bigbuy?.internalReference || String(order._id),
      language: order.bigbuy?.language || "fr",
      paymentMethod: order.bigbuy?.paymentMethod || "wallet",
      carriers,
      shippingAddress: {
        firstName: order.shippingAddress.firstName,
        lastName: order.shippingAddress.lastName,
        company: order.shippingAddress.company || "",
        address: order.shippingAddress.address1,
        address2: order.shippingAddress.address2 || "",
        city: order.shippingAddress.city,
        postalCode: order.shippingAddress.zipCode,
        country: order.shippingAddress.country, // idéalement "FR"
        phone: order.shippingAddress.phone,
        email: order.shippingAddress.email,
      },
      products,
    },
  };
}

export async function bigBuyPrecheck(orderId: string): Promise<BigBuyCheckResult> {
  const order = await OrderModel.findById(orderId).lean();
  if (!order) return { ok: false, reason: "Order not found" };

  // 1) vérifier supplierBigbuyId + qty
  for (const it of order.items || []) {
    if (!it.supplierBigbuyId) {
      return { ok: false, reason: `Missing supplierBigbuyId for productId=${String(it.productId)}` };
    }
    if (!it.qty || it.qty <= 0) {
      return { ok: false, reason: `Invalid qty for productId=${String(it.productId)}` };
    }
  }

  // 2) appeler BigBuy check (simulate)
  const payload = buildBigBuyOrderPayload(order);

  try {
    const checkResp = await bigbuyApi.checkOrder(payload);

    // (optionnel) tu peux y lire des totaux BigBuy (selon doc)
    // Exemple: checkResp.totalWithoutTaxesAndWithoutShippingCost, etc...
    return { ok: true, bigbuyCheckRaw: checkResp };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "BigBuy check failed", bigbuyCheckRaw: e?.response?.data };
  }
}

export async function bigBuyCreateOrder(orderId: string): Promise<{ bigbuyOrderId: string; raw: any }> {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.shippingAddress) throw new Error("Missing shipping data (order.shippingAddress)");

  const payload = buildBigBuyOrderPayload(order);

  const resp = await bigbuyApi.createOrder(payload);
  const bigbuyOrderId = resp?.order_id || resp?.id || resp?.orderId;

  if (!bigbuyOrderId) {
    throw new Error("BigBuy create order: missing orderId in response");
  }

  return { bigbuyOrderId: String(bigbuyOrderId), raw: resp };
}

/**
 * Process complet: CHECK -> ORDER -> ORDERED/REJECTED/ERROR
 */
export async function processBigBuyForPaidOrder(orderId: string) {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new Error("Order not found");

  if (order.supplier?.status === "ORDERED") return;

  // 1) supplier = CHECKING
  await OrderModel.findByIdAndUpdate(orderId, {
    $set: {
      "supplier.provider": "bigbuy",
      "supplier.status": "CHECKING",
      "supplier.updatedAt": new Date(),
      "supplier.lastError": null,
    },
  });

  const check = await bigBuyPrecheck(orderId);

  // log + store raw check
  await OrderModel.findByIdAndUpdate(orderId, {
    $set: {
      "bigbuy.lastCheckAt": new Date(),
      "bigbuy.lastCheckRaw": check.bigbuyCheckRaw || null,
    },
  });

  if (!check.ok) {
    await OrderModel.findByIdAndUpdate(orderId, {
      $set: {
        "supplier.status": "REJECTED",
        "supplier.lastError": check.reason,
        "supplier.updatedAt": new Date(),
      },
      $push: {
        history: {
          status: "SUPPLIER_FAILED",
          note: "BigBuy precheck rejected",
          meta: { reason: check.reason },
          at: new Date(),
        },
      },
    });

    logger.warn({ msg: "bigbuy.precheck.rejected", orderId, reason: check.reason });
    return;
  }

  // 2) supplier = ORDERING
  await OrderModel.findByIdAndUpdate(orderId, {
    $set: {
      "supplier.status": "ORDERING",
      "supplier.updatedAt": new Date(),
      "supplier.lastError": null,
    },
  });

  try {
    const { bigbuyOrderId, raw } = await bigBuyCreateOrder(orderId);

    await OrderModel.findByIdAndUpdate(orderId, {
      $set: {
        status: "SUPPLIER_ORDERED",
        "supplier.status": "ORDERED",
        "supplier.bigbuyOrderId": bigbuyOrderId,
        "supplier.updatedAt": new Date(),
        "bigbuy.orderId": bigbuyOrderId,
        "bigbuy.lastCreateAt": new Date(),
        "bigbuy.lastCreateRaw": raw,
      },
      $push: {
        history: {
          status: "SUPPLIER_ORDERED",
          note: "BigBuy order created",
          meta: { bigbuyOrderId },
          at: new Date(),
        },
      },
    });

    logger.info({ msg: "bigbuy.order.created", orderId, bigbuyOrderId });
  } catch (e: any) {
    await OrderModel.findByIdAndUpdate(orderId, {
      $set: {
        status: "SUPPLIER_FAILED",
        "supplier.status": "ERROR",
        "supplier.lastError": e?.message || "BigBuy error",
        "supplier.updatedAt": new Date(),
      },
      $push: {
        history: {
          status: "SUPPLIER_FAILED",
          note: "BigBuy create order failed",
          meta: { error: e?.message },
          at: new Date(),
        },
      },
    });

    logger.error({ msg: "bigbuy.order.failed", orderId, errorMessage: e?.message, stack: e?.stack });
    throw e;
  }
}
