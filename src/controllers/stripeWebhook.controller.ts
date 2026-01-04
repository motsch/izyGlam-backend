import { Request, Response } from "express";
import Stripe from "stripe";
import bookingModel from "../models/booking";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Garde ta version si tu en as besoin via ENV ; sinon Stripe utilisera la par défaut du compte.
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;

      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : undefined;

      if (bookingId) {
        await bookingModel.findByIdAndUpdate(bookingId, {
          paymentIntentId,
          // status reste "pending" → le prestataire valide ensuite (ton ADN)
        });
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    return res.status(500).send(err.message);
  }
};
