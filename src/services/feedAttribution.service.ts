import mongoose from "mongoose";
import FeedInteractionModel from "../models/feedInteraction";
import FeedAttributionModel from "../models/feedAttribution";

type TargetType = "ORDER" | "BOOKING";

export async function attributeTargetToFeed(params: {
  userId: string;
  proId: string;
  targetType: TargetType;
  targetId: string;
  amount?: number;
  currency?: string;
}) {
  const { userId, proId, targetType, targetId, amount, currency } = params;

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(proId) || !mongoose.isValidObjectId(targetId)) {
    return { ok: false, reason: "invalid ids" as const };
  }

  // ne pas dupliquer
  const exists = await FeedAttributionModel.findOne({ targetType, targetId }).lean();
  if (exists) return { ok: true, attributed: true, already: true as const };

  // Fenêtre attribution : 7 jours (CTA > VIEW)
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1) Priorité: CTA_BOOK
  const lastCta = await FeedInteractionModel.findOne({
    userId,
    proId,
    type: "CTA_BOOK",
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (lastCta) {
    await FeedAttributionModel.create({
      userId,
      proId,
      postId: lastCta.postId || undefined,
      targetType,
      targetId,
      reason: "CTA_BOOK",
      amount,
      currency,
    });

    return { ok: true, attributed: true, reason: "CTA_BOOK" as const };
  }

  // 2) Sinon: "view assisted" (optionnel)
  const lastView = await FeedInteractionModel.findOne({
    userId,
    proId,
    type: "VIEW",
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (lastView) {
    await FeedAttributionModel.create({
      userId,
      proId,
      postId: lastView.postId || undefined,
      targetType,
      targetId,
      reason: "VIEW_ASSISTED",
      amount,
      currency,
    });

    return { ok: true, attributed: true, reason: "VIEW_ASSISTED" as const };
  }

  return { ok: true, attributed: false };
}
