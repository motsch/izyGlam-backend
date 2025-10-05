import ServiceTemplateModel from "../models/serviceTemplate";
import * as express from "express";
import { logger } from "../utils/logger";

// Récupérer tous les serviceTemplates avec un seul par type
const getUniqueServiceTemplatesByType = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.uniqueByType.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      query: req.query,
    });

    let uniqueTemplateArray: any[] = [];
    const serviceTemplates = await ServiceTemplateModel.find();

    serviceTemplates.forEach(template => {
      if (!uniqueTemplateArray.includes(template.type)) {
        uniqueTemplateArray.push(template.type);
      }
    });

    let finalArray: any[] = [];
    for (let elem of uniqueTemplateArray) {
      console.log(elem);
      const elemToKeep = serviceTemplates.find(template => template.type === elem);
      if (elemToKeep) {
        finalArray.push(elemToKeep);
      }
    }

    logger.info({
      msg: "serviceTemplate.uniqueByType.success",
      uniqueTypes: uniqueTemplateArray.length,
      returned: finalArray.length,
    });

    res.json(finalArray);
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.uniqueByType.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les serviceTemplates par type" });
  }
};

// Créer un nouveau serviceTemplate
const createServiceTemplate = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.create.start",
      route: req.originalUrl,
      method: req.method,
      bodyKeys: Object.keys(req.body || {}),
    });
    console.log(req.body);

    const newServiceTemplate = new ServiceTemplateModel(req.body);
    await newServiceTemplate.save();

    logger.info({
      msg: "serviceTemplate.create.success",
      id: newServiceTemplate._id?.toString(),
      type: newServiceTemplate.type,
    });

    res.status(201).json(newServiceTemplate);
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.create.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer le serviceTemplate" });
  }
};

// Récupérer tous les serviceTemplates
const getAllServiceTemplates = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.list.start",
      route: req.originalUrl,
      method: req.method,
      query: req.query,
    });

    const serviceTemplates = await ServiceTemplateModel.find();

    logger.info({
      msg: "serviceTemplate.list.success",
      count: serviceTemplates.length,
    });

    res.json(serviceTemplates);
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.list.error",
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les serviceTemplates" });
  }
};

// Récupérer un serviceTemplate par son ID
const getServiceTemplateById = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.get.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });

    const { id } = req.params;
    const serviceTemplate = await ServiceTemplateModel.findById(id);

    if (serviceTemplate) {
      logger.info({ msg: "serviceTemplate.get.success", id });
      res.json(serviceTemplate);
    } else {
      logger.warn({ msg: "serviceTemplate.get.not_found", id });
      res.status(404).json({ message: "ServiceTemplate non trouvé 1" });
    }
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.get.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer le serviceTemplate" });
  }
};

// Mettre à jour un serviceTemplate par son ID
const updateServiceTemplateById = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.update.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { id } = req.params;
    const updatedServiceTemplate = await ServiceTemplateModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedServiceTemplate) {
      logger.info({ msg: "serviceTemplate.update.success", id });
      res.json(updatedServiceTemplate);
    } else {
      logger.warn({ msg: "serviceTemplate.update.not_found", id });
      res.status(404).json({ message: "ServiceTemplate non trouvé 2" });
    }
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.update.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour le serviceTemplate" });
  }
};

// Supprimer un serviceTemplate par son ID
const deleteServiceTemplateById = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.delete.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });

    const { id } = req.params;
    const deletedServiceTemplate = await ServiceTemplateModel.findByIdAndDelete(id);

    if (deletedServiceTemplate) {
      logger.info({ msg: "serviceTemplate.delete.success", id });
      res.json({ message: "ServiceTemplate supprimé avec succès" });
    } else {
      logger.warn({ msg: "serviceTemplate.delete.not_found", id });
      res.status(404).json({ message: "ServiceTemplate non trouvé 3" });
    }
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.delete.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer le serviceTemplate" });
  }
};

// Récupérer tous les serviceTemplates proposés par un shop
const getServiceTemplatesByCategory = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "serviceTemplate.byCategory.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });

    const { type } = req.params;
    const serviceTemplates = await ServiceTemplateModel.find({ type: type });
    console.log("type serviceTemplateController: " + type);

    if (serviceTemplates.length > 0) {
      logger.info({
        msg: "serviceTemplate.byCategory.success",
        type,
        count: serviceTemplates.length,
      });
      console.log("ServiceTemplate length > 0");
      res.json(serviceTemplates);
    } else {
      logger.warn({ msg: "serviceTemplate.byCategory.none_found", type });
      res.status(404).json({ message: "Aucun serviceTemplate trouvé pour cette boutique" });
    }
  } catch (error: any) {
    logger.error({
      msg: "serviceTemplate.byCategory.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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
  getUniqueServiceTemplatesByType,
};
