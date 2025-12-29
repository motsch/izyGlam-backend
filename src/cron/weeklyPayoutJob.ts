import cron from "node-cron";
import PayoutBatchModel from "../models/payoutBatchModel";
import Stripe from "stripe";
import bookingModel from "../models/booking";
import UserModel from "../models/user";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Garde ta version si tu en as besoin via ENV ; sinon Stripe utilisera la par défaut du compte.
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function toCents(value: string): number {
  // "35" -> 3500, "46.2" -> 4620
  const n = Number(String(value).replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun,1=Mon,...6=Sat
  const diff = (day + 6) % 7; // convert to Monday-based offset
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function runWeeklyPayouts(now = new Date()) {
  // période précédente : lundi->lundi
  const thisMonday = startOfWeekMonday(now);
  const lastMonday = addDays(thisMonday, -7);

  const periodStart = lastMonday;
  const periodEnd = thisMonday;

  console.log("[PAYOUT] Period:", periodStart.toISOString(), "->", periodEnd.toISOString());

  // 1) récupérer bookings finished non clos dans la période
  const bookings = await bookingModel.find({
    status: "finished",
    closed: { $ne: true },
    end: { $gte: periodStart, $lt: periodEnd },
  });

  if (!bookings.length) {
    console.log("[PAYOUT] No eligible bookings");
    return;
  }

  // 2) agréger par prestataire
  const byPro = new Map<string, { bookingIds: string[]; amountCents: number }>();

  for (const b of bookings) {
    const proId = b.userProId;
    const amount = toCents(b.shopEarnings || "0");
    if (amount <= 0) continue;

    const current = byPro.get(proId) || { bookingIds: [], amountCents: 0 };
    current.bookingIds.push(String(b._id));
    current.amountCents += amount;
    byPro.set(proId, current);
  }

  // 3) payer chaque prestataire (Transfer) + fermer bookings
  for (const [userProId, data] of byPro.entries()) {
    if (data.amountCents <= 0) continue;

    const user = await UserModel.findById(userProId);
    if (!user?.stripe?.accountId) {
      console.warn("[PAYOUT] Missing stripe accountId for user", userProId);
      continue;
    }
    if (!user.stripe.payoutsEnabled) {
      console.warn("[PAYOUT] payouts not enabled for user", userProId);
      continue;
    }

    // 3.a) créer/ouvrir un batch (unique par user + période)
    let batch = await PayoutBatchModel.findOne({ userProId, periodStart, periodEnd });

    if (!batch) {
      batch = await PayoutBatchModel.create({
        userProId,
        periodStart,
        periodEnd,
        amountCents: data.amountCents,
        currency: "eur",
        status: "created",
      });
    }

    // si déjà payé, on ne refait rien
    if (batch.status === "paid") {
      console.log("[PAYOUT] Already paid", userProId, batch.stripeTransferId);
      continue;
    }

    try {
      // 3.b) transfer Stripe (depuis plateforme -> compte connecté)
      const transfer = await stripe.transfers.create(
        {
          amount: data.amountCents,
          currency: "eur",
          destination: user.stripe.accountId,
          description: `IzyGlam - Payout weekly ${periodStart.toISOString().slice(0, 10)}`,
          metadata: {
            userProId,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            bookingCount: String(data.bookingIds.length),
          },
        },
        {
          // idempotence : protège contre double-exec du cron
          idempotencyKey: `izyglam-weekly-${userProId}-${periodStart.toISOString().slice(0, 10)}`,
        }
      );

      // 3.c) marquer batch payé
      batch.status = "paid";
      batch.stripeTransferId = transfer.id;
      await batch.save();

      // 3.d) fermer les bookings concernés
      await bookingModel.updateMany(
        { _id: { $in: data.bookingIds } },
        { $set: { closed: true, closedAt: new Date() } }
      );

      console.log("[PAYOUT] Paid", userProId, data.amountCents, "cents", "transfer:", transfer.id);
    } catch (e: any) {
      console.error("[PAYOUT] Failed", userProId, e?.message);

      batch.status = "failed";
      batch.errorMessage = e?.message;
      await batch.save();

      // IMPORTANT : on ne ferme PAS les bookings si transfer échoue
    }
  }
}

// Cron: tous les lundis à 06:00 (heure serveur)
export function scheduleWeeklyPayouts() {
  cron.schedule("0 6 * * 1", async () => {
    try {
      await runWeeklyPayouts(new Date());
    } catch (e) {
      console.error("[PAYOUT] Job crashed", e);
    }
  });
}
