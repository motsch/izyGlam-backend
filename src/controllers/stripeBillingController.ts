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

export const createPremiumCheckoutSession = async (req: Request, res: Response) => {
  try {
    // ✅ Ici on récupère userId depuis le body (comme tu veux pour l’instant)
    const userId = String(req.body?.userId || "").trim();

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Missing or invalid userId" });
    }

    const user: any = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const priceId = process.env.STRIPE_PRICE_PREMIUM;
    if (!priceId) {
      return res.status(500).json({ message: "Missing STRIPE_PRICE_PREMIUM" });
    }

    /**
     * =====================================================
     * ✅ BLOC IMPORTANT : éviter de recréer si déjà premium actif
     * =====================================================
     */
    const subStatus = user?.subscription?.status;
    const subPlan = user?.subscription?.plan;
    const currentPeriodEnd = user?.subscription?.currentPeriodEnd || null;

    const isAlreadyPremiumActive =
      (subPlan === "premium" || user?.abonnement === "premium") &&
      (subStatus === "active" || subStatus === "trialing") &&
      !user?.subscription?.cancelAtPeriodEnd;

    if (isAlreadyPremiumActive) {
      return res.status(200).json({
        alreadyActive: true,
        url: null,
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
     * =====================================================
     * 1) Customer Stripe (réutilise si déjà présent)
     * =====================================================
     */
    let customerId = user.subscription?.stripeCustomerId || user.customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;

      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            "subscription.stripeCustomerId": customerId,
            customerId: customerId, // legacy compat
          },
        }
      );
    }

    /**
     * =====================================================
     * ✅ BLOC OPTIONNEL : marquer l'abonnement "pending"
     * (utile pour UI ; la vérité finale vient du webhook)
     * =====================================================
     */
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          "subscription.plan": "premium",
          "subscription.status": "incomplete", // "en cours"
          "subscription.cancelAtPeriodEnd": false,
          // on ne touche PAS currentPeriodEnd ici (Stripe le donnera via webhook)
        },
      }
    );

    /**
     * =====================================================
     * 2) Checkout Session (subscription)
     * =====================================================
     */
    const frontend = getFrontendUrl();
    const successUrl = `${frontend}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontend}/payment/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: false,

      // ✅ IMPORTANT: metadata pour webhook
      metadata: {
        type: "subscription",
        userId: String(user._id),
        plan: "premium",
      },
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    logger.error({
      msg: "stripe.createPremiumCheckoutSession.failed",
      errorMessage: err?.message,
      stack: err?.stack,
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

