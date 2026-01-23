// src/controllers/stripeWebhook.controller.ts
import { Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";

import orderModel from "../models/order";
import bookingModel from "../models/booking";
import serviceModel from "../models/service";
import shopModel from "../models/shop";
import UserModel from "../models/user";

import { bigbuyApi } from "../services/bigbuyApi.service";
import { sendSms } from "../services/twilio.service";
import { logger } from "../utils/logger";

import {
  provisionTwilioNumberForUser,
  deprovisionTwilioNumberForUser,
} from "../services/twilioProvision.service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

/**
 * Utils
 */
function safeStr(v: any) {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

function toDateFromUnixSeconds(sec?: number | null) {
  if (!sec || typeof sec !== "number") return null;
  return new Date(sec * 1000);
}

function isMongoId(v: any) {
  return typeof v === "string" && mongoose.isValidObjectId(v);
}

function extractGuestPhone(clientId?: string) {
  const v = String(clientId || "").trim();
  if (v.startsWith("guest:")) return v.slice("guest:".length).trim();
  return "";
}

function normalizeE164(raw: string) {
  const v = String(raw || "").trim().replace(/\s+/g, "");
  if (!v) return "";
  if (v.startsWith("+")) return v;
  if (/^0\d{9}$/.test(v)) return "+33" + v.slice(1);
  return v; // fallback
}

async function resolveClientPhone(booking: any): Promise<string> {
  // 1) source de vérité : booking.phoneNumber
  const direct = normalizeE164(booking?.phoneNumber);
  if (direct) return direct;

  // 2) guest:<phone>
  const guestPhone = normalizeE164(extractGuestPhone(booking?.clientId));
  if (guestPhone) return guestPhone;

  // 3) clientId = userId ?
  const clientId = String(booking?.clientId || "").trim();
  if (mongoose.isValidObjectId(clientId)) {
    const user: any = await UserModel.findById(clientId).select({ phone: 1 }).lean();
    const userPhone = normalizeE164(user?.phone);
    if (userPhone) return userPhone;
  }

  return "";
}

async function resolveProTwilioFrom(booking: any): Promise<string> {
  // booking.userProId = prestataire
  const proId = String(booking?.userProId || "").trim();
  if (!mongoose.isValidObjectId(proId)) return "";

  const pro: any = await UserModel.findById(proId).select({ twilioPhoneNumber: 1 }).lean();
  return normalizeE164(pro?.twilioPhoneNumber || "");
}

/**
 * ServiceMode
 * Chez toi c'est soit SALON soit DOMICILE.
 * (Si jamais une ancienne donnée "BOTH" traîne, on force DOMICILE par défaut.)
 */
function normalizeServiceMode(v: any): "SALON" | "DOMICILE" {
  const m = safeStr(v).toUpperCase().trim();
  if (m === "SALON") return "SALON";
  if (m === "DOMICILE") return "DOMICILE";
  return "DOMICILE";
}

function buildBigBuyCreatePayloadFromOrder(order: any) {
  const products = (order.items || []).map((it: any) => ({
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

function formatSalonAddress(shop: any): string {
  const place = shop?.placeAddress || {};
  const legal = shop?.legal || {};

  // priorité : placeAddress (adresse du salon), fallback : legal
  const line1 = safeStr(place.addressLine1 || legal.addressLine1).trim();
  const line2 = safeStr(place.addressLine2 || legal.addressLine2).trim();
  const postalCode = safeStr(place.postalCode || legal.postalCode).trim();
  const city = safeStr(place.city || legal.city).trim();
  const country = safeStr(place.country || legal.country).trim();

  const parts: string[] = [];
  if (line1) parts.push(line1);
  if (line2) parts.push(line2);
  const cityLine = [postalCode, city].filter(Boolean).join(" ");
  if (cityLine) parts.push(cityLine);
  if (country && country !== "FR") parts.push(country);

  return parts.join(", ");
}

function buildBookingPaidSms(params: {
  shopName: string;
  serviceName: string;
  whenHuman: string;
  code: string;
  serviceMode: "SALON" | "DOMICILE";
  salonAddress?: string;
}): string {
  const { shopName, serviceName, whenHuman, code, serviceMode, salonAddress } = params;

  const addressBlock = serviceMode === "SALON" && salonAddress ? `📍 Adresse : ${salonAddress}\n` : "";

  return (
    `✅ Paiement confirmé\n` +
    `Salon : ${shopName}\n` +
    `Prestation : ${serviceName}\n` +
    `Quand : ${whenHuman}\n` +
    addressBlock +
    `Code : ${code}\n\n` +
    `↩️ Pour annuler : répondez ANNULER à ce SMS.\n` +
    `⛔️ Annulation impossible à moins de 24h (des frais peuvent s’appliquer).\n\n` +
    `Merci 💖`
  );
}

/**
 * ✅ PREMIUM SYNC
 * - Quand user devient Premium (subscription active/trialing + plan premium) => shop.isPremium = true
 * - Quand user perd Premium => shop.isPremium = false
 *
 * Source shop:
 * 1) user.assistantShopId (prioritaire)
 * 2) fallback : Shop.idUser == user._id (string)
 */
async function setShopPremiumForUser(userId: string, isPremium: boolean) {
  try {
    const user: any = await UserModel.findById(userId).select({ assistantShopId: 1 }).lean();
    if (!user) return;

    const assistantShopId = safeStr(user.assistantShopId).trim();

    // 1) assistantShopId
    if (mongoose.isValidObjectId(assistantShopId)) {
      await shopModel.updateOne(
        { _id: assistantShopId },
        { $set: { isPremium } }
      );
      return;
    }

    // 2) fallback via idUser (chez toi c’est une string)
    await shopModel.updateOne(
      { idUser: String(userId) },
      { $set: { isPremium } }
    );
  } catch (e: any) {
    logger.error({
      msg: "shop.premium.sync.failed",
      userId,
      isPremium,
      errorMessage: e?.message,
      stack: e?.stack,
    });
  }
}

const SHOULD_DEPROVISION_ON_PAST_DUE = String(process.env.TWILIO_DEPROVISION_ON_PAST_DUE || "false") === "true";

export const stripeWebhook = async (req: Request, res: Response) => {
  const startedAt = Date.now();

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
     *  A) CHECKOUT COMPLETED
     *  - Subscriptions (Billing)
     *  - Bookings (assistant IzyGlam)
     * =====================================================
     */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // --- 1) SUBSCRIPTIONS checkout ---
      const isSubscriptionCheckout =
        session.mode === "subscription" || safeStr(session.metadata?.type) === "subscription";

      if (isSubscriptionCheckout) {
        logger.info({
          msg: "stripe.webhook.subscription.checkout.completed",
          eventId: event.id,
          sessionId: session.id,
          paymentStatus: session.payment_status,
          mode: session.mode,
          customer: safeStr(session.customer),
          subscription: safeStr(session.subscription),
          metadata: session.metadata || {},
        });

        const userId = safeStr(session.metadata?.userId).trim();
        const plan = (safeStr(session.metadata?.plan).trim() || "premium") as
          | "free"
          | "basic"
          | "pro"
          | "premium"
          | "custom";

        if (!isMongoId(userId)) {
          logger.warn({
            msg: "stripe.webhook.subscription.missing_or_invalid_userId_metadata",
            eventId: event.id,
            sessionId: session.id,
            userId,
            metadata: session.metadata || {},
          });
          return res.json({ received: true });
        }

        const customerId = safeStr(session.customer).trim();
        const subscriptionId = safeStr(session.subscription).trim();

        try {
          let stripeSub: Stripe.Subscription | null = null;
          if (subscriptionId) {
            stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
          }

          const status = safeStr(stripeSub?.status || "active");
          const currentPeriodEnd = stripeSub?.current_period_end
            ? new Date(stripeSub.current_period_end * 1000)
            : undefined;
          const cancelAtPeriodEnd = !!stripeSub?.cancel_at_period_end;

          const update: any = {
            "subscription.plan": plan,
            "subscription.stripeCustomerId": customerId || undefined,
            "subscription.stripeSubscriptionId": subscriptionId || undefined,
            "subscription.status": status,
            "subscription.currentPeriodEnd": currentPeriodEnd || undefined,
            "subscription.cancelAtPeriodEnd": cancelAtPeriodEnd,
          };

          // sync champ historique
          if (status === "active" || status === "trialing") {
            update.abonnement = plan;
            update.abonnement_end = currentPeriodEnd || null;
          } else {
            update.abonnement = "free";
            update.abonnement_end = null;
          }

          await UserModel.updateOne({ _id: userId }, { $set: update });

          logger.info({
            msg: "stripe.webhook.subscription.user_updated_from_checkout",
            userId,
            plan,
            customerId,
            subscriptionId,
            status,
            currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
            cancelAtPeriodEnd,
          });
        } catch (e: any) {
          logger.error({
            msg: "stripe.webhook.subscription.update_failed_from_checkout",
            userId,
            errorMessage: e?.message,
            stack: e?.stack,
          });
        }

        // ✅ IMPORTANT : on ACK, et on laisse lifecycle gérer Twilio + isPremium
        return res.json({ received: true });
      }

      // --- 2) BOOKING checkout ---
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
        clientId: safeStr(booking.clientId),
        userProId: safeStr(booking.userProId),
        shopId: safeStr(booking.shopId),
        serviceId: safeStr(booking.serviceId),
        generatedCodePresent: !!booking.generatedCode,
      });

      // idempotence: si déjà traité, on stop
      if (booking.paymentIntentId) {
        logger.info({
          msg: "stripe.webhook.booking.idempotent_skip",
          bookingId: String(booking._id),
          existingPaymentIntentId: safeStr(booking.paymentIntentId),
          incomingPaymentIntentId: safeStr(paymentIntentId),
        });
        return res.json({ received: true });
      }

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
          serviceMode: safeStr(shop?.serviceMode),
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

      if (!shop) {
        logger.warn({
          msg: "stripe.webhook.booking.shop_null",
          bookingId: String(booking._id),
          shopId: safeStr(booking.shopId),
        });
      }

      // Données SMS
      const smsTo = await resolveClientPhone(booking);
      const smsFrom = await resolveProTwilioFrom(booking);
      const code = safeStr(booking.generatedCode || session.metadata?.generatedCode).trim();

      logger.info({
        msg: "stripe.webhook.booking.sms.prepare",
        bookingId: String(booking._id),
        smsTo,
        smsFrom,
        toPresent: !!smsTo,
        fromPresent: !!smsFrom,
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
          bookingPhoneNumber: safeStr(booking.phoneNumber),
          bookingClientId: safeStr(booking.clientId),
          bookingUserProId: safeStr(booking.userProId),
          sessionClientPhone: safeStr(session.metadata?.clientPhone),
          sessionGeneratedCode: safeStr(session.metadata?.generatedCode),
        });
        return res.json({ received: true });
      }

      const serviceMode = normalizeServiceMode(shop?.serviceMode);
      const salonAddress = serviceMode === "SALON" ? formatSalonAddress(shop) : "";

      if (serviceMode === "SALON" && !salonAddress) {
        logger.warn({
          msg: "stripe.webhook.booking.salon_address_missing",
          bookingId: String(booking._id),
          shopId: safeStr(shop?._id),
        });
      }

      const smsBody = buildBookingPaidSms({
        shopName: safeStr(shop?.name || booking.establishmentName || "IzyGlam"),
        serviceName: safeStr(service?.name || booking.title || "Prestation"),
        whenHuman: safeStr(booking.date || "Date à confirmer"),
        code,
        serviceMode,
        salonAddress,
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
     *  B) SUBSCRIPTIONS (Stripe Billing) - Lifecycle events
     * =====================================================
     */
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = safeStr(sub.customer).trim();
      const subscriptionId = safeStr(sub.id).trim();
      const status = safeStr(sub.status).trim();
      const currentPeriodEnd = toDateFromUnixSeconds(sub.current_period_end);
      const cancelAtPeriodEnd = !!sub.cancel_at_period_end;

      logger.info({
        msg: "stripe.webhook.subscription.lifecycle",
        eventId: event.id,
        type: event.type,
        customerId,
        subscriptionId,
        status,
        currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
        cancelAtPeriodEnd,
      });

      const user: any = await UserModel.findOne({
        $or: [{ "subscription.stripeCustomerId": customerId }, { customerId: customerId }],
      });

      if (!user) {
        logger.warn({
          msg: "stripe.webhook.subscription.user_not_found",
          customerId,
          subscriptionId,
        });
        return res.json({ received: true });
      }

      const plan =
        (user.subscription?.plan as any) ||
        (safeStr((sub.metadata as any)?.plan) as any) ||
        "premium";

      const update: any = {
        "subscription.plan": plan,
        "subscription.stripeCustomerId": customerId || undefined,
        "subscription.stripeSubscriptionId": subscriptionId || undefined,
        "subscription.status": status,
        "subscription.currentPeriodEnd": currentPeriodEnd || undefined,
        "subscription.cancelAtPeriodEnd": cancelAtPeriodEnd,
      };

      const isActiveLike = status === "active" || status === "trialing";
      const isPremiumPlan = plan === "premium";

      if (isActiveLike) {
        update.abonnement = plan;
        update.abonnement_end = currentPeriodEnd || null;
      } else {
        update.abonnement = "free";
        update.abonnement_end = null;

        if (event.type === "customer.subscription.deleted") {
          update["subscription.status"] = "canceled";
        }
      }

      await UserModel.updateOne({ _id: user._id }, { $set: update });

      /**
       * ✅ SHOP Premium flag
       * - premium ON seulement si active/trialing ET plan premium
       * - sinon OFF
       */
      if (isActiveLike && isPremiumPlan) {
        await setShopPremiumForUser(String(user._id), true);
      } else {
        await setShopPremiumForUser(String(user._id), false);
      }

      /**
       * ✅ TWILIO
       * - Provision si premium actif
       * - Deprovision seulement si plus premium actif (canceled/incomplete/unpaid/etc.)
       *   (si cancel_at_period_end = true mais status active => on garde le numéro)
       */
      if (isActiveLike && isPremiumPlan) {
        try {
          await provisionTwilioNumberForUser(String(user._id));
        } catch (e: any) {
          logger.error({
            msg: "twilio.provision.failed_after_premium",
            userId: String(user._id),
            errorMessage: e?.message,
            stack: e?.stack,
          });
        }
      } else {
        try {
          // si pas premium actif => on coupe Twilio (fin abonnement réel)
          await deprovisionTwilioNumberForUser(String(user._id));
        } catch (e: any) {
          logger.error({
            msg: "twilio.deprovision.failed_after_unpremium",
            userId: String(user._id),
            errorMessage: e?.message,
            stack: e?.stack,
          });
        }
      }

      logger.info({
        msg: "stripe.webhook.subscription.user_updated_from_lifecycle",
        userId: String(user._id),
        plan,
        status,
        cancelAtPeriodEnd,
      });

      return res.json({ received: true });
    }

    /**
     * =====================================================
     *  C) SUBSCRIPTIONS - Invoice payment failed (optionnel)
     * =====================================================
     */
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = safeStr(invoice.customer).trim();

      logger.warn({
        msg: "stripe.webhook.invoice.payment_failed",
        eventId: event.id,
        customerId,
        invoiceId: invoice.id,
      });

      const user: any = await UserModel.findOne({
        $or: [{ "subscription.stripeCustomerId": customerId }, { customerId }],
      });

      if (user) {
        await UserModel.updateOne(
          { _id: user._id },
          {
            $set: {
              "subscription.status": "past_due",
              abonnement: "free",
              abonnement_end: null,
            },
          }
        );

        // Par défaut je ne coupe PAS Twilio sur past_due (trop brutal),
        // mais si tu veux, active l’env TWILIO_DEPROVISION_ON_PAST_DUE=true
        if (SHOULD_DEPROVISION_ON_PAST_DUE) {
          await setShopPremiumForUser(String(user._id), false);
          try {
            await deprovisionTwilioNumberForUser(String(user._id));
          } catch (e: any) {
            logger.error({
              msg: "twilio.deprovision.failed_after_past_due",
              userId: String(user._id),
              errorMessage: e?.message,
              stack: e?.stack,
            });
          }
        }
      }

      return res.json({ received: true });
    }

    /**
     * =====================================================
     *  D) ORDERS (BigBuy) - Code existant
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

      // idempotence simple
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

        const bigbuyOrderId =
          (createResp as any)?.order_id || (createResp as any)?.id || (createResp as any)?.orderId;

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
            meta: {
              paymentIntentId: pi.id,
              lastPaymentError: (pi.last_payment_error as any)?.message,
            },
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
