import ServiceModel from "../models/service";
import ShopModel from "../models/shop";
import ServiceTemplateModel from "../models/serviceTemplate";
import { Request, Response } from "express";

// Étendre l'interface Request pour inclure la propriété 'file' de multer
interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// 📌 Créer un nouveau service
const createService = async (req: Request, res: Response) => {
  try {
    console.log("📥 Données reçues pour création :", req.body);
    const newService = new ServiceModel(req.body);
    await newService.save();

    console.log("✅ Nouveau service enregistré :", newService);
    res.status(201).json(newService);
  } catch (error: any) {
    console.error("❌ Erreur création service :", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Erreur de validation", details: error.message });
    }
    res.status(500).json({ message: "Impossible de créer le service", error: error.message });
  }
};

// 📦 Récupérer tous les services
const getAllServices = async (_req: Request, res: Response) => {
  try {
    const services = await ServiceModel.find();
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Erreur récupération services" });
  }
};

// 🔎 Récupérer un service par son ID
const getServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = await ServiceModel.findById(id);
    if (!service) return res.status(404).json({ message: "Service non trouvé" });

    res.json(service);
  } catch (error) {
    res.status(500).json({ message: "Erreur récupération du service" });
  }
};

// 🛠️ Mettre à jour un service
const updateServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedService = await ServiceModel.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedService) return res.status(404).json({ message: "Service non trouvé" });

    res.json(updatedService);
  } catch (error) {
    res.status(500).json({ message: "Erreur mise à jour du service" });
  }
};

// 🗑️ Supprimer un service
const deleteServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await ServiceModel.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Service non trouvé" });

    res.json({ message: "Service supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur suppression service" });
  }
};

// 📂 Récupérer les services d’un shop ou créer à partir d’un template
const getServicesByShop = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let services = await ServiceModel.find({ shopId: id });

    if (services.length > 0) return res.json(services);

    const shop = await ShopModel.findById(id);
    if (!shop) return res.status(404).json({ message: "Boutique introuvable" });

    let template = await ServiceTemplateModel.findOne({ type: shop.type, active: true }) 
                || await ServiceTemplateModel.findOne({ active: true });

    if (!template) return res.status(500).json({ message: "Aucun template actif disponible" });

    const color = template.color || "#ff4081"; // Par défaut rose IzyGlam

    const newService = new ServiceModel({
      name: template.name,
      description: template.description,
      image: template.image,
      type: template.type,
      price: template.price,
      duration: template.duration,
      color,
      shopId: id,
    });

    await newService.save();
    res.json([newService]);

  } catch (error) {
    console.error("Erreur getServicesByShop :", error);
    res.status(500).json({ message: "Erreur lors de la récupération ou création de services." });
  }
};

// 📥 Upload image de galerie pour un service
const uploadGalleryImages = async (req: MulterRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Aucune image reçue." });
    }

    const service = await ServiceModel.findById(id);
    if (!service) {
      return res.status(404).json({ message: "Service introuvable." });
    }

    const imagePath = `/uploads/images/articles/${file.filename}`;
    service.image = imagePath;
    await service.save();

    console.log(`✅ Image enregistrée : ${imagePath}`);
    res.status(200).json({ message: "Image uploadée avec succès", image: service.image });

  } catch (error: any) {
    console.error("❌ Erreur uploadGalleryImages :", error);
    res.status(500).json({ message: "Erreur lors de l'upload de l'image du service", error: error.message });
  }
};

// 🖼️ Récupérer image d’un service
const getGalleryImages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = await ServiceModel.findById(id);

    if (!service || !service.image) {
      return res.status(404).json({ message: "Image ou service introuvable" });
    }

    res.status(200).json({ image: service.image });
  } catch (error) {
    res.status(500).json({ message: "Erreur récupération image" });
  }
};

// 🧹 Supprimer tous les services d’une boutique
const deleteAllServicesByShop = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const deleted = await ServiceModel.deleteMany({ shopId });

    if (deleted.deletedCount === 0) {
      return res.status(404).json({ message: "Aucun service à supprimer" });
    }

    res.status(200).json({ message: `${deleted.deletedCount} services supprimés avec succès` });
  } catch (error) {
    res.status(500).json({ message: "Erreur suppression services" });
  }
};

// 🚀 Créer plusieurs services en une seule requête
const createMultipleServices = async (req: Request, res: Response) => {
  try {
    const servicesArray = req.body;
    if (!Array.isArray(servicesArray)) {
      return res.status(400).json({ message: "Format attendu : tableau de services" });
    }

    const newServices = await ServiceModel.insertMany(servicesArray);
    res.status(201).json(newServices);
  } catch (error) {
    res.status(500).json({ message: "Erreur création multiple" });
  }
};

export default {
  createService,
  getAllServices,
  getServiceById,
  updateServiceById,
  deleteServiceById,
  getServicesByShop,
  createMultipleServices,
  uploadGalleryImages,
  getGalleryImages,
  deleteAllServicesByShop,
};
