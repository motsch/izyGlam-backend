import { Request, Response } from "express";
import CategoryModel from "../models/category";
import ShopModel from "../models/shop";
import { logger } from "../utils/logger";
import { buildCountryQuery } from '../utils/country';

// -- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

// Créer une nouvelle catégorie
const createCategory = async (req: Request, res: Response) => {
  try {
    const newCategory = new CategoryModel(req.body);
    await newCategory.save();

    logger.info({
      msg: "createCategory success",
      route: "POST /api/category",
      method: req.method,
      url: req.originalUrl,
      categoryId: newCategory?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newCategory);
  } catch (error: any) {
    logger.error({
      msg: "createCategory failed",
      route: "POST /api/category",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la catégorie" });
  }
};

// --- Haversine
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // km
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normalizeCountry = (v: any): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : undefined;


// Helpers
function toSlug(value?: any): string | null {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

// SHOPTYPE.X -> x
function slugFromTrad(trad?: string | null): string | null {
  if (!trad) return null;
  const m = String(trad).match(/^[A-Z_]+\.(.+)$/i);
  if (!m || !m[1]) return null;
  return toSlug(m[1]);
}

// Parse "codes" (string "75001,75002" | array)
function parsePostalCodes(codesParam: unknown): string[] {
  if (!codesParam) return [];
  if (typeof codesParam === "string") {
    return codesParam.split(",").map(c => c.trim()).filter(Boolean);
  }
  if (Array.isArray(codesParam)) {
    return (codesParam as string[]).map(c => c.trim()).filter(Boolean);
  }
  return [];
}

export const getCategoriesWithAvailableShops = async (req: Request, res: Response) => {
  try {
    const { lat, lon, codes, country } = req.query;
    const hasGeo = lat != null && lon != null;
    const postalCodes = parsePostalCodes(codes);

    const countryQuery = buildCountryQuery(country);

    // 1) Pré-check pays (cohérent prod)
    if (countryQuery) {
      const countryCount = await ShopModel.countDocuments({
        ...countryQuery,
        active: true,
        status: "approved",
      });
      if (countryCount === 0) {
        return res.json([]); // aucune boutique dans ce pays
      }
    }

    // 2) Base query (cohérente prod)
    const baseQuery: any = {
      ...(countryQuery ?? {}),
      active: true,
      status: "approved",
    };

    // 3) Si filtres "codes" (et PAS de géoloc), on laisse Mongo pré-filtrer
    if (!hasGeo && postalCodes.length > 0) {
      baseQuery.deliveryPostalCodes = { $in: postalCodes };
    }

    // 4) Sélection minimale pour charger moins de data
    let shops = await ShopModel.find(baseQuery)
      .select("filter type trad location.maxDistance location.latitude location.longitude deliveryPostalCodes")
      .lean();

    // 5) Filtre géographique OU filtre strict par codes (comme avant)
    if (hasGeo) {
      const clientLatitude = parseFloat(lat as string);
      const clientLongitude = parseFloat(lon as string);

      shops = shops.filter((shop: any) => {
        if (!shop.location || shop.location.latitude == null || shop.location.longitude == null) return false;
        const distance = calculateDistance(
          clientLatitude,
          clientLongitude,
          shop.location.latitude,
          shop.location.longitude
        );
        return typeof shop.maxDistance === "number" && distance <= shop.maxDistance;
      });

    } else if (postalCodes.length > 0) {
      // stricte vérification côté Node (au cas où)
      shops = shops.filter((shop: any) => {
        if (!Array.isArray(shop.deliveryPostalCodes)) return false;
        return shop.deliveryPostalCodes.some((d: string) => postalCodes.includes(d));
      });
    }

    // 6) Construire la liste des slugs de catégories à partir des shops
    // Priorité : shop.filter -> shop.type -> suffixe de shop.trad
    const slugSet = new Set<string>();
    for (const s of shops) {
      const slug = toSlug(s.filter) || toSlug(s.type) || slugFromTrad(s.trad);
      if (slug) slugSet.add(slug);
    }

    const slugs = [...slugSet];
    if (slugs.length === 0) {
      return res.json([]); // aucun shop éligible => aucune catégorie
    }

    // 7) Récupérer les catégories correspondantes (actives), triées par position
    const categories = await CategoryModel.find({
      filter: { $in: slugs },
      active: true, // commente si tu veux tout, même inactives
    })
      .sort({ position: 1 })
      .lean();

    return res.json(categories);
  } catch (error: any) {
    // ton logger
    logger.error({
      msg: "getCategoriesWithAvailableShops.failed",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Erreur lors de la récupération des catégories disponibles" });
  }
};


// Récupérer toutes les catégories triées par position
const getAllCategories = async (req: Request, res: Response) => {
  try {
    let categories = await CategoryModel.find().sort({ position: 1 });

    let missingPosition = 1;
    let updates = 0;

    for (const category of categories) {
      if (!category.position || category.position !== missingPosition) {
        try {
          category.position = missingPosition;
          await category.save();
          updates++;
        } catch (saveError: any) {
          logger.error({
            msg: "getAllCategories position save failed",
            route: "GET /api/category",
            method: req.method,
            url: req.originalUrl,
            categoryId: category?._id?.toString(),
            errorName: saveError?.name,
            errorMessage: saveError?.message,
            stack: saveError?.stack,
          });
        }
      }
      missingPosition++;
    }

    if (updates > 0) {
      categories = await CategoryModel.find().sort({ position: 1 });
      logger.info({
        msg: "getAllCategories positions normalized",
        route: "GET /api/category",
        method: req.method,
        url: req.originalUrl,
        updates,
        total: categories.length,
      });
    } else {
      logger.info({
        msg: "getAllCategories success",
        route: "GET /api/category",
        method: req.method,
        url: req.originalUrl,
        total: categories.length,
      });
    }

    res.json(categories);
  } catch (error: any) {
    logger.error({
      msg: "getAllCategories failed",
      route: "GET /api/category",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les catégories", error });
  }
};

// Met à jour toutes les positions des catégories
const updatePositions = async (req: Request, res: Response) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      logger.warn({
        msg: "updatePositions bad request",
        route: "PUT /api/update-positions",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "Données invalides" });
    }

    await Promise.all(
      categories.map((cat: any, index: number) =>
        CategoryModel.findByIdAndUpdate(cat._id, { position: 9999 + index })
      )
    );
    await Promise.all(
      categories.map((cat: any, index: number) =>
        CategoryModel.findByIdAndUpdate(cat._id, { position: index + 1 })
      )
    );

    logger.info({
      msg: "updatePositions success",
      route: "PUT /api/update-positions",
      method: req.method,
      url: req.originalUrl,
      count: categories.length,
    });

    res.json({ message: "✅ Positions mises à jour avec succès" });
  } catch (error: any) {
    logger.error({
      msg: "updatePositions failed",
      route: "PUT /api/update-positions",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour les positions" });
  }
};

// Récupérer une catégorie par son ID
const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await CategoryModel.findById(id);

    if (category) {
      logger.info({
        msg: "getCategoryById success",
        route: "GET /api/category/:id",
        method: req.method,
        url: req.originalUrl,
        categoryId: id,
      });
      res.json(category);
    } else {
      logger.warn({
        msg: "getCategoryById not found",
        route: "GET /api/category/:id",
        method: req.method,
        url: req.originalUrl,
        categoryId: id,
      });
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getCategoryById failed",
      route: "GET /api/category/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la catégorie" });
  }
};

// Mettre à jour une catégorie par son ID
const updateCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedCategory = await CategoryModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedCategory) {
      logger.info({
        msg: "updateCategoryById success",
        route: "PUT /api/category/:id",
        method: req.method,
        url: req.originalUrl,
        categoryId: id,
        body: sanitize(req.body),
      });
      res.json(updatedCategory);
    } else {
      logger.warn({
        msg: "updateCategoryById not found",
        route: "PUT /api/category/:id",
        method: req.method,
        url: req.originalUrl,
        categoryId: id,
      });
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateCategoryById failed",
      route: "PUT /api/category/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour la catégorie" });
  }
};

// Supprimer une catégorie par son ID
const deleteCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCategory = await CategoryModel.findByIdAndDelete(id);

    if (deletedCategory) {
      logger.info({
        msg: "deleteCategoryById success",
        route: "DELETE /api/category/:id",
        method: req.method,
        url: req.originalUrl,
        categoryId: id,
      });
      res.json({ message: "Catégorie supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteCategoryById not found",
        route: "DELETE /api/category/:id",
        method: req.method,
        url: req.originalUrl,
        categoryId: id,
      });
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteCategoryById failed",
      route: "DELETE /api/category/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la catégorie" });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
  getCategoriesWithAvailableShops,
  updatePositions,
};
