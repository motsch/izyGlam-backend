import { Request, Response } from "express";
import CategoryModel from "../models/category";
import ShopModel from "../models/shop";
import { logger } from "../utils/logger";

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

// Catégories disponibles en fonction des shops filtrés (geo OU codes postaux)
const getCategoriesWithAvailableShops = async (req: Request, res: Response) => {
  try {
    const { lat, lon, codes } = req.query;

    let shops = await ShopModel.find();

    // Filtrage géo
    if (lat && lon) {
      const clientLatitude = parseFloat(lat as string);
      const clientLongitude = parseFloat(lon as string);

      const before = shops.length;
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

      logger.info({
        msg: "getCategoriesWithAvailableShops geo filter",
        route: "GET /api/category/available",
        method: req.method,
        url: req.originalUrl,
        initial: before,
        filtered: shops.length,
        lat: clientLatitude,
        lon: clientLongitude,
      });
    }
    // Filtrage par codes postaux
    else if (codes) {
      let postalCodes: string[] = [];
      if (typeof codes === "string") postalCodes = (codes as string).split(",").map((c) => c.trim());
      else if (Array.isArray(codes)) postalCodes = (codes as string[]).map((c) => c.trim());

      const before = shops.length;
      shops = shops.filter((shop: any) => {
        if (!Array.isArray(shop.deliveryPostalCodes)) return false;
        return shop.deliveryPostalCodes.some((deliveryCode: string) => postalCodes.includes(deliveryCode));
      });

      logger.info({
        msg: "getCategoriesWithAvailableShops postal filter",
        route: "GET /api/category/available",
        method: req.method,
        url: req.originalUrl,
        initial: before,
        filtered: shops.length,
        postalCodesCount: postalCodes.length,
      });
    } else {
      logger.info({
        msg: "getCategoriesWithAvailableShops no filter",
        route: "GET /api/category/available",
        method: req.method,
        url: req.originalUrl,
        totalShops: shops.length,
      });
    }

    // On collecte les clés de trad présentes dans les shops filtrées
    const tradKeys = [...new Set(shops.map((s: any) => s.trad).filter(Boolean))];

    const categories = await CategoryModel.find({
      trad: { $in: tradKeys },
      // active: true, // décommente si tu veux filtrer que les actives
    });

    logger.info({
      msg: "getCategoriesWithAvailableShops success",
      route: "GET /api/category/available",
      method: req.method,
      url: req.originalUrl,
      categories: categories.length,
      tradKeys: tradKeys.length,
    });

    return res.json(categories);
  } catch (error: any) {
    logger.error({
      msg: "getCategoriesWithAvailableShops failed",
      route: "GET /api/category/available",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: "Erreur lors de la récupération des catégories disponibles",
    });
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
