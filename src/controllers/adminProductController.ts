import * as express from "express";
import mongoose from "mongoose";
import productModel from "../models/product";
import { logger } from "../utils/logger";

function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban", "authorization", "secret", "apikey"];
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

function parseIds(ids: any): mongoose.Types.ObjectId[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((x) => String(x))
    .filter((x) => mongoose.Types.ObjectId.isValid(x))
    .map((x) => new mongoose.Types.ObjectId(x));
}

/**
 * GET /api/admin/products
 * Query:
 * - page=1
 * - limit=50
 * - q=shampoo (search title/sku/ean)
 * - categoryIds=5419,11496 (optionnel)
 * - complete=true (optionnel)
 * - sort=updatedAt|price|stock
 * - dir=asc|desc
 */
export const getAllAdmin = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  const reqId = (req.headers["x-request-id"] as string) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const logBase = { reqId, route: "GET /api/admin/products" };

  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const skip = (page - 1) * limit;

    const complete = req.query.complete === "true";
    const q = String(req.query.q || "").trim();

    const categoryRaw = String(req.query.categoryIds || "").trim();
    const categoryIds = categoryRaw
      ? categoryRaw.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n))
      : [];

    const sort = String(req.query.sort || "updatedAt");
    const dir = String(req.query.dir || "desc") === "asc" ? 1 : -1;

    const filter: any = {};

    if (categoryIds.length) filter.categoryId = { $in: categoryIds };

    if (complete) {
      filter.descriptionHtml = { $exists: true, $ne: "" };
      filter.coverImage = { $exists: true, $ne: "" };
      filter["pricing.retailPrice"] = { $exists: true, $gt: 0 };
    }

    if (q) {
      // simple, efficace sans index text (tu peux l’ajouter plus tard)
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { "supplier.sku": { $regex: q, $options: "i" } },
        { "supplier.ean13": { $regex: q, $options: "i" } },
        { url: { $regex: q, $options: "i" } },
      ];
    }

    let mongoSort: any = { updatedAt: -1 };
    if (sort === "updatedAt") mongoSort = { updatedAt: dir };
    if (sort === "price") mongoSort = { "pricing.retailPrice": dir, updatedAt: -1 };
    if (sort === "stock") mongoSort = { "stock.supplierQty": dir, updatedAt: -1 };

    logger.info({
      ...logBase,
      msg: "getAllAdmin start",
      query: sanitize(req.query),
      page,
      limit,
      skip,
      filter: sanitize(filter),
      mongoSort,
    });

    const [items, total] = await Promise.all([
      productModel.find(filter).sort(mongoSort).skip(skip).limit(limit).lean(),
      productModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.info({
      ...logBase,
      msg: "getAllAdmin success",
      returned: items.length,
      total,
      totalPages,
      durationMs: Date.now() - t0,
    });

    res.json({ items, page, limit, total, totalPages });
  } catch (e: any) {
    logger.error({
      ...logBase,
      msg: "getAllAdmin failed",
      errorMessage: e?.message,
      stack: e?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les produits (admin)" });
  }
};

/**
 * DELETE /api/admin/products/:id
 */
export const deleteOne = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const deleted = await productModel.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Produit introuvable" });

    logger.info({ msg: "admin deleteOne success", route: "DELETE /api/admin/products/:id", id });
    res.json({ ok: true });
  } catch (e: any) {
    logger.error({ msg: "admin deleteOne failed", errorMessage: e?.message, stack: e?.stack });
    res.status(500).json({ message: "Impossible de supprimer le produit" });
  }
};

/**
 * POST /api/admin/products/delete-many
 * Body: { ids: string[] }
 */
export const deleteMany = async (req: express.Request, res: express.Response) => {
  try {
    const ids = parseIds(req.body?.ids);
    if (!ids.length) return res.status(400).json({ message: "ids[] requis" });

    const result = await productModel.deleteMany({ _id: { $in: ids } });
    logger.info({ msg: "admin deleteMany success", deletedCount: result.deletedCount });

    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e: any) {
    logger.error({ msg: "admin deleteMany failed", errorMessage: e?.message, stack: e?.stack });
    res.status(500).json({ message: "Impossible de supprimer les produits" });
  }
};

/**
 * POST /api/admin/products/purge
 * Body: { confirm: "DELETE_ALL_PRODUCTS", completeOnly?: boolean }
 *
 * Ultra safe:
 * - obligé d’envoyer confirm EXACT
 * - optionnel : purge uniquement produits incomplets / complets
 */
export const purgeAll = async (req: express.Request, res: express.Response) => {
  try {
    const confirm = String(req.body?.confirm || "");
    if (confirm !== "DELETE_ALL_PRODUCTS") {
      return res.status(400).json({
        message: 'Confirmation invalide. Envoie confirm="DELETE_ALL_PRODUCTS"',
      });
    }

    const completeOnly = req.body?.completeOnly === true;

    const filter: any = {};
    if (completeOnly) {
      filter.descriptionHtml = { $exists: true, $ne: "" };
      filter.coverImage = { $exists: true, $ne: "" };
      filter["pricing.retailPrice"] = { $exists: true, $gt: 0 };
    }

    const result = await productModel.deleteMany(filter);

    logger.warn({
      msg: "admin purgeAll executed",
      completeOnly,
      deletedCount: result.deletedCount,
    });

    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e: any) {
    logger.error({ msg: "admin purgeAll failed", errorMessage: e?.message, stack: e?.stack });
    res.status(500).json({ message: "Impossible de purger les produits" });
  }
};

/**
 * PATCH /api/admin/products/bulk
 * Body:
 * {
 *   ids: string[],
 *   set: { ...champs à mettre à jour ... }
 * }
 *
 * SAFE:
 * - on whiteliste les champs modifiables, sinon ça devient dangereux
 */
export const bulkUpdate = async (req: express.Request, res: express.Response) => {
  try {
    const ids = parseIds(req.body?.ids);
    if (!ids.length) return res.status(400).json({ message: "ids[] requis" });

    const set = req.body?.set || {};
    if (!set || typeof set !== "object") return res.status(400).json({ message: "set{} requis" });

    // ✅ whitelist
    const allowed = new Set([
      "title",
      "description",
      "descriptionHtml",
      "coverImage",
      "images",
      "categoryId",
      "taxonomyId",
      "tags",
      "pricing.salePrice",
      "pricing.retailPrice",
      "pricing.wholesalePrice",
      "stock.supplierQty",
    ]);

    const $set: any = {};
    for (const k of Object.keys(set)) {
      if (allowed.has(k)) $set[k] = set[k];
    }

    if (!Object.keys($set).length) {
      return res.status(400).json({ message: "Aucun champ autorisé dans set{}" });
    }

    const result = await productModel.updateMany(
      { _id: { $in: ids } },
      { $set: { ...$set, updatedAt: new Date() } }
    );

    logger.info({
      msg: "admin bulkUpdate success",
      matched: result.matchedCount,
      modified: result.modifiedCount,
      set: sanitize($set),
    });

    res.json({
      ok: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (e: any) {
    logger.error({ msg: "admin bulkUpdate failed", errorMessage: e?.message, stack: e?.stack });
    res.status(500).json({ message: "Impossible de modifier les produits" });
  }
};

/**
 * GET /api/admin/products/stats
 * Retourne des stats utiles pour dashboard admin
 */
export const getStats = async (req: express.Request, res: express.Response) => {
  try {
    const [total, withDesc, withCover, withPrice, complete] = await Promise.all([
      productModel.countDocuments({}),
      productModel.countDocuments({ descriptionHtml: { $exists: true, $ne: "" } }),
      productModel.countDocuments({ coverImage: { $exists: true, $ne: "" } }),
      productModel.countDocuments({ "pricing.retailPrice": { $exists: true, $gt: 0 } }),
      productModel.countDocuments({
        descriptionHtml: { $exists: true, $ne: "" },
        coverImage: { $exists: true, $ne: "" },
        "pricing.retailPrice": { $exists: true, $gt: 0 },
      }),
    ]);

    // top categories (categoryId)
    const byCategory = await productModel.aggregate([
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]);

    // dernière maj
    const last = await productModel.findOne({}).sort({ updatedAt: -1 }).select({ updatedAt: 1 }).lean();

    res.json({
      total,
      withDesc,
      withCover,
      withPrice,
      complete,
      completionRate: total ? Math.round((complete / total) * 1000) / 10 : 0,
      lastUpdatedAt: last?.updatedAt || null,
      byCategory,
    });
  } catch (e: any) {
    logger.error({ msg: "admin getStats failed", errorMessage: e?.message, stack: e?.stack });
    res.status(500).json({ message: "Impossible de récupérer les stats" });
  }
};

module.exports = {
  getAllAdmin,
  deleteOne,
  deleteMany,
  purgeAll,
  bulkUpdate,
  getStats,
};
