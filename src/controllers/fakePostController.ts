import FakePostModel from "../models/fakePost";
import * as express from "express";
import { logger } from "../utils/logger";

function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) o[k] = "***";
      else if (typeof o[k] === "object") deep(o[k]);
    });
  };
  deep(clone);
  return clone;
}

const normalizeType = (v: any) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

const normalizePlatform = (v: any) => {
  const p = String(v ?? "instagram").trim().toLowerCase();
  if (p === "instagram" || p === "tiktok" || p === "facebook") return p;
  return "instagram";
};

// ==============================
// CRUD ADMIN
// ==============================
const createFakePost = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body ?? {};

    const doc = new FakePostModel({
      platform: normalizePlatform(body.platform),
      lang: "fr",
      shopTypes: Array.isArray(body.shopTypes) && body.shopTypes.length
        ? body.shopTypes.map(normalizeType).filter(Boolean)
        : ["all"],
      tone: body.tone,
      text: String(body.text ?? "").trim(),
      active: body.active !== undefined ? !!body.active : true,
    });

    if (!doc.text) {
      return res.status(400).json({ message: "Le champ text est requis" });
    }

    await doc.save();

    logger.info({
      msg: "createFakePost success",
      route: "POST /api/fake-post",
      method: req.method,
      url: req.originalUrl,
      fakePostId: doc?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    return res.status(201).json(doc);
  } catch (error: any) {
    logger.error({
      msg: "createFakePost failed",
      route: "POST /api/fake-post",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de créer le post" });
  }
};

const getAllFakePosts = async (req: express.Request, res: express.Response) => {
  try {
    const posts = await FakePostModel.find().sort({ createdAt: -1 });

    logger.info({
      msg: "getAllFakePosts success",
      route: "GET /api/fake-post",
      method: req.method,
      url: req.originalUrl,
      count: posts.length,
    });

    return res.json(posts);
  } catch (error: any) {
    logger.error({
      msg: "getAllFakePosts failed",
      route: "GET /api/fake-post",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de récupérer les posts" });
  }
};

const getFakePostById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const post = await FakePostModel.findById(id);

    if (!post) {
      logger.warn({
        msg: "getFakePostById not found",
        route: "GET /api/fake-post/:id",
        method: req.method,
        url: req.originalUrl,
        fakePostId: id,
      });
      return res.status(404).json({ message: "Post non trouvé" });
    }

    logger.info({
      msg: "getFakePostById success",
      route: "GET /api/fake-post/:id",
      method: req.method,
      url: req.originalUrl,
      fakePostId: id,
    });

    return res.json(post);
  } catch (error: any) {
    logger.error({
      msg: "getFakePostById failed",
      route: "GET /api/fake-post/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de récupérer le post" });
  }
};

const updateFakePostById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    const update: any = {};
    if (body.platform !== undefined) update.platform = normalizePlatform(body.platform);
    update.lang = "fr"; // verrouillé
    if (body.shopTypes !== undefined) {
      update.shopTypes = Array.isArray(body.shopTypes) && body.shopTypes.length
        ? body.shopTypes.map(normalizeType).filter(Boolean)
        : ["all"];
    }
    if (body.tone !== undefined) update.tone = body.tone;
    if (body.text !== undefined) update.text = String(body.text ?? "").trim();
    if (body.active !== undefined) update.active = !!body.active;

    const updated = await FakePostModel.findByIdAndUpdate(id, update, { new: true });

    if (!updated) {
      logger.warn({
        msg: "updateFakePostById not found",
        route: "PUT /api/fake-post/:id",
        method: req.method,
        url: req.originalUrl,
        fakePostId: id,
      });
      return res.status(404).json({ message: "Post non trouvé" });
    }

    logger.info({
      msg: "updateFakePostById success",
      route: "PUT /api/fake-post/:id",
      method: req.method,
      url: req.originalUrl,
      fakePostId: id,
      body: sanitize(req.body),
    });

    return res.json(updated);
  } catch (error: any) {
    logger.error({
      msg: "updateFakePostById failed",
      route: "PUT /api/fake-post/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de mettre à jour le post" });
  }
};

const deleteFakePostById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deleted = await FakePostModel.findByIdAndDelete(id);

    if (!deleted) {
      logger.warn({
        msg: "deleteFakePostById not found",
        route: "DELETE /api/fake-post/:id",
        method: req.method,
        url: req.originalUrl,
        fakePostId: id,
      });
      return res.status(404).json({ message: "Post non trouvé" });
    }

    logger.info({
      msg: "deleteFakePostById success",
      route: "DELETE /api/fake-post/:id",
      method: req.method,
      url: req.originalUrl,
      fakePostId: id,
    });

    return res.json({ message: "Post supprimé avec succès" });
  } catch (error: any) {
    logger.error({
      msg: "deleteFakePostById failed",
      route: "DELETE /api/fake-post/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de supprimer le post" });
  }
};

// ==============================
// PUBLIC: 1 post aléatoire (pour le composant)
// ==============================
const getRandomFakePost = async (req: express.Request, res: express.Response) => {
  try {
    const platform = normalizePlatform(req.query.platform);
    const shopType = normalizeType(req.query.shopType);

    // Fallback "all" si shopType vide
    const type = shopType || "all";

    // On accepte : posts ciblés OU "all"
    const match: any = {
      active: true,
      platform,
      lang: "fr",
      shopTypes: { $in: [type, "all"] },
    };

    const docs = await FakePostModel.aggregate([
      { $match: match },
      { $sample: { size: 1 } },
    ]);

    const doc = docs?.[0];
    if (!doc) {
      return res.status(404).json({ message: "Aucun post disponible" });
    }

    return res.json(doc);
  } catch (error: any) {
    logger.error({
      msg: "getRandomFakePost failed",
      route: "GET /api/fake-post/random",
      method: req.method,
      url: req.originalUrl,
      query: sanitize(req.query),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de récupérer un post" });
  }
};

module.exports = {
  createFakePost,
  getAllFakePosts,
  getFakePostById,
  updateFakePostById,
  deleteFakePostById,
  getRandomFakePost,
};
