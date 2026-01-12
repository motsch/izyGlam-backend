import { Request, Response } from "express";
import mongoose from "mongoose";
import FeedInteractionModel from "../models/feedInteraction";
import FeedFollowModel from "../models/feedFollow";
import FeedAttributionModel from "../models/feedAttribution";
import { logger } from "../utils/logger";

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function parseDateOrDefault(v: any, def: Date) {
  const d = new Date(String(v || ""));
  return isNaN(d.getTime()) ? def : d;
}

export const getProFeedStats = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const role = String((req as any).user?.role || "");
    if (!["professionnel", "boss", "admin"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const now = new Date();
    const from = parseDateOrDefault(req.query.from, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDateOrDefault(req.query.to, now);

    const proId = String(userId);

    const [interactions, follows, attributions] = await Promise.all([
      FeedInteractionModel.aggregate([
        { $match: { proId: new mongoose.Types.ObjectId(proId), createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      FeedFollowModel.countDocuments({
        proId: new mongoose.Types.ObjectId(proId),
        createdAt: { $gte: from, $lte: to },
      }),
      FeedAttributionModel.aggregate([
        { $match: { proId: new mongoose.Types.ObjectId(proId), createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: "$reason",
            count: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]),
    ]);

    const byType: Record<string, number> = {};
    for (const it of interactions) byType[it._id] = it.count;

    const byReason: Record<string, { count: number; revenue: number }> = {};
    for (const a of attributions) byReason[a._id] = { count: a.count, revenue: a.revenue };

    return res.json({
      range: { from, to },
      interactions: {
        views: byType["VIEW"] || 0,
        likes: byType["LIKE"] || 0,
        saves: byType["SAVE"] || 0,
        ctaBook: byType["CTA_BOOK"] || 0,
        openProfile: byType["OPEN_PROFILE"] || 0,
      },
      followersGained: follows,
      attribution: {
        ctaBook: byReason["CTA_BOOK"] || { count: 0, revenue: 0 },
        viewAssisted: byReason["VIEW_ASSISTED"] || { count: 0, revenue: 0 },
      },
    });
  } catch (e: any) {
    logger.error({ msg: "feed.analytics.pro.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to get feed stats" });
  }
};
