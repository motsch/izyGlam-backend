import { Request, Response } from "express";
import Stripe from "stripe";
import orderModel from "../models/order";
import { bigbuyApi } from "../services/bigbuyApi.service";
import { logger } from "../utils/logger";

import { sendSms } from "../services/twilio.service";
import shopModel from "../models/shop";
import bookingModel from "../models/booking";
import serviceModel from "../models/service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function safeStr(v: any) {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

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

function buildBookingPaidSms(params: {
  shopName: string;
  serviceName: string;
  whenHuman: string;
  code: string;
}): string {
  const { shopName, serviceName, whenHuman, code } = params;

  return (
    `✅ Paiement confirmé\n` +
    `Salon : ${shopName}\n` +
    `Prestation : ${serviceName}\n` +
    `Quand : ${whenHuman}\n` +
    `Code : ${code}\n\n` +
    `↩️ Pour annuler : répondez ANNULER à ce SMS.\n` +
    `⛔️ Annulation impossible à moins de 24h (des frais peuvent s’appliquer).\n\n` +
    `Merci 💖`
  );
}

export const stripeWebhook = async (req: Request, res: Response) => {
  const startedAt = Date.now();

  // Logs "entrée" - attention: req.body est un Buffer (express.raw)
  try {
    const sig = req.headers["stripe-signature"];
    const contentType = req.headers["content-type"];
    const userAgent = req.headers["user-agent"];
    const bodyLen = Buffer.isBuffer(req.body) ? req.body.length : -1;

    logger.info({
      msg: "stripe.webhook.hit",
      method: req.method,
      url: req.originalUrl,
      hasSignature: !!sig,
      contentType,
      userAgent,
      bodyLen,
    });

    if (!sig) {
      logger.warn({ msg: "stripe.webhook.missing_signature" });
      return res.status(400).send("Missing stripe-signature");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      logger.error({
        msg: "stripe.webhook.construct_failed",
        errorMessage: err?.message,
        stack: err?.stack,
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    logger.info({
      msg: "stripe.webhook.event_parsed",
      eventId: event.id,
      type: event.type,
      elapsedMs: Date.now() - startedAt,
    });

    /**
     * =====================================================
     *  A) BOOKINGS (assistant IzyGlam) - Checkout completed
     * =====================================================
     */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      logger.info({
        msg: "stripe.webhook.checkout.completed",
        eventId: event.id,
        sessionId: session.id,
        paymentStatus: session.payment_status,
        mode: session.mode,
        paymentIntent: safeStr(session.payment_intent),
        metadataKeys: session.metadata ? Object.keys(session.metadata) : [],
        metadata: session.metadata || {},
      });

      // On ne traite que les paiements "paid"
      if (session.payment_status !== "paid") {
        logger.warn({
          msg: "stripe.webhook.checkout.not_paid_skip",
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
        return res.json({ received: true });
      }

      const bookingId = session.metadata?.bookingId;
      if (!bookingId) {
        logger.warn({
          msg: "stripe.webhook.booking.missing_bookingId_metadata",
          eventId: event.id,
          sessionId: session.id,
          metadata: session.metadata || {},
        });
        return res.json({ received: true });
      }

      const paymentIntentId = session.payment_intent ? String(session.payment_intent) : undefined;

      logger.info({
        msg: "stripe.webhook.booking.begin",
        bookingId,
        paymentIntentId,
      });

      const booking: any = await bookingModel.findById(bookingId);
      if (!booking) {
        logger.warn({
          msg: "stripe.webhook.booking.not_found",
          bookingId,
          eventId: event.id,
          sessionId: session.id,
        });
        return res.json({ received: true });
      }

      logger.info({
        msg: "stripe.webhook.booking.loaded",
        bookingId: String(booking._id),
        status: booking.status,
        hasPaymentIntentId: !!booking.paymentIntentId,
        bookingPaymentIntentId: safeStr(booking.paymentIntentId),
        phoneNumber: safeStr(booking.phoneNumber),
        shopId: safeStr(booking.shopId),
        serviceId: safeStr(booking.serviceId),
        generatedCodePresent: !!booking.generatedCode,
      });

      // ✅ idempotence: si déjà traité, on stop
      if (booking.paymentIntentId) {
        logger.info({
          msg: "stripe.webhook.booking.idempotent_skip",
          bookingId: String(booking._id),
          existingPaymentIntentId: safeStr(booking.paymentIntentId),
          incomingPaymentIntentId: safeStr(paymentIntentId),
        });
        return res.json({ received: true });
      }

      // update booking : paymentIntentId
      booking.paymentIntentId = paymentIntentId || booking.paymentIntentId;
      await booking.save();

      logger.info({
        msg: "stripe.webhook.booking.updated",
        bookingId: String(booking._id),
        paymentIntentId: safeStr(booking.paymentIntentId),
      });

      // Charger shop & service
      let shop: any = null;
      let service: any = null;

      try {
        shop = await shopModel.findById(booking.shopId).lean();
        logger.info({
          msg: "stripe.webhook.booking.shop_loaded",
          bookingId: String(booking._id),
          shopFound: !!shop,
          shopName: safeStr(shop?.name),
          shopTwilioPhone: safeStr(shop?.twilioPhoneNumber),
        });
      } catch (e: any) {
        logger.error({
          msg: "stripe.webhook.booking.shop_load_failed",
          bookingId: String(booking._id),
          errorMessage: e?.message,
          stack: e?.stack,
        });
      }

      try {
        if (booking.serviceId) {
          service = await serviceModel.findById(booking.serviceId).lean();
        }
        logger.info({
          msg: "stripe.webhook.booking.service_loaded",
          bookingId: String(booking._id),
          serviceFound: !!service,
          serviceName: safeStr(service?.name),
        });
      } catch (e: any) {
        logger.error({
          msg: "stripe.webhook.booking.service_load_failed",
          bookingId: String(booking._id),
          errorMessage: e?.message,
          stack: e?.stack,
        });
      }

      // Données SMS
      const smsTo = safeStr(booking.phoneNumber || session.metadata?.clientPhone).trim();
      const smsFrom = safeStr(shop?.twilioPhoneNumber || session.metadata?.shopPhoneNumber).trim();
      const code = safeStr(booking.generatedCode || session.metadata?.generatedCode).trim();

      logger.info({
        msg: "stripe.webhook.booking.sms.prepare",
        bookingId: String(booking._id),
        smsTo,
        smsFrom,
        codePresent: !!code,
        whenHuman: safeStr(booking.date),
      });

      if (!smsTo || !smsFrom || !code) {
        logger.warn({
          msg: "stripe.webhook.booking.sms.missing_data",
          bookingId: String(booking._id),
          smsToPresent: !!smsTo,
          smsFromPresent: !!smsFrom,
          codePresent: !!code,
          smsTo,
          smsFrom,
        });

        // ⚠️ On ne bloque pas Stripe
        return res.json({ received: true });
      }

      const smsBody = buildBookingPaidSms({
        shopName: safeStr(shop?.name || booking.establishmentName || "IzyGlam"),
        serviceName: safeStr(service?.name || booking.title || "Prestation"),
        whenHuman: safeStr(booking.date || "Date à confirmer"),
        code,
      });

      logger.info({
        msg: "stripe.webhook.booking.sms.sending",
        bookingId: String(booking._id),
        to: smsTo,
        from: smsFrom,
        bodyLen: smsBody.length,
      });

      try {
        const resp = await sendSms({ to: smsTo, from: smsFrom, body: smsBody });

        logger.info({
          msg: "stripe.webhook.booking.sms.sent",
          bookingId: String(booking._id),
          twilioMessageSid: safeStr((resp as any)?.sid),
          twilioStatus: safeStr((resp as any)?.status),
        });
      } catch (smsErr: any) {
        logger.error({
          msg: "stripe.webhook.booking.sms.failed",
          bookingId: String(booking._id),
          errorMessage: smsErr?.message,
          errorCode: smsErr?.code,
          moreInfo: smsErr?.moreInfo,
          status: smsErr?.status,
          stack: smsErr?.stack,
        });
        // ⚠️ Paiement OK, SMS fail -> on ne throw pas
      }

      logger.info({
        msg: "stripe.webhook.booking.done",
        bookingId: String(booking._id),
        elapsedMs: Date.now() - startedAt,
      });

      return res.json({ received: true });
    }

    /**
     * =====================================================
     *  B) ORDERS (BigBuy) - Code existant
     * =====================================================
     */

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;

      logger.info({
        msg: "stripe.webhook.pi.succeeded",
        eventId: event.id,
        piId: pi.id,
        status: pi.status,
        metadata: pi.metadata || {},
      });

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

      if (order.stripe?.lastStripeEventId === event.id) {
        logger.info({ msg: "stripe.webhook.order.idempotent_skip", orderId, eventId: event.id });
        return res.json({ received: true });
      }

      order.stripe.paymentIntentId = pi.id;
      order.stripe.paymentIntentStatus = pi.status;
      order.stripe.lastStripeEventId = event.id;

      if (order.bigbuy?.orderId) {
        order.status = "SUPPLIER_ORDERED";
        order.history.push({
          status: "SUPPLIER_ORDERED",
          note: "Already ordered at BigBuy",
          meta: { bigbuyOrderId: order.bigbuy.orderId },
          at: new Date(),
        });
        await order.save();
        return res.json({ received: true });
      }

      order.status = "PAID";
      order.history.push({
        status: "PAID",
        note: "Stripe payment succeeded",
        meta: { paymentIntentId: pi.id },
        at: new Date(),
      });
      await order.save();

      try {
        order.status = "SUPPLIER_PROCESSING";
        order.history.push({ status: "SUPPLIER_PROCESSING", note: "Sending order to BigBuy", at: new Date() });
        await order.save();

        const payload = buildBigBuyCreatePayloadFromOrder(order);
        const createResp = await bigbuyApi.createOrder(payload);

        const bigbuyOrderId = (createResp as any)?.order_id || (createResp as any)?.id || (createResp as any)?.orderId;

        order.bigbuy.lastCreateAt = new Date();
        order.bigbuy.lastCreateRaw = createResp;
        if (bigbuyOrderId) order.bigbuy.orderId = String(bigbuyOrderId);

        order.status = "SUPPLIER_ORDERED";
        order.history.push({
          status: "SUPPLIER_ORDERED",
          note: "BigBuy order created",
          meta: { bigbuyOrderId },
          at: new Date(),
        });

        await order.save();
      } catch (bbErr: any) {
        logger.error({
          msg: "bigbuy.create.failed",
          orderId: String(order._id),
          errorMessage: bbErr?.message,
          stack: bbErr?.stack,
        });

        order.status = "SUPPLIER_FAILED";
        order.history.push({
          status: "SUPPLIER_FAILED",
          note: "BigBuy order creation failed after payment",
          meta: { error: bbErr?.message },
          at: new Date(),
        });
        await order.save();
      }

      return res.json({ received: true });
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;

      logger.info({
        msg: "stripe.webhook.pi.failed",
        eventId: event.id,
        piId: pi.id,
        status: pi.status,
        metadata: pi.metadata || {},
        lastPaymentError: (pi.last_payment_error as any)?.message,
      });

      const orderId = pi.metadata?.orderId;
      if (orderId) {
        const order = await orderModel.findById(orderId);
        if (order) {
          order.stripe.paymentIntentId = pi.id;
          order.stripe.paymentIntentStatus = pi.status;
          order.stripe.lastStripeEventId = event.id;

          order.history.push({
            status: order.status,
            note: "Stripe payment failed (order kept pending)",
            meta: { paymentIntentId: pi.id, lastPaymentError: (pi.last_payment_error as any)?.message },
            at: new Date(),
          });

          await order.save();
        }
      }

      return res.json({ received: true });
    }

    logger.info({
      msg: "stripe.webhook.unhandled_event",
      eventId: event.id,
      type: event.type,
      elapsedMs: Date.now() - startedAt,
    });

    return res.json({ received: true });
  } catch (err: any) {
    logger.error({
      msg: "stripe.webhook.failed",
      errorMessage: err?.message,
      stack: err?.stack,
      elapsedMs: Date.now() - startedAt,
    });
    return res.status(500).send(err.message);
  }
};
