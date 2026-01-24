import cron from "node-cron";
import shopModel from "../models/shop";
import bookingModel from "../models/booking";

/**
 * Utils dates
 */
function startOfIsoWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 🧮 Calcul des stats shops
 * Peut être appelée par :
 * - le cron
 * - le bootstrap du backend
 * - plus tard un endpoint admin
 */
export async function computeShopStats() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = startOfIsoWeek(now);
  const monthStart = startOfMonth(now);

  console.log("[ShopStats] Computing...", { now });

  try {
    // Reset global
    await shopModel.updateMany(
      {},
      {
        $set: {
          "stats.bookings.finished.last24h": 0,
          "stats.bookings.finished.week": 0,
          "stats.bookings.finished.month": 0,
          "stats.bookings.finished.total": 0,
          "stats.computedAt": now,
        },
      }
    );

    const results = await bookingModel.aggregate([
      {
        $match: {
          status: "finished",
          end: { $lte: now },
          shopId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$shopId",
          total: { $sum: 1 },
          last24h: {
            $sum: { $cond: [{ $gte: ["$end", last24h] }, 1, 0] },
          },
          week: {
            $sum: { $cond: [{ $gte: ["$end", weekStart] }, 1, 0] },
          },
          month: {
            $sum: { $cond: [{ $gte: ["$end", monthStart] }, 1, 0] },
          },
        },
      },
    ]);

    if (!results.length) {
      console.log("[ShopStats] No finished bookings found");
      return;
    }

    const ops = results.map((r: any) => ({
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            "stats.bookings.finished.total": r.total,
            "stats.bookings.finished.last24h": r.last24h,
            "stats.bookings.finished.week": r.week,
            "stats.bookings.finished.month": r.month,
            "stats.computedAt": now,
          },
        },
      },
    }));

    await shopModel.bulkWrite(ops, { ordered: false });

    console.log("[ShopStats] Done", { shopsUpdated: ops.length });
  } catch (err) {
    console.error("[ShopStats] ERROR", err);
  }
}

/**
 * ⏰ Cron quotidien à 02:00
 */
export function startShopStatsCron() {
  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log("[CRON][ShopStats] Triggered");
      await computeShopStats();
    },
    {
      timezone: "Europe/Paris",
    }
  );

  console.log("[CRON][ShopStats] Scheduled at 02:00 Europe/Paris");
}
