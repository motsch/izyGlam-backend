import Stripe from "stripe";
import bookingModel from "../models/booking";
import { logger } from "../utils/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

export async function refundBookingIfNeeded(params: { bookingId: string }) {
  const { bookingId } = params;

  const booking: any = await bookingModel.findById(bookingId);
  if (!booking) throw new Error("BOOKING_NOT_FOUND");

  // ✅ idempotence refund (DB)
  if (booking.refundId) {
    logger.info({ msg: "refund.skip.already_refunded", bookingId, refundId: booking.refundId });
    return { refunded: true, refundId: booking.refundId, skipped: true, reason: "ALREADY_REFUNDED" };
  }

  const piId = String(booking.paymentIntentId || "").trim();
  if (!piId) {
    logger.warn({ msg: "refund.skip.no_payment_intent", bookingId });
    return { refunded: false, skipped: true, reason: "NO_PAYMENT_INTENT" };
  }

  // ✅ récupérer le PaymentIntent Stripe
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(piId);
  } catch (e: any) {
    logger.error({
      msg: "refund.pi.retrieve_failed",
      bookingId,
      piId,
      errorMessage: e?.message,
      code: e?.code,
      status: e?.status,
      stack: e?.stack,
    });
    throw e;
  }

  logger.info({
    msg: "refund.pi.loaded",
    bookingId,
    piId,
    status: pi.status,
    amount: pi.amount,
    amount_received: pi.amount_received,
    currency: pi.currency,
  });

  // ✅ Si pas succeeded => pas de refund à faire (paiement pas confirmé / pas capturé / etc.)
  if (pi.status !== "succeeded") {
    logger.warn({
      msg: "refund.skip.pi_not_succeeded",
      bookingId,
      piId,
      status: pi.status,
      amount_received: pi.amount_received,
    });
    return { refunded: false, skipped: true, reason: `PI_STATUS_${pi.status}` };
  }

  // (Optionnel mais safe) si jamais "succeeded" mais rien reçu
  if ((pi.amount_received ?? 0) <= 0) {
    logger.warn({
      msg: "refund.skip.pi_zero_received",
      bookingId,
      piId,
      status: pi.status,
      amount_received: pi.amount_received,
    });
    return { refunded: false, skipped: true, reason: "PI_ZERO_RECEIVED" };
  }

  // ✅ créer refund (full refund)
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create({
      payment_intent: piId,
      // amount: undefined => full refund
      // reason: "requested_by_customer", // tu peux l'activer si tu veux
    });
  } catch (e: any) {
    logger.error({
      msg: "refund.create_failed",
      bookingId,
      piId,
      errorMessage: e?.message,
      code: e?.code,
      status: e?.status,
      stack: e?.stack,
    });
    throw e;
  }

  // ✅ stocker refundId pour idempotence (DB)
  booking.refundId = refund.id;
  booking.refundedAt = new Date();
  await booking.save();

  logger.info({
    msg: "refund.done",
    bookingId,
    piId,
    refundId: refund.id,
    refundStatus: refund.status,
  });

  return { refunded: true, refundId: refund.id, status: refund.status, skipped: false };
}
