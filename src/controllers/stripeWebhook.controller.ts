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
    // ✅ req.body est un Buffer grâce à express.raw()
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    /**
     * =====================================================
     *  A) BOOKINGS (assistant IzyGlam) - Checkout completed
     * =====================================================
     *
     * On se base sur checkout.session.completed
     * car ta metadata (bookingId, shopId, etc.) est posée sur la CheckoutSession.
     */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        const paymentIntentId = session.payment_intent ? String(session.payment_intent) : undefined;

        const booking: any = await bookingModel.findById(bookingId);
        if (!booking) {
          logger.warn({ msg: "stripe.webhook.booking_not_found", bookingId, eventId: event.id });
          return res.json({ received: true });
        }

        // ✅ idempotence simple :
        // si paymentIntentId déjà présent -> on considère que SMS déjà envoyé / booking déjà "mark paid"
        if (booking.paymentIntentId) {
          return res.json({ received: true });
        }

        // update booking : paymentIntentId, refunded info untouched
        booking.paymentIntentId = paymentIntentId || booking.paymentIntentId;

        // NOTE: ton business dit "réservation validée manuellement par le pro après paiement"
        // donc on NE PASSE PAS en "accepted" ici. On garde status = pending.
        await booking.save();

        // Charger shop & service pour SMS
        const shop: any = await shopModel.findById(booking.shopId).lean();
        const service: any = booking.serviceId ? await serviceModel.findById(booking.serviceId).lean() : null;

        const smsTo = String(booking.phoneNumber || session.metadata?.clientPhone || "").trim();
        const smsFrom = String(shop?.twilioPhoneNumber || session.metadata?.shopPhoneNumber || "").trim();

        // on préfère la valeur DB
        const code = String(booking.generatedCode || session.metadata?.generatedCode || "").trim();

        if (smsTo && smsFrom && code) {
          const smsBody = buildBookingPaidSms({
            shopName: shop?.name || "IzyGlam",
            serviceName: service?.name || booking.title || "Prestation",
            whenHuman: booking.date || "Date à confirmer",
            code,
          });

          try {
            await sendSms({ to: smsTo, from: smsFrom, body: smsBody });
            logger.info({ msg: "stripe.webhook.booking_sms_sent", bookingId: String(booking._id), eventId: event.id });
          } catch (smsErr: any) {
            logger.error({
              msg: "stripe.webhook.booking_sms_failed",
              bookingId: String(booking._id),
              errorMessage: smsErr?.message,
              stack: smsErr?.stack,
            });
            // on ne throw pas : paiement OK, SMS fail -> on ne bloque pas Stripe
          }
        } else {
          logger.warn({
            msg: "stripe.webhook.booking_sms_missing_data",
            bookingId: String(booking._id),
            smsToPresent: !!smsTo,
            smsFromPresent: !!smsFrom,
            codePresent: !!code,
          });
        }

        return res.json({ received: true });
      }
    }

    /**
     * =====================================================
     *  B) ORDERS (BigBuy) - Ton code existant
     * =====================================================
     */

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
        order.history.push({
          status: "SUPPLIER_ORDERED",
          note: "Already ordered at BigBuy",
          meta: { bigbuyOrderId: order.bigbuy.orderId },
          at: new Date(),
        });
        await order.save();
        return res.json({ received: true });
      }

      // passe en PAID
      order.status = "PAID";
      order.history.push({
        status: "PAID",
        note: "Stripe payment succeeded",
        meta: { paymentIntentId: pi.id },
        at: new Date(),
      });
      await order.save();

      // CREATE BigBuy order
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
        // paiement OK, BigBuy fail => on garde trace
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
            meta: { paymentIntentId: pi.id, lastPaymentError: (pi.last_payment_error as any)?.message },
            at: new Date(),
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


