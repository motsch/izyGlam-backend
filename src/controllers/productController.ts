import * as express from "express";
import productModel from "../models/product";
import orderModel from "../models/order";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban", "authorization"];
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

/**
 * GET /api/admin/products
 * Query:
 * - page (default 1)
 * - limit (default 50, max 100)
 * - q (optionnel) => recherche simple sur title/sku/ean13 (si tu veux)
 * - sort=updatedAt|createdAt|price (optionnel)
 * - dir=asc|desc (optionnel)
 */
const getAllProductsAdmin = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  const reqId =
    (req.headers["x-request-id"] as string) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const logBase = {
    reqId,
    route: "GET /api/admin/products",
    ip: req.ip,
    userId: (req as any).user?._id,
  };

  logger.info({ ...logBase, msg: "➡️ getAllProductsAdmin start", query: sanitize(req.query) });

  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const skip = (page - 1) * limit;

    // Optionnel: petit search (pratique pour ton panel admin)
    const q = String(req.query.q || "").trim();

    const filter: any = {};
    if (q) {
      // ⚠️ simple, rapide, sans index text obligatoire
      // (tu peux ajouter des index si tu veux améliorer plus tard)
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { "supplier.sku": { $regex: q, $options: "i" } },
        { "supplier.ean13": { $regex: q, $options: "i" } },
      ];
    }

    // Tri (optionnel)
    const sortKey = String(req.query.sort || "updatedAt");
    const dir = String(req.query.dir || "desc") === "asc" ? 1 : -1;

    let sort: any = { updatedAt: -1 };
    if (sortKey === "createdAt") sort = { createdAt: dir };
    if (sortKey === "updatedAt") sort = { updatedAt: dir };
    if (sortKey === "price") sort = { "pricing.retailPrice": dir, updatedAt: -1 };

    const tDb0 = Date.now();

    const [items, total] = await Promise.all([
      productModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      productModel.countDocuments(filter),
    ]);

    const dbDurationMs = Date.now() - tDb0;
    const totalPages = Math.ceil(total / limit);

    logger.info({
      ...logBase,
      msg: "✅ getAllProductsAdmin success",
      returned: items.length,
      total,
      page,
      limit,
      totalPages,
      dbDurationMs,
      durationMs: Date.now() - t0,
    });

    return res.json({ items, page, limit, total, totalPages });
  } catch (error: any) {
    logger.error({
      ...logBase,
      msg: "❌ getAllProductsAdmin failed",
      durationMs: Date.now() - t0,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de récupérer les produits (admin)" });
  }
};



/**
 * GET /api/product
 * Query:
 * - page (default 1)
 * - limit (default 24, max 100)
 * - taxonomies=5419,11496 (optionnel)  --> (en réalité: categoryIds)
 * - complete=true (optionnel)
 */
const getAllProducts = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  const reqId =
    (req.headers["x-request-id"] as string) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const logBase = {
    reqId,
    route: "GET /api/product",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };

  logger.info({
    ...logBase,
    msg: "➡️ getAllProducts start",
    query: sanitize(req.query),
  });

  try {
    // -----------------------------
    // 1) Parse query
    // -----------------------------
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 100);
    const skip = (page - 1) * limit;

    const complete = req.query.complete === "true";

    // ⚠️ on garde le nom "taxonomies" côté API pour ne pas casser le front
    // mais on l’utilise comme categoryIds
    const taxonomiesRaw = (req.query.taxonomies as string) || "";
    const categoryIds = taxonomiesRaw
      ? taxonomiesRaw
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n))
      : [];

    logger.info({
      ...logBase,
      msg: "🧩 getAllProducts parsed query",
      page,
      limit,
      skip,
      complete,
      taxonomiesRaw,
      categoryIds,
    });

    // -----------------------------
    // 2) Build filter
    // -----------------------------
    const filter: any = {};

    // ✅ FILTRE PAR CATEGORYID
    if (categoryIds.length) {
      filter.categoryId = { $in: categoryIds };
    }

    // ✅ FILTRE "produits complets"
    if (complete) {
      filter.descriptionHtml = { $exists: true, $ne: "" };
      filter.coverImage = { $exists: true, $ne: "" };
      filter["pricing.retailPrice"] = { $exists: true, $gt: 0 };
    }

    logger.info({
      ...logBase,
      msg: "🔎 getAllProducts mongo filter ready",
      filter: sanitize(filter),
    });

    // -----------------------------
    // 3) Mongo queries + timings
    // -----------------------------
    const tDb0 = Date.now();

    const itemsPromise = productModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPromise = productModel.countDocuments(filter);

    const [items, total] = await Promise.all([itemsPromise, totalPromise]);

    const dbDurationMs = Date.now() - tDb0;
    const totalPages = Math.ceil(total / limit);

    logger.info({
      ...logBase,
      msg: "✅ getAllProducts mongo result",
      returned: items?.length ?? 0,
      total,
      totalPages,
      dbDurationMs,
      sampleIds: (items || []).slice(0, 5).map((p: any) => p?._id),
      sampleCategoryIds: (items || []).slice(0, 5).map((p: any) => p?.categoryId),
    });

    // -----------------------------
    // 4) Response
    // -----------------------------
    logger.info({
      ...logBase,
      msg: "🏁 getAllProducts success",
      durationMs: Date.now() - t0,
    });

    res.json({
      items,
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error: any) {
    logger.error({
      ...logBase,
      msg: "❌ getAllProducts failed",
      durationMs: Date.now() - t0,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    res.status(500).json({ message: "Impossible de récupérer les produits" });
  }
};

const getProductById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const product = await productModel.findById(id);

    if (!product) {
      logger.warn({ msg: "getProductById not found", route: "GET /api/product/:id", productId: id });
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    res.json(product);
  } catch (error: any) {
    logger.error({
      msg: "getProductById failed",
      route: "GET /api/product/:id",
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer le produit" });
  }
};

/**
 * PUT /api/product/:id (admin)
 * Permet d'activer, mettre en avant, changer title/desc/images, etc.
 */
const updateProductById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    const updated = await productModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updated) {
      logger.warn({ msg: "updateProductById not found", route: "PUT /api/product/:id", productId: id });
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    logger.info({
      msg: "updateProductById success",
      route: "PUT /api/product/:id",
      productId: id,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.json(updated);
  } catch (error: any) {
    logger.error({
      msg: "updateProductById failed",
      route: "PUT /api/product/:id",
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour le produit" });
  }
};

/**
 * GET /api/product/best-sellers/week?limit=8
 * Calcule les top ventes sur 7 jours (PAID/SUPPLIER_ORDERED/SHIPPED)
 */
const getBestSellersWeek = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 50);
    const complete = req.query.complete === "true";

    // même logique que getAllProducts : "taxonomies" = categoryIds
    const taxonomiesRaw = (req.query.taxonomies as string) || "";
    const categoryIds = taxonomiesRaw
      ? taxonomiesRaw
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n))
      : [];

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // -----------------------------
    // 1) Récup best sellers via orders
    // -----------------------------
    const agg = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from },
          status: { $in: ["PAID", "SUPPLIER_ORDERED", "SHIPPED"] },
        },
      },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.qty" } } },
      { $sort: { qty: -1 } },
      { $limit: limit },
    ]);

    // cast en ObjectId si possible (sinon on ignore)
    const bestSellerIds: mongoose.Types.ObjectId[] = agg
      .map((x) => x?._id)
      .map((id) => {
        if (!id) return null;
        // id peut déjà être un ObjectId
        if (id instanceof mongoose.Types.ObjectId) return id;
        // ou string
        const s = String(id);
        if (!mongoose.Types.ObjectId.isValid(s)) return null;
        return new mongoose.Types.ObjectId(s);
      })
      .filter(Boolean) as mongoose.Types.ObjectId[];

    // -----------------------------
    // 2) Build filtre produits (comme getAllProducts)
    // -----------------------------
    const productFilter: any = {};

    // ⚠️ si tu as vraiment un champ visibility.status en base, garde-le
    // sinon COMMENTE cette ligne.
    // productFilter["visibility.status"] = "ACTIVE";

    // sinon, à minima : pas de filtre de status ici (comme getAllProducts)
    // + filtre catégorie (categoryId)
    if (categoryIds.length) {
      productFilter.categoryId = { $in: categoryIds };
    }

    if (complete) {
      productFilter.descriptionHtml = { $exists: true, $ne: "" };
      productFilter.coverImage = { $exists: true, $ne: "" };
      productFilter["pricing.retailPrice"] = { $exists: true, $gt: 0 };
    }

    // -----------------------------
    // 3) Si on a des best sellers => on les fetch + on garde l'ordre
    // -----------------------------
    let bestSellers: any[] = [];
    if (bestSellerIds.length) {
      const found = await productModel
        .find({ ...productFilter, _id: { $in: bestSellerIds } })
        .lean();

      const map = new Map(found.map((p: any) => [p._id.toString(), p]));
      bestSellers = bestSellerIds
        .map((id) => map.get(id.toString()))
        .filter(Boolean);
    }

    // -----------------------------
    // 4) Fallback random si pas assez (ou zéro)
    // -----------------------------
    const missing = limit - bestSellers.length;

    if (missing > 0) {
      const excludeIds = bestSellers.map((p: any) => p._id);

      const randomFill = await productModel.aggregate([
        { $match: { ...productFilter, _id: { $nin: excludeIds } } },
        { $sample: { size: missing } },
      ]);

      // best sellers d'abord, puis random
      const result = [...bestSellers, ...randomFill];
      return res.json(result);
    }

    // -----------------------------
    // 5) Résultat complet
    // -----------------------------
    return res.json(bestSellers);
  } catch (error: any) {
    logger.error({
      msg: "getBestSellersWeek failed",
      route: "GET /api/product/best-sellers/week",
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les best sellers" });
  }
};


/**
 * DELETE /api/product/:id (admin)
 * Supprime un produit du catalogue
 */
const deleteProductById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  const reqId =
    (req.headers["x-request-id"] as string) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const logBase = {
    reqId,
    route: "DELETE /api/product/:id",
    ip: req.ip,
    userId: (req as any).user?._id,
    productId: req.params?.id,
  };

  logger.info({ ...logBase, msg: "➡️ deleteProductById start" });

  try {
    const { id } = req.params;

    const deleted = await productModel.findByIdAndDelete(id);

    if (!deleted) {
      logger.warn({ ...logBase, msg: "⚠️ deleteProductById not found" });
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    logger.info({
      ...logBase,
      msg: "✅ deleteProductById success",
      durationMs: Date.now() - t0,
    });

    return res.json({ ok: true });
  } catch (error: any) {
    logger.error({
      ...logBase,
      msg: "❌ deleteProductById failed",
      durationMs: Date.now() - t0,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({ message: "Impossible de supprimer le produit" });
  }
};



/**
 * GET /api/product/search
 * Query:
 * - q (string) => texte recherché (naturel)
 * - page (default 1)
 * - limit (default 24, max 100)
 * - taxonomies=5419,11496 (optionnel) -> categoryId IN (...)
 * - complete=true (optionnel)
 */
const searchProducts = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  const reqId =
    (req.headers["x-request-id"] as string) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const logBase = {
    reqId,
    route: "GET /api/product/search",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };

  logger.info({ ...logBase, msg: "➡️ searchProducts start", query: sanitize(req.query) });

  try {
    // -----------------------------
    // 1) Parse query
    // -----------------------------
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 100);
    const skip = (page - 1) * limit;

    const complete = req.query.complete === "true";

    const q = String(req.query.q || "").trim();

    const taxonomiesRaw = (req.query.taxonomies as string) || "";
    const categoryIds = taxonomiesRaw
      ? taxonomiesRaw
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n))
      : [];

    // -----------------------------
    // 2) Build filter
    // -----------------------------
    const filter: any = {};

    if (categoryIds.length) {
      filter.categoryId = { $in: categoryIds };
    }

    if (complete) {
      filter.descriptionHtml = { $exists: true, $ne: "" };
      filter.coverImage = { $exists: true, $ne: "" };
      filter["pricing.retailPrice"] = { $exists: true, $gt: 0 };
    }

    // ✅ recherche naturelle via index text
    if (q) {
      filter.$text = { $search: q };
    } else {
      // si pas de q => on renvoie vide (logique search endpoint)
      return res.json({ items: [], page, limit, total: 0, totalPages: 0 });
    }

    // -----------------------------
    // 3) Query Mongo
    // -----------------------------
    const tDb0 = Date.now();

    const [items, total] = await Promise.all([
      productModel
        .find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      productModel.countDocuments(filter),
    ]);

    const dbDurationMs = Date.now() - tDb0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    logger.info({
      ...logBase,
      msg: "✅ searchProducts success",
      q,
      returned: items.length,
      total,
      page,
      limit,
      totalPages,
      dbDurationMs,
      durationMs: Date.now() - t0,
    });

    return res.json({ items, page, limit, total, totalPages });
  } catch (error: any) {
    logger.error({
      ...logBase,
      msg: "❌ searchProducts failed",
      durationMs: Date.now() - t0,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de rechercher les produits" });
  }
};



module.exports = {
  getAllProducts,
  getProductById,
  updateProductById,
  getBestSellersWeek,
  getAllProductsAdmin,
  deleteProductById,
  searchProducts,
};
