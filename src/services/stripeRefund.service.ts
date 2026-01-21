import Stripe from "stripe";
import bookingModel from "../models/booking";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

export async function refundBookingIfNeeded(params: {
  bookingId: string;
  reason?: Stripe.RefundCreateParams.Reason;
}) {
  const { bookingId, reason } = params;

  const booking: any = await bookingModel.findById(bookingId).lean();
  if (!booking) throw new Error("Booking not found");

  if (booking.refundId) {
    return { refundId: booking.refundId, alreadyRefunded: true };
  }

  const paymentIntentId = booking.paymentIntentId;
  if (!paymentIntentId) {
    throw new Error("Missing paymentIntentId on booking (cannot refund)");
  }

  const refund = await stripe.refunds.create({
    payment_intent: String(paymentIntentId),
    reason: reason || "requested_by_customer",
  });

  await bookingModel.updateOne(
    { _id: bookingId, refundId: { $exists: false } },
    { refundId: refund.id, refundedAt: new Date() }
  );

  return { refundId: refund.id, alreadyRefunded: false };
}
