import { Request, Response } from "express";
import serviceCategoryModel from "../models/serviceCategory";

// Petite helper: récupère l'id du pro depuis req.user ou req.userId
function getUserProId(req: any): string {
  return (req.user?._id || req.userId || req.user?.id || "").toString();
}

/**
 * POST /booking-categories
 * Body: { name, description?, shopId, color?, order?, active? }
 */
export const createBookingCategory = async (req: Request, res: Response) => {
  try {
    const userProId = getUserProId(req);
    if (!userProId) return res.status(401).json({ message: "Non authentifié." });

    const { name, description, shopId, color, order, active } = req.body;

    if (!name || !shopId) {
      return res.status(400).json({ message: "name et shopId sont obligatoires." });
    }

    const category = await serviceCategoryModel.create({
      name: String(name).trim(),
      description,
      shopId: String(shopId),
      userProId,
      color,
      order: typeof order === "number" ? order : 0,
      active: typeof active === "boolean" ? active : true,
    });

    return res.status(201).json(category);
  } catch (error: any) {
    // Index unique (shopId + name)
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Une catégorie avec ce nom existe déjà pour ce salon." });
    }
    return res.status(500).json({ message: "Erreur serveur", error: error?.message });
  }
};

/**
 * GET /booking-categories?shopId=xxx&active=true
 * Liste des catégories d'un salon (scopé pro)
 */
export const getBookingCategories = async (req: Request, res: Response) => {
  try {
    const userProId = getUserProId(req);
    if (!userProId) return res.status(401).json({ message: "Non authentifié." });

    const { shopId, active } = req.query;

    if (!shopId) {
      return res.status(400).json({ message: "shopId est obligatoire en query." });
    }

    const filter: any = {
      shopId: String(shopId),
      userProId,
    };

    // active optionnel (si fourni)
    if (active !== undefined) {
      filter.active = String(active) === "true";
    }

    const categories = await serviceCategoryModel
      .find(filter)
      .sort({ order: 1, name: 1 });

    return res.status(200).json(categories);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur serveur", error: error?.message });
  }
};

/**
 * GET /booking-categories/:id
 */
export const getBookingCategoryById = async (req: Request, res: Response) => {
  try {
    const userProId = getUserProId(req);
    if (!userProId) return res.status(401).json({ message: "Non authentifié." });

    const { id } = req.params;

    const category = await serviceCategoryModel.findOne({ _id: id, userProId });
    if (!category) return res.status(404).json({ message: "Catégorie introuvable." });

    return res.status(200).json(category);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur serveur", error: error?.message });
  }
};

/**
 * PUT /booking-categories/:id
 * Body: { name?, description?, color?, order?, active? }
 * (shopId et userProId non modifiables ici -> sécurité)
 */
export const updateBookingCategory = async (req: Request, res: Response) => {
  try {
    const userProId = getUserProId(req);
    if (!userProId) return res.status(401).json({ message: "Non authentifié." });

    const { id } = req.params;
    const { name, description, color, order, active } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = order;
    if (active !== undefined) updateData.active = active;

    const updated = await serviceCategoryModel.findOneAndUpdate(
      { _id: id, userProId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Catégorie introuvable." });

    return res.status(200).json(updated);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Une catégorie avec ce nom existe déjà pour ce salon." });
    }
    return res.status(500).json({ message: "Erreur serveur", error: error?.message });
  }
};

/**
 * DELETE /booking-categories/:id
 * Suppression "hard delete"
 * (si tu préfères soft delete => set active=false)
 */
export const deleteBookingCategory = async (req: Request, res: Response) => {
  try {
    const userProId = getUserProId(req);
    if (!userProId) return res.status(401).json({ message: "Non authentifié." });

    const { id } = req.params;

    const deleted = await serviceCategoryModel.findOneAndDelete({ _id: id, userProId });
    if (!deleted) return res.status(404).json({ message: "Catégorie introuvable." });

    return res.status(200).json({ message: "Catégorie supprimée." });
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur serveur", error: error?.message });
  }
};

/**
 * PATCH /booking-categories/reorder
 * Body: { shopId: string, orders: Array<{ id: string, order: number }> }
 * Permet de reorder rapidement côté UI
 */
export const reorderBookingCategories = async (req: Request, res: Response) => {
  try {
    const userProId = getUserProId(req);
    if (!userProId) return res.status(401).json({ message: "Non authentifié." });

    const { shopId, orders } = req.body;

    if (!shopId || !Array.isArray(orders)) {
      return res.status(400).json({ message: "shopId et orders[] sont obligatoires." });
    }

    // Vérifie que toutes les catégories appartiennent bien au pro + shop
    const ops = orders.map((o: any) => ({
      updateOne: {
        filter: { _id: o.id, userProId, shopId: String(shopId) },
        update: { $set: { order: Number(o.order) } },
      },
    }));

    await serviceCategoryModel.bulkWrite(ops);

    const refreshed = await serviceCategoryModel
      .find({ shopId: String(shopId), userProId })
      .sort({ order: 1, name: 1 });

    return res.status(200).json(refreshed);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur serveur", error: error?.message });
  }
};

/**
 * GET /bookingCategory/shop/:shopId
 * Récupère toutes les catégories d’un salon
 */
export const getBookingCategoriesByShopId = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    if (!shopId) {
      return res.status(400).json({ message: "shopId manquant." });
    }

    const categories = await serviceCategoryModel.find({
      shopId,
      active: true, // optionnel mais logique côté métier
    }).sort({ order: 1, name: 1 });

    return res.status(200).json(categories);
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la récupération des catégories",
      error: error.message,
    });
  }
};