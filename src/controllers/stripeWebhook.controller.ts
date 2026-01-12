import { Request, Response } from "express";
import Stripe from "stripe";
import orderModel from "../models/order";
import { bigbuyApi } from "../services/bigbuyApi.service";
import { logger } from "../utils/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function buildBigBuyCreatePayloadFromOrder(order: any) {
  const products = order.items.map((it: any) => ({
    id: it.supplierBigbuyId,
    quantity: it.qty,
  }));

  const address = {
    firstName: order.shippingAddress.firstName,
    lastName: order.shippingAddress.lastName,
    company: order.shippingAddress.company || "",
    address: order.shippingAddress.address1,
    address2: order.shippingAddress.address2 || "",
    city: order.shippingAddress.city,
    postalCode: order.shippingAddress.zipCode,
    country: order.shippingAddress.country, // "FR"
    phone: order.shippingAddress.phone,
    email: order.shippingAddress.email,
  };

  const carriers = order.bigbuy?.chosenShipping?.carriers ? order.bigbuy.chosenShipping.carriers : [];

  return {
    order: {
      internalReference: order.bigbuy.internalReference,
      language: order.bigbuy.language || "fr",
      paymentMethod: order.bigbuy.paymentMethod || "wallet",
      carriers,
      shippingAddress: address,
      products,
    },
  };
}

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ---- Payment succeeded ----
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;

      const orderId = pi.metadata?.orderId;
      if (!orderId) {
        logger.warn({ msg: "stripe.webhook.no_orderId", pi: pi.id });
        return res.json({ received: true });
      }

      const order = await orderModel.findById(orderId);
      if (!order) {
        logger.warn({ msg: "stripe.webhook.order_not_found", orderId, pi: pi.id });
        return res.json({ received: true });
      }

      // idempotence
      if (order.stripe?.lastStripeEventId === event.id) {
        return res.json({ received: true });
      }

      order.stripe.paymentIntentId = pi.id;
      order.stripe.paymentIntentStatus = pi.status;
      order.stripe.lastStripeEventId = event.id;

      // si déjà commandé chez BigBuy, stop
      if (order.bigbuy?.orderId) {
        order.status = "SUPPLIER_ORDERED";
        order.history.push({ status: "SUPPLIER_ORDERED", note: "Already ordered at BigBuy", meta: { bigbuyOrderId: order.bigbuy.orderId }, at: new Date() });
        await order.save();
        return res.json({ received: true });
      }

      // passe en PAID
      order.status = "PAID";
      order.history.push({ status: "PAID", note: "Stripe payment succeeded", meta: { paymentIntentId: pi.id }, at: new Date() });
      await order.save();

      // CREATE BigBuy order
      try {
        order.status = "SUPPLIER_PROCESSING";
        order.history.push({ status: "SUPPLIER_PROCESSING", note: "Sending order to BigBuy", at: new Date() });
        await order.save();

        const payload = buildBigBuyCreatePayloadFromOrder(order);
        const createResp = await bigbuyApi.createOrder(payload);

        const bigbuyOrderId = createResp?.order_id || createResp?.id || createResp?.orderId;

        order.bigbuy.lastCreateAt = new Date();
        order.bigbuy.lastCreateRaw = createResp;
        if (bigbuyOrderId) order.bigbuy.orderId = String(bigbuyOrderId);

        order.status = "SUPPLIER_ORDERED";
        order.history.push({
          status: "SUPPLIER_ORDERED",
          note: "BigBuy order created",
          meta: { bigbuyOrderId }, at: new Date()
        });

        await order.save();
      } catch (bbErr: any) {
        // paiement OK, BigBuy fail => on garde trace
        logger.error({ msg: "bigbuy.create.failed", orderId: String(order._id), errorMessage: bbErr?.message, stack: bbErr?.stack });

        order.status = "SUPPLIER_FAILED";
        order.history.push({
          status: "SUPPLIER_FAILED",
          note: "BigBuy order creation failed after payment",
          meta: { error: bbErr?.message }, at: new Date()
        });
        await order.save();
      }

      return res.json({ received: true });
    }

    // ---- Payment failed ----
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.orderId;

      if (orderId) {
        const order = await orderModel.findById(orderId);
        if (order) {
          // règle: on laisse PENDING_PAYMENT
          order.stripe.paymentIntentId = pi.id;
          order.stripe.paymentIntentStatus = pi.status;
          order.stripe.lastStripeEventId = event.id;

          order.history.push({
            status: order.status,
            note: "Stripe payment failed (order kept pending)",
            meta: { paymentIntentId: pi.id, lastPaymentError: (pi.last_payment_error as any)?.message }, at: new Date()
          });

          await order.save();
        }
      }

      return res.json({ received: true });
    }

    // autres events -> ok
    return res.json({ received: true });
  } catch (err: any) {
    logger.error({ msg: "stripe.webhook.failed", errorMessage: err?.message, stack: err?.stack });
    return res.status(500).send(err.message);
  }
};
