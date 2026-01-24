import { Request, Response } from "express";
import mongoose from "mongoose";
import FeedPostModel from "../models/feedPost";
import { logger } from "../utils/logger";

function requirePro(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const u = (req as any).user;
  if (!u?._id) return { ok: false, status: 401, message: "Unauthorized" };

  // ajuste selon tes rôles : "professionnel" / "boss"
  const role = String(u.role || "");
  if (!["professionnel", "boss", "admin"].includes(role)) {
    return { ok: false, status: 403, message: "Forbidden (pro only)" };
  }
  return { ok: true };
}

export const createPost = async (req: Request, res: Response) => {
  const guard = requirePro(req);
  if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

  try {
    const proId = (req as any).user._id;

    const media = req.body?.media;
    if (!media?.type || !media?.url) {
      return res.status(400).json({ message: "media.type and media.url are required" });
    }

    const post = await FeedPostModel.create({
      proId,
      shopId: req.body?.shopId || undefined,
      status: "DRAFT",
      media: {
        type: media.type,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        width: media.width,
        height: media.height,
        durationSec: media.durationSec,
      },
      caption: req.body?.caption || "",
      tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
      serviceIds: Array.isArray(req.body?.serviceIds) ? req.body.serviceIds : [],
      location: req.body?.location || undefined,
      metrics: { likesCount: 0, viewsCount: 0, savesCount: 0 },
      publishedAt: null,
    });

    return res.json(post);
  } catch (e: any) {
    logger.error({ msg: "proFeed.create.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to create post" });
  }
};

export const updatePost = async (req: Request, res: Response) => {
  const guard = requirePro(req);
  if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

  try {
    const proId = String((req as any).user._id);
    const postId = String(req.params.id);

    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId);
    if (!post || post.status === "DELETED") return res.status(404).json({ message: "Not found" });

    // ownership (admin bypass)
    const role = String((req as any).user.role || "");
    if (String(post.proId) !== proId && role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.body?.caption != null) post.caption = String(req.body.caption);
    if (req.body?.tags != null) post.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    if (req.body?.serviceIds != null) post.serviceIds = Array.isArray(req.body.serviceIds) ? req.body.serviceIds : [];
    if (req.body?.location != null) post.location = req.body.location;

    // media update optionnel
    if (req.body?.media?.url) {
      post.media = {
        ...post.media,
        ...req.body.media,
      };
    }

    await post.save();
    return res.json(post);
  } catch (e: any) {
    logger.error({ msg: "proFeed.update.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to update post" });
  }
};

export const publishPost = async (req: Request, res: Response) => {
  const guard = requirePro(req);
  if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

  try {
    const proId = String((req as any).user._id);
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId);
    if (!post || post.status === "DELETED") return res.status(404).json({ message: "Not found" });

    const role = String((req as any).user.role || "");
    if (String(post.proId) !== proId && role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    post.status = "PUBLISHED";
    post.publishedAt = new Date();
    await post.save();

    return res.json({ ok: true, postId: String(post._id), publishedAt: post.publishedAt });
  } catch (e: any) {
    logger.error({ msg: "proFeed.publish.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to publish post" });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  const guard = requirePro(req);
  if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

  try {
    const proId = String((req as any).user._id);
    const postId = String(req.params.id);
    if (!mongoose.isValidObjectId(postId)) return res.status(400).json({ message: "Invalid id" });

    const post = await FeedPostModel.findById(postId);
    if (!post) return res.status(404).json({ message: "Not found" });

    const role = String((req as any).user.role || "");
    if (String(post.proId) !== proId && role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // soft delete
    post.status = "DELETED";
    await post.save();

    return res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "proFeed.delete.failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(500).json({ message: "Unable to delete post" });
  }
};
