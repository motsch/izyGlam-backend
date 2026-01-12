import { Request, Response } from "express";
import mongoose from "mongoose";
import FeedPostModel from "../models/feedPost";
import FeedInteractionModel from "../models/feedInteraction";
import FeedFollowModel from "../models/feedFollow";
import { logger } from "../utils/logger";
import FeedViewDedupModel from "../models/feedViewDedup";

function parseNumber(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

// cursor simple: base64(json)
function encodeCursor(payload: any): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}
function decodeCursor(cursor: string): any | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export const listFeed = async (req: Request, res: Response) => {
  try {
    const limit = clamp(parseNumber(req.query.limit, 12), 1, 30);

    // Filtres
    const proId = req.query.proId ? String(req.query.proId) : null;
    const tag = req.query.tag ? String(req.query.tag).trim() : null;

    // Geo
    const lat = req.query.lat != null ? parseNumber(req.query.lat, NaN) : NaN;
    const lng = req.query.lng != null ? parseNumber(req.query.lng, NaN) : NaN;
    const radiusKm = req.query.radiusKm != null ? clamp(parseNumber(req.query.radiusKm, 20), 1, 150) : 20;

    const city = req.query.city ? String(req.query.city).trim() : null;
    const zipCode = req.query.zipCode ? String(req.query.zipCode).trim() : null;

    // Cursor
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const decoded = cursor ? decodeCursor(cursor) : null;

    const query: any = {
      status: "PUBLISHED",
    };

    if (proId && mongoose.isValidObjectId(proId)) query.proId = proId;
    if (tag) query.tags = tag;
    if (city) query["location.city"] = city;
    if (zipCode) query["location.zipCode"] = zipCode;

    // Geo filter uniquement si lat/lng valides
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      query["location.geo"] = {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000,
        },
      };
    }

    // Pagination cursor (publishedAt desc, _id desc)
    if (decoded?.publishedAt && decoded?._id) {
      query.$or = [
        { publishedAt: { $lt: new Date(decoded.publishedAt) } },
        { publishedAt: new Date(decoded.publishedAt), _id: { $lt: decoded._id } },
      ];
    }

    const posts = await FeedPostModel.find(query)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = posts.length > limit;
    const slice = hasMore ? posts.slice(0, limit) : posts;

    const nextCursor = hasMore
      ? encodeCursor({ publishedAt: slice[slice.length - 1].publishedAt, _id: String(slice[slice.length - 1]._id) })
      : null;

    return res.json({ items: slice, nextCursor });
  } catch (e: any) {
    logger.error({ msg: "feed.list.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to list feed" });
  }
};

export const getFeedPostById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findOne({ _id: id, status: { $ne: "DELETED" } }).lean();
    if (!post) return res.status(404).json({ message: "Not found" });

    return res.json(post);
  } catch (e: any) {
    logger.error({ msg: "feed.get.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to get post" });
  }
};

export const viewPost = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId).lean();
    if (!post || post.status !== "PUBLISHED") return res.status(404).json({ message: "Not found" });

    // ✅ fenêtre de dédup: 30 minutes
    const now = new Date();
    const expireAt = new Date(now.getTime() + 30 * 60 * 1000);

    // On essaie de "prendre un ticket" (unique userId/postId)
    // Si déjà pris -> duplicate key -> on n'incrémente pas
    let isNewView = false;

    try {
      await FeedViewDedupModel.create({ userId, postId, expireAt });
      isNewView = true;
    } catch (e: any) {
      // duplicate key => déjà vu dans la fenêtre
      isNewView = false;
    }

    if (isNewView) {
      // event (analytics)
      await FeedInteractionModel.create({
        userId,
        postId,
        proId: post.proId,
        type: "VIEW",
        meta: { ua: req.headers["user-agent"] || "" },
      });

      // compteur (atomic)
      await FeedPostModel.updateOne({ _id: postId }, { $inc: { "metrics.viewsCount": 1 } });
    }

    return res.json({ ok: true, counted: isNewView });
  } catch (e: any) {
    logger.error({ msg: "feed.view.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to track view" });
  }
};


export const likePost = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId).lean();
    if (!post || post.status !== "PUBLISHED") return res.status(404).json({ message: "Not found" });

    // Idempotent via unique partial index (LIKE)
    try {
      await FeedInteractionModel.create({ userId, postId, proId: post.proId, type: "LIKE" });
      await FeedPostModel.updateOne({ _id: postId }, { $inc: { "metrics.likesCount": 1 } });
    } catch (err: any) {
      // duplicate => already liked
    }

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.like.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to like" });
  }
};

export const unlikePost = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId).lean();
    if (!post) return res.status(404).json({ message: "Not found" });

    const deleted = await FeedInteractionModel.deleteOne({ userId, postId, type: "LIKE" });
    if (deleted.deletedCount) {
      await FeedPostModel.updateOne({ _id: postId }, { $inc: { "metrics.likesCount": -1 } });
      await FeedInteractionModel.create({ userId, postId, proId: post.proId, type: "UNLIKE" });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.unlike.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to unlike" });
  }
};

export const savePost = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId).lean();
    if (!post || post.status !== "PUBLISHED") return res.status(404).json({ message: "Not found" });

    try {
      await FeedInteractionModel.create({ userId, postId, proId: post.proId, type: "SAVE" });
      await FeedPostModel.updateOne({ _id: postId }, { $inc: { "metrics.savesCount": 1 } });
    } catch (err: any) {
      // duplicate => already saved
    }

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.save.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to save" });
  }
};

export const unsavePost = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId).lean();
    if (!post) return res.status(404).json({ message: "Not found" });

    const deleted = await FeedInteractionModel.deleteOne({ userId, postId, type: "SAVE" });
    if (deleted.deletedCount) {
      await FeedPostModel.updateOne({ _id: postId }, { $inc: { "metrics.savesCount": -1 } });
      await FeedInteractionModel.create({ userId, postId, proId: post.proId, type: "UNSAVE" });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.unsave.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to unsave" });
  }
};

export const ctaBook = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId).lean();
    if (!post) return res.status(404).json({ message: "Not found" });

    await FeedInteractionModel.create({
      userId,
      postId,
      proId: post.proId,
      type: "CTA_BOOK",
      meta: { ref: req.body?.ref || null },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.cta.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to track cta" });
  }
};

export const followPro = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const proId = String(req.params.proId);
    if (!mongoose.isValidObjectId(proId)) return res.status(400).json({ message: "Invalid proId" });

    try {
      await FeedFollowModel.create({ userId, proId });
      await FeedInteractionModel.create({ userId, proId, type: "FOLLOW" });
    } catch (err: any) {
      // duplicate follow => ok
    }

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.follow.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to follow" });
  }
};

export const unfollowPro = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const proId = String(req.params.proId);
    if (!mongoose.isValidObjectId(proId)) return res.status(400).json({ message: "Invalid proId" });

    const deleted = await FeedFollowModel.deleteOne({ userId, proId });
    if (deleted.deletedCount) {
      await FeedInteractionModel.create({ userId, proId, type: "UNFOLLOW" });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "feed.unfollow.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to unfollow" });
  }
};
