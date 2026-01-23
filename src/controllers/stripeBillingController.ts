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
  return (process.env.FRONTEND_URL || "http://localhost:4200").replace(/\/$/, "");
}

export const createPremiumCheckoutSession = async (req: Request, res: Response) => {
  try {
    // ✅ IMPORTANT :
    // Ici je pars du principe que ton middleware auth met l’ID user dans req.user._id (ou req.userId).
    // Adapte 1 ligne si besoin.
    const userId = String(req.body?.userId || "").trim();

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Missing or invalid userId" });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ message: "Missing STRIPE_PREMIUM_PRICE_ID" });
    }

    // 1) Customer Stripe (réutilise si déjà présent)
    let customerId = user.subscription?.stripeCustomerId || user.customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
        // pratique pour retrouver le user côté Stripe
        metadata: {
          userId: String(user._id),
        },
      });
      customerId = customer.id;

      // on sauvegarde tout de suite (non bloquant pour le reste)
      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            "subscription.stripeCustomerId": customerId,
            customerId: customerId, // legacy compat (optionnel)
          },
        }
      );
    }

    // 2) Checkout Session (subscription)
    const frontend = getFrontendUrl();
    const successUrl = `${frontend}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontend}/payment/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Optionnel mais recommandé
      allow_promotion_codes: false,

      // ✅ IMPORTANT: metadata pour ton webhook
      metadata: {
        type: "subscription",
        userId: String(user._id),
        plan: "premium",
      },
    });

    // Stripe renvoie une URL prête à rediriger
    // (session.url est dispo pour Checkout Sessions)
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
