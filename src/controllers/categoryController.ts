import { Request, Response } from "express";
import CategoryModel from "../models/category";
import ShopModel from "../models/shop";

// Créer une nouvelle catégorie
const createCategory = async (req: Request, res: Response) => {
  try {
    const newCategory = new CategoryModel(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la catégorie" });
  }
};

// Fonction de calcul de distance (formule de Haversine)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Rayon de la Terre en km
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = radLat2 - radLat1;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getCategoriesWithAvailableShops = async (req: Request, res: Response) => {
  try {
    const { lat, lon, codes } = req.query;

    console.log("Query parameters:", { lat, lon, codes });

    // Récupérer toutes les boutiques
    let shops = await ShopModel.find();
    console.log(`Total shops récupérées: ${shops.length}`);

    // Si lat et lon sont fournis, on filtre par distance uniquement
    if (lat && lon) {
      const clientLatitude = parseFloat(lat as string);
      const clientLongitude = parseFloat(lon as string);
      console.log("Filtrage par géolocalisation avec:", {
        clientLatitude,
        clientLongitude,
      });

      const shopsBeforeFilter = shops.length;
      shops = shops.filter((shop) => {
        if (
          !shop.location ||
          shop.location.latitude === undefined ||
          shop.location.longitude === undefined
        ) {
          return false;
        }
        const distance = calculateDistance(
          clientLatitude,
          clientLongitude,
          shop.location.latitude,
          shop.location.longitude
        );
        console.log(
          `Shop ${shop._id}: distance calculée = ${distance.toFixed(2)} km, maxDistance = ${shop.maxDistance} km`
        );
        return distance <= shop.maxDistance;
      });
      console.log(
        `Shops filtrées par géolocalisation: ${shops.length} sur ${shopsBeforeFilter}`
      );
    }
    // Sinon, si des codes postaux sont fournis, on filtre par codes postaux uniquement
    else if (codes) {
      let postalCodes: string[] = [];
      if (typeof codes === "string") {
        postalCodes = codes.split(",").map((c) => c.trim());
      } else if (Array.isArray(codes)) {
        postalCodes = (codes as string[]).map((c) => c.trim());
      }
      console.log("Filtrage par codes postaux avec:", postalCodes);

      const shopsBeforeFilter = shops.length;
      shops = shops.filter((shop) => {
        if (!shop.deliveryPostalCodes || !Array.isArray(shop.deliveryPostalCodes)) {
          return false;
        }
        const match = shop.deliveryPostalCodes.some((deliveryCode: string) =>
          postalCodes.includes(deliveryCode)
        );
        console.log(
          `Shop ${shop._id}: deliveryPostalCodes = ${shop.deliveryPostalCodes}, match: ${match}`
        );
        return match;
      });
      console.log(
        `Shops filtrées par codes postaux: ${shops.length} sur ${shopsBeforeFilter}`
      );
    } else {
      console.log("Aucun filtre fourni, utilisation de toutes les shops disponibles");
    }

    // Extraction des catégories depuis les shops. 
    // Ici on suppose que le champ "type" dans Shop correspond au nom de la catégorie.
    const categoryNames = shops.map((shop) => shop.type);
    console.log("Catégories extraites des shops:", categoryNames);

    const uniqueCategoryNames = [...new Set(categoryNames)];
    console.log("Catégories uniques:", uniqueCategoryNames);

    // Recherche insensible à la casse grâce aux expressions régulières
    const regexNames = uniqueCategoryNames.map(name => new RegExp(`^${name}$`, 'i'));
    const categories = await CategoryModel.find({
      name: { $in: regexNames },
    });
    console.log(`Nombre de catégories trouvées: ${categories.length}`);

    return res.json(categories);
  } catch (error) {
    console.error("Erreur dans getCategoriesWithAvailableShops:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des catégories disponibles",
    });
  }
};

// Récupérer toutes les catégories
const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await CategoryModel.find();
    // console.log(categories);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les catégories" });
  }
};

// Récupérer une catégorie par son ID
const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await CategoryModel.findById(id);
    if (category) {
      res.json(category);
    } else {
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la catégorie" });
  }
};

// Mettre à jour une catégorie par son ID
const updateCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedCategory = await CategoryModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedCategory) {
      res.json(updatedCategory);
    } else {
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la catégorie" });
  }
};

// Supprimer une catégorie par son ID
const deleteCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCategory = await CategoryModel.findByIdAndDelete(id);
    if (deletedCategory) {
      res.json({ message: "Catégorie supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error) {
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
};
