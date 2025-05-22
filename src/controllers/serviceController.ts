import ServiceModel from "../models/service";
import ShopModel from "../models/shop";
import ServiceTemplateModel from "../models/serviceTemplate";
import * as express from "express";
import { Request, Response } from 'express';

// Étendre l'interface Request pour inclure la propriété 'files'
interface MulterRequest extends Request {
  file: Express.Multer.File; // Correctement typé
}

// Créer un nouveau service
const createService = async (req: express.Request, res: express.Response) => {
  try {
    console.log("📥 Données reçues pour création de service :", req.body);

    const newService = new ServiceModel(req.body);
    await newService.save();

    console.log("✅ Nouveau service enregistré :", newService);
    res.status(201).json(newService);
  } catch (error: any) {
    console.error("❌ Erreur lors de la création du service :", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Erreur de validation",
        details: error.message,
      });
    }

    res.status(500).json({
      message: "Impossible de créer le service",
      error: error.message,
    });
  }
};


// Récupérer tous les services
const getAllServices = async (req: express.Request, res: express.Response) => {
  try {
    const services = await ServiceModel.find();
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les services" });
  }
};

// Récupérer un service par son ID
const getServiceById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const service = await ServiceModel.findById(id);
    if (service) {
      res.json(service);
    } else {
      res.status(404).json({ message: "Service non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le service" });
  }
};

// Mettre à jour un service par son ID
const updateServiceById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedService = await ServiceModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedService) {
      res.json(updatedService);
    } else {
      res.status(404).json({ message: "Service non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour le service" });
  }
};

// Supprimer un service par son ID
const deleteServiceById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedService = await ServiceModel.findByIdAndDelete(id);
    if (deletedService) {
      res.json({ message: "Service supprimé avec succès" });
    } else {
      res.status(404).json({ message: "Service non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer le service" });
  }
};

// Récupérer tous les services proposés par un shop
const getServicesByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    let services = await ServiceModel.find({ shopId: id });

    if (services.length > 0) {
      return res.json(services);
    }

    console.log("Aucun service trouvé, on cherche un template…");

    const shop = await ShopModel.findById(id);
    if (!shop) {
      return res.status(404).json({ message: "Boutique introuvable" });
    }

    let template = await ServiceTemplateModel.findOne({ type: shop.type, active: true });

    if (!template) {
      console.log("Pas de template du même type, on en prend un actif au hasard");
      template = await ServiceTemplateModel.findOne({ active: true });
    }

    if (!template) {
      return res.status(500).json({ message: "Aucun template de service actif disponible pour créer un service" });
    }

    // 👇 On définit une couleur par défaut si absente
    const color = template.color || "#ff4081"; // Rose IzyGlam si non défini

    const newService = new ServiceModel({
      name: template.name,
      description: template.description,
      image: template.image,
      type: template.type,
      price: template.price,
      duration: template.duration,
      color: color,
      shopId: id,
    });

    await newService.save();

    console.log("Service créé automatiquement à partir du template");
    res.json([newService]);

  } catch (error) {
    console.error("Erreur dans getServicesByShop :", error);
    res.status(500).json({ message: "Erreur lors de la récupération ou de la création des services." });
  }
};


// Créer plusieurs services en une seule requête
const createMultipleServices = async (req: express.Request, res: express.Response) => {
  try {
    const servicesArray = req.body; // Attends un tableau d'objets de services
    if (!Array.isArray(servicesArray)) {
      return res.status(400).json({ message: "Veuillez fournir un tableau de services." });
    }

    const newServices = await ServiceModel.insertMany(servicesArray);
    res.status(201).json(newServices);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer les services" });
  }
};



// Upload images to a service's gallery
const uploadGalleryImages = async (req: MulterRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;  // Récupérer les fichiers uploadés via Multer
    console.log("id Gallery ===> " + id)
    console.log("file Gallery ===> " + file)
    if (!file) {
      return res.status(400).json({ message: "Aucune image uploadée" });
    }

    const service = await ServiceModel.findById(id);
    if (!service) {
      return res.status(404).json({ message: "Service non trouvée" });
    }

    // Extraire les noms des fichiers
    const imagePaths = `/uploads/images/articles/${file.filename}`;
    console.log("imagePaths : " + imagePaths);

    // Ajouter les chemins des fichiers à la galerie
    if (!service.image) {
      service.image = 'default.png';
    }
    service.image = imagePaths;
    console.log("shop.galleryImages : " + service.image);
    // Sauvegarder les chemins des fichiers dans la base de données
    await service.updateOne({ image: service.image });

    res.status(200).json({ message: "Images uploadées avec succès", image: service.image });
  } catch (error: any) {
    console.error("Erreur upload image :", error);
    res.status(500).json({
      message: "Erreur lors de l'upload de l'image du service",
      error: error.message,
    });
  }

};


// Get all gallery images for a specific shop
const getGalleryImages = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log("id ShopGallery : " + id);
    // Trouver le shop par son ID
    const service = await ServiceModel.findById(id);
    if (!service || !service.image) {
      return res.status(404).json({ message: "Service ou image de la prestation non trouvée" });
    }

    // Retourner les images de la galerie
    res.status(200).json({ image: service.image });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération des images de la prestation" });
  }
};

// Delete all services by shop ID
const deleteAllServicesByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { shopId } = req.params;
    const deletedServices = await ServiceModel.deleteMany({ shopId: shopId });

    if (deletedServices.deletedCount > 0) {
      res.status(200).json({ message: `${deletedServices.deletedCount} services supprimés avec succès pour la boutique ${shopId}` });
    } else {
      res.status(404).json({ message: "Aucun service trouvé pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la suppression des services de la boutique" });
  }
};


module.exports = {
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
