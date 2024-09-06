import ServiceTemplateModel from "../models/serviceTemplate";
import * as express from "express";

// Créer un nouveau serviceTemplate
const createServiceTemplate = async (req: express.Request, res: express.Response) => {
  try {
    console.log(req.body)
    const newServiceTemplate = new ServiceTemplateModel(req.body);
    await newServiceTemplate.save();
    res.status(201).json(newServiceTemplate);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer le serviceTemplate" });
  }
};

// Récupérer tous les serviceTemplates
const getAllServiceTemplates = async (req: express.Request, res: express.Response) => {
  try {
    const serviceTemplates = await ServiceTemplateModel.find();
    res.json(serviceTemplates);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les serviceTemplates" });
  }
};

// Récupérer un serviceTemplate par son ID
const getServiceTemplateById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const serviceTemplate = await ServiceTemplateModel.findById(id);
    if (serviceTemplate) {
      res.json(serviceTemplate);
    } else {
      res.status(404).json({ message: "ServiceTemplate non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le serviceTemplate" });
  }
};

// Mettre à jour un serviceTemplate par son ID
const updateServiceTemplateById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedServiceTemplate = await ServiceTemplateModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedServiceTemplate) {
      res.json(updatedServiceTemplate);
    } else {
      res.status(404).json({ message: "ServiceTemplate non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour le serviceTemplate" });
  }
};

// Supprimer un serviceTemplate par son ID
const deleteServiceTemplateById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedServiceTemplate = await ServiceTemplateModel.findByIdAndDelete(id);
    if (deletedServiceTemplate) {
      res.json({ message: "ServiceTemplate supprimé avec succès" });
    } else {
      res.status(404).json({ message: "ServiceTemplate non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer le serviceTemplate" });
  }
};

// Récupérer tous les serviceTemplates proposés par un shop
const getServiceTemplatesByCategory = async (req: express.Request, res: express.Response) => {
  try {
    const { type } = req.params;
    // const serviceTemplates = await ServiceTemplateModel.find({ shopId: id });
    const serviceTemplates = await ServiceTemplateModel.find({ type: type });
    // const serviceTemplates = await ServiceTemplateModel.find();
    console.log("type serviceTemplateController: " + type)
    if (serviceTemplates.length > 0) {
      console.log("ServiceTemplate length > 0")
      res.json(serviceTemplates);
    } else {
      res.status(404).json({ message: "Aucun serviceTemplate trouvé pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les serviceTemplates pour cette boutique" });
  }
};

module.exports = {
  createServiceTemplate,
  getAllServiceTemplates,
  getServiceTemplateById,
  updateServiceTemplateById,
  deleteServiceTemplateById,
  getServiceTemplatesByCategory,
};
