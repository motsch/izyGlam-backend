import ServiceModel from "../models/service";
import * as express from "express";

// Créer un nouveau service
const createService = async (req: express.Request, res: express.Response) => {
  try {
    console.log(req.body)
    const newService = new ServiceModel(req.body);
    await newService.save();
    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer le service" });
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
    // const services = await ServiceModel.find({ shopId: id });
    const services = await ServiceModel.find({ shopId: id });
    // const services = await ServiceModel.find();
    console.log("shopId serviceController: " + id)
    if (services.length > 0) {
      console.log("Service length > 0")
      res.json(services);
    } else {
      res.status(404).json({ message: "Aucun service trouvé pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les services pour cette boutique" });
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


module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateServiceById,
  deleteServiceById,
  getServicesByShop,
  createMultipleServices,
};
