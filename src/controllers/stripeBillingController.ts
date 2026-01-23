import { Request, Response } from "express";
import Stripe from "stripe";
import UserModel from "../models/user";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

// Petite sécurité: ne jamais accepter une URL venant du front
function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "https://izyglam.com").replace(/\/$/, "");
}

function safeStr(v: any) {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

function maskId(id: string) {
  if (!id) return "";
  if (id.length <= 10) return id;
  return id.slice(0, 6) + "..." + id.slice(-4);
}

export const createPremiumCheckoutSession = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const reqId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    // ✅ log entrée
    logger.info({
      msg: "stripe.billing.checkout_session.hit",
      reqId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      ua: safeStr(req.headers["user-agent"]),
      origin: safeStr(req.headers["origin"]),
      referer: safeStr(req.headers["referer"]),
      contentType: safeStr(req.headers["content-type"]),
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      elapsedMs: Date.now() - startedAt,
    });

    // ✅ Ici on récupère userId depuis le body
    const userId = String(req.body?.userId || "").trim();

    logger.info({
      msg: "stripe.billing.checkout_session.input",
      reqId,
      userId,
      isValidMongoId: mongoose.isValidObjectId(userId),
      elapsedMs: Date.now() - startedAt,
    });

    if (!userId || !mongoose.isValidObjectId(userId)) {
      logger.warn({
        msg: "stripe.billing.checkout_session.invalid_userId",
        reqId,
        userId,
        elapsedMs: Date.now() - startedAt,
      });
      return res.status(400).json({ message: "Missing or invalid userId" });
    }

    const user: any = await UserModel.findById(userId).lean();
    logger.info({
      msg: "stripe.billing.checkout_session.user_loaded",
      reqId,
      userFound: !!user,
      userId,
      email: safeStr(user?.email),
      abonnement: safeStr(user?.abonnement),
      subPlan: safeStr(user?.subscription?.plan),
      subStatus: safeStr(user?.subscription?.status),
      cancelAtPeriodEnd: !!user?.subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: user?.subscription?.currentPeriodEnd
        ? new Date(user.subscription.currentPeriodEnd).toISOString()
        : null,
      elapsedMs: Date.now() - startedAt,
    });

    if (!user) {
      logger.warn({
        msg: "stripe.billing.checkout_session.user_not_found",
        reqId,
        userId,
        elapsedMs: Date.now() - startedAt,
      });
      return res.status(404).json({ message: "User not found" });
    }

    const priceId = safeStr(process.env.STRIPE_PRICE_PREMIUM).trim();
    logger.info({
      msg: "stripe.billing.checkout_session.env",
      reqId,
      hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
      stripeApiVersion: safeStr(process.env.STRIPE_API_VERSION),
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasPriceId: !!priceId,
      priceIdMasked: maskId(priceId),
      frontendUrl: getFrontendUrl(),
      elapsedMs: Date.now() - startedAt,
    });

    if (!priceId) {
      logger.error({
        msg: "stripe.billing.checkout_session.missing_price_id",
        reqId,
        envKey: "STRIPE_PRICE_PREMIUM",
        elapsedMs: Date.now() - startedAt,
      });
      return res.status(500).json({ message: "Missing STRIPE_PRICE_PREMIUM" });
    }

    /**
     * ✅ éviter de recréer si déjà premium actif
     */
    const subStatus = safeStr(user?.subscription?.status);
    const subPlan = safeStr(user?.subscription?.plan);
    const currentPeriodEnd = user?.subscription?.currentPeriodEnd || null;

    const isAlreadyPremiumActive =
      (subPlan === "premium" || safeStr(user?.abonnement) === "premium") &&
      (subStatus === "active" || subStatus === "trialing") &&
      !user?.subscription?.cancelAtPeriodEnd;

    logger.info({
      msg: "stripe.billing.checkout_session.already_active_check",
      reqId,
      subPlan,
      subStatus,
      abonnement: safeStr(user?.abonnement),
      cancelAtPeriodEnd: !!user?.subscription?.cancelAtPeriodEnd,
      isAlreadyPremiumActive,
      elapsedMs: Date.now() - startedAt,
    });

    if (isAlreadyPremiumActive) {
      const frontend = getFrontendUrl();
      const redirectUrl = `${frontend}/thank-you?alreadyActive=1`;

      logger.warn({
        msg: "stripe.billing.checkout_session.skip_already_active",
        reqId,
        userId,
        redirectUrl,
        elapsedMs: Date.now() - startedAt,
      });

      return res.status(200).json({
        alreadyActive: true,
        url: redirectUrl, // ✅ on renvoie une vraie URL
        sessionId: null,
        subscription: {
          plan: "premium",
          status: subStatus,
          currentPeriodEnd,
        },
        message: "Subscription already active",
      });
    }


    /**
     * 1) Customer Stripe (réutilise si déjà présent)
     */
    let customerId = safeStr(user?.subscription?.stripeCustomerId || user?.customerId).trim();

    logger.info({
      msg: "stripe.billing.checkout_session.customer.resolve",
      reqId,
      hasExistingCustomerId: !!customerId,
      customerIdMasked: maskId(customerId),
      elapsedMs: Date.now() - startedAt,
    });

    if (!customerId) {
      logger.info({
        msg: "stripe.billing.checkout_session.customer.create.begin",
        reqId,
        userId,
        email: safeStr(user.email),
        name: `${safeStr(user.firstname)} ${safeStr(user.lastname)}`.trim(),
        elapsedMs: Date.now() - startedAt,
      });

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
        metadata: { userId: String(userId) },
      });

      customerId = customer.id;

      logger.info({
        msg: "stripe.billing.checkout_session.customer.create.done",
        reqId,
        customerIdMasked: maskId(customerId),
        elapsedMs: Date.now() - startedAt,
      });

      await UserModel.updateOne(
        { _id: userId },
        {
          $set: {
            "subscription.stripeCustomerId": customerId,
            customerId: customerId, // legacy compat
          },
        }
      );

      logger.info({
        msg: "stripe.billing.checkout_session.customer.saved",
        reqId,
        userId,
        customerIdMasked: maskId(customerId),
        elapsedMs: Date.now() - startedAt,
      });
    }

    /**
     * (optionnel) Marquer pending dans Mongo
     */
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          "subscription.plan": "premium",
          "subscription.status": "incomplete", // pending
          "subscription.cancelAtPeriodEnd": false,
        },
      }
    );

    logger.info({
      msg: "stripe.billing.checkout_session.user_marked_pending",
      reqId,
      userId,
      elapsedMs: Date.now() - startedAt,
    });

    /**
     * 2) Checkout Session (subscription)
     */
    const frontend = getFrontendUrl();
    const successUrl = `${frontend}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontend}/payment/cancel`;

    logger.info({
      msg: "stripe.billing.checkout_session.create.begin",
      reqId,
      mode: "subscription",
      customerIdMasked: maskId(customerId),
      priceIdMasked: maskId(priceId),
      successUrl,
      cancelUrl,
      elapsedMs: Date.now() - startedAt,
    });

    // ✅ TIP DEBUG : forcer https en prod si jamais FRONTEND_URL est bizarre
    // (ici on log juste, on ne modifie pas)
    if (!successUrl.startsWith("http")) {
      logger.warn({
        msg: "stripe.billing.checkout_session.url_invalid",
        reqId,
        successUrl,
        cancelUrl,
        elapsedMs: Date.now() - startedAt,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: false,
      metadata: {
        type: "subscription",
        userId: String(userId),
        plan: "premium",
      },
    });

    logger.info({
      msg: "stripe.billing.checkout_session.create.done",
      reqId,
      sessionId: session.id,
      sessionUrlPresent: !!session.url,
      sessionUrl: safeStr(session.url),
      paymentStatus: safeStr((session as any)?.payment_status), // souvent vide à la création
      mode: safeStr(session.mode),
      customer: maskId(safeStr(session.customer)),
      subscription: maskId(safeStr(session.subscription)),
      elapsedMs: Date.now() - startedAt,
    });

    // ⚠️ Si session.url est vide, on log un warning (ça indique un souci d'API / type / lib)
    if (!session.url) {
      logger.warn({
        msg: "stripe.billing.checkout_session.missing_session_url",
        reqId,
        sessionId: session.id,
        elapsedMs: Date.now() - startedAt,
      });
    }

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    // Stripe error details
    logger.error({
      msg: "stripe.billing.checkout_session.failed",
      reqId,
      errorMessage: err?.message,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      rawType: err?.rawType,
      param: err?.param,
      stack: err?.stack,
      elapsedMs: Date.now() - startedAt,
    });

    return res.status(500).json({ message: err?.message || "Stripe error" });
  }
};


export const getCheckoutSessionStatus = async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.query.session_id || "").trim();
    const userId = String(req.query.userId || "").trim();

    if (!sessionId) return res.status(400).json({ message: "Missing session_id" });
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Missing or invalid userId" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // ✅ mini sécurité : metadata.userId doit matcher
    const metaUserId = String((session.metadata as any)?.userId || "").trim();
    if (metaUserId && metaUserId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const plan = String((session.metadata as any)?.plan || "premium");

    const subscriptionId = String(session.subscription || "").trim();
    if (!subscriptionId) {
      return res.status(200).json({
        plan,
        status: "unknown",
        currentPeriodEnd: null,
      });
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    const currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;

    return res.status(200).json({
      plan,
      status: sub.status,
      currentPeriodEnd,
      subscriptionId: sub.id,
      customerId: sub.customer,
    });
  } catch (err: any) {
    logger.error({
      msg: "stripe.getCheckoutSessionStatus.failed",
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message || "Stripe error" });
  }
};

export const getPremiumSubscription = async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Missing or invalid userId" });
    }

    const user: any = await UserModel.findById(userId).select({
      abonnement: 1,
      abonnement_end: 1,
      subscription: 1,
    }).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = user?.subscription?.plan || user?.abonnement || "free";
    const status = user?.subscription?.status || (plan !== "free" ? "active" : "unknown");
    const currentPeriodEnd = user?.subscription?.currentPeriodEnd || user?.abonnement_end || null;

    return res.status(200).json({
      plan,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!user?.subscription?.cancelAtPeriodEnd,
      stripeCustomerId: user?.subscription?.stripeCustomerId || null,
      stripeSubscriptionId: user?.subscription?.stripeSubscriptionId || null,
    });
  } catch (err: any) {
    logger.error({
      msg: "stripe.getPremiumSubscription.failed",
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};
