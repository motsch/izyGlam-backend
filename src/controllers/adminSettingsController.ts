import * as express from "express";
import AdminSettingsModel from "../models/adminSettings";
import { logger } from "../utils/logger";

// Petite sanitisation pour éviter de logguer des secrets par erreur
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

// Créer ou initialiser les paramètres administratifs
const createAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const existingSettings = await AdminSettingsModel.findOne();
    if (existingSettings) {
      logger.warn({
        msg: "createAdminSettings already exists",
        route: "POST /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
        userId: (req as any).user?._id,
      });
      return res.status(400).json({ message: "Les paramètres administratifs existent déjà" });
    }

    const newSettings = new AdminSettingsModel(req.body);
    await newSettings.save();

    logger.info({
      msg: "createAdminSettings success",
      route: "POST /api/admin-settings",
      method: req.method,
      url: req.originalUrl,
      userId: (req as any).user?._id,
      settingsId: newSettings?._id?.toString(),
      body: sanitize(req.body),
    });

    res.status(201).json(newSettings);
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de créer les paramètres administratifs" });
    logger.error({
      msg: "createAdminSettings failed",
      route: "POST /api/admin-settings",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
};

// Récupérer les paramètres administratifs
const getAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const settings = await AdminSettingsModel.findOne();
    if (settings) {
      logger.info({
        msg: "getAdminSettings success",
        route: "GET /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
      });
      res.json(settings);
    } else {
      logger.warn({
        msg: "getAdminSettings not found",
        route: "GET /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
      });
      res.status(404).json({ message: "Paramètres administratifs non trouvés" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de récupérer les paramètres administratifs" });
    logger.error({
      msg: "getAdminSettings failed",
      route: "GET /api/admin-settings",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
};

// Mettre à jour les paramètres administratifs
const updateAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const updatedSettings = await AdminSettingsModel.findOneAndUpdate({}, req.body, {
      new: true,
    });

    if (updatedSettings) {
      logger.info({
        msg: "updateAdminSettings success",
        route: "PUT /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
        userId: (req as any).user?._id,
        body: sanitize(req.body),
      });
      res.json(updatedSettings);
    } else {
      logger.warn({
        msg: "updateAdminSettings not found",
        route: "PUT /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
      });
      res.status(404).json({ message: "Paramètres administratifs non trouvés" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de mettre à jour les paramètres administratifs" });
    logger.error({
      msg: "updateAdminSettings failed",
      route: "PUT /api/admin-settings",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
};

// Supprimer les paramètres administratifs
const deleteAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const deletedSettings = await AdminSettingsModel.findOneAndDelete();
    if (deletedSettings) {
      logger.info({
        msg: "deleteAdminSettings success",
        route: "DELETE /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
        userId: (req as any).user?._id,
      });
      res.json({ message: "Paramètres administratifs supprimés avec succès" });
    } else {
      logger.warn({
        msg: "deleteAdminSettings not found",
        route: "DELETE /api/admin-settings",
        method: req.method,
        url: req.originalUrl,
      });
      res.status(404).json({ message: "Paramètres administratifs non trouvés" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de supprimer les paramètres administratifs" });
    logger.error({
      msg: "deleteAdminSettings failed",
      route: "DELETE /api/admin-settings",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
};

module.exports = {
  createAdminSettings,
  getAdminSettings,
  updateAdminSettings,
  deleteAdminSettings,
};
