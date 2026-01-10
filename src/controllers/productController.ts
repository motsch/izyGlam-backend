import * as express from "express";
import productModel from "../models/product";
import orderModel from "../models/order";
import { logger } from "../utils/logger";

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
 * GET /api/product
 * Query:
 * - page (default 1)
 * - limit (default 24, max 100)
 * - taxonomies=5419,11496 (optionnel)
 * - complete=true (optionnel)
 * - status=ACTIVE|DRAFT|ARCHIVED (default ACTIVE)
 */
const getAllProducts = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    const status = (req.query.status as string) || "ACTIVE";

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 100);
    const skip = (page - 1) * limit;

    const complete = req.query.complete === "true";
    const taxonomiesRaw = (req.query.taxonomies as string) || "";
    const taxonomies = taxonomiesRaw
      ? taxonomiesRaw.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n))
      : [];

    const filter: any = { "visibility.status": status };

    // ✅ filtre catégorie (taxonomyId)
    if (taxonomies.length) {
      filter.taxonomyId = { $in: taxonomies };
    }

    // ✅ filtre "produits complets"
    if (complete) {
      filter.descriptionHtml = { $exists: true, $ne: "" };
      filter.coverImage = { $exists: true, $ne: "" };
      filter["pricing.retailPrice"] = { $exists: true, $gt: 0 };
    }

    // ✅ requêtes : items + total
    const [items, total] = await Promise.all([
      productModel
        .find(filter)
        .sort({ updatedAt: -1 }) // tu peux changer le tri
        .skip(skip)
        .limit(limit),
      productModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.info({
      msg: "getAllProducts success",
      route: "GET /api/product",
      filter: sanitize(filter),
      page,
      limit,
      total,
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
      msg: "getAllProducts failed",
      route: "GET /api/product",
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
    const limit = Math.min(Number(req.query.limit || 8), 50);
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const agg = await orderModel.aggregate([
      { $match: { createdAt: { $gte: from }, status: { $in: ["PAID", "SUPPLIER_ORDERED", "SHIPPED"] } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.qty" } } },
      { $sort: { qty: -1 } },
      { $limit: limit },
    ]);

    const ids = agg.map((x) => x._id);
    const products = await productModel.find({ _id: { $in: ids }, "visibility.status": "ACTIVE" });

    // garde l’ordre “best sellers”
    const map = new Map(products.map((p) => [p._id.toString(), p]));
    const ordered = agg.map((a) => map.get(a._id.toString())).filter(Boolean);

    res.json(ordered);
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

module.exports = {
  getAllProducts,
  getProductById,
  updateProductById,
  getBestSellersWeek,
};
