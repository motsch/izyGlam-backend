import ColorModel from "../models/color";
import * as express from "express";
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

// Créer une nouvelle couleur
const createColor = async (req: express.Request, res: express.Response) => {
  try {
    const newColor = new ColorModel(req.body);
    await newColor.save();

    logger.info({
      msg: "createColor success",
      route: "POST /api/color",
      method: req.method,
      url: req.originalUrl,
      colorId: newColor?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newColor);
  } catch (error: any) {
    logger.error({
      msg: "createColor failed",
      route: "POST /api/color",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la couleur" });
  }
};

// Récupérer toutes les couleurs
const getAllColors = async (req: express.Request, res: express.Response) => {
  try {
    const colors = await ColorModel.find();

    logger.info({
      msg: "getAllColors success",
      route: "GET /api/color",
      method: req.method,
      url: req.originalUrl,
      count: colors.length,
    });

    res.json(colors);
  } catch (error: any) {
    logger.error({
      msg: "getAllColors failed",
      route: "GET /api/color",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les couleurs" });
  }
};

// Récupérer une couleur par son ID
const getColorById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const color = await ColorModel.findById(id);

    if (color) {
      logger.info({
        msg: "getColorById success",
        route: "GET /api/color/:id",
        method: req.method,
        url: req.originalUrl,
        colorId: id,
      });
      res.json(color);
    } else {
      logger.warn({
        msg: "getColorById not found",
        route: "GET /api/color/:id",
        method: req.method,
        url: req.originalUrl,
        colorId: id,
      });
      res.status(404).json({ message: "Couleur non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getColorById failed",
      route: "GET /api/color/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la couleur" });
  }
};

// Mettre à jour une couleur par son ID
const updateColorById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedColor = await ColorModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedColor) {
      logger.info({
        msg: "updateColorById success",
        route: "PUT /api/color/:id",
        method: req.method,
        url: req.originalUrl,
        colorId: id,
        body: sanitize(req.body),
      });
      res.json(updatedColor);
    } else {
      logger.warn({
        msg: "updateColorById not found",
        route: "PUT /api/color/:id",
        method: req.method,
        url: req.originalUrl,
        colorId: id,
      });
      res.status(404).json({ message: "Couleur non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateColorById failed",
      route: "PUT /api/color/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour la couleur" });
  }
};

// Supprimer une couleur par son ID
const deleteColorById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedColor = await ColorModel.findByIdAndDelete(id);

    if (deletedColor) {
      logger.info({
        msg: "deleteColorById success",
        route: "DELETE /api/color/:id",
        method: req.method,
        url: req.originalUrl,
        colorId: id,
      });
      res.json({ message: "Couleur supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteColorById not found",
        route: "DELETE /api/color/:id",
        method: req.method,
        url: req.originalUrl,
        colorId: id,
      });
      res.status(404).json({ message: "Couleur non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteColorById failed",
      route: "DELETE /api/color/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la couleur" });
  }
};

module.exports = {
  createColor,
  getAllColors,
  getColorById,
  updateColorById,
  deleteColorById,
};
