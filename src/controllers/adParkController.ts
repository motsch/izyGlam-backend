import mongoose from "mongoose";
import adParkModel from "../models/adPark";
import * as express from "express";
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

// Créer une nouvelle campagne adPark
const createAdPark = async (req: express.Request, res: express.Response) => {
  try {
    const newAdPark = new adParkModel(req.body);
    await newAdPark.save();

    logger.info({
      msg: "createAdPark success",
      route: "POST /api/ad-park",
      method: req.method,
      url: req.originalUrl,
      userId: (req as any).user?._id,
      adParkId: newAdPark?._id?.toString(),
      body: sanitize(req.body),
    });

    res.status(201).json(newAdPark);
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de créer la campagne adPark." });
    logger.error({
      msg: "createAdPark failed",
      route: "POST /api/ad-park",
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

// Récupérer toutes les campagnes adPark
const getAllAdParks = async (req: express.Request, res: express.Response) => {
  try {
    const adParks = await adParkModel.find();

    logger.info({
      msg: "getAllAdParks success",
      route: "GET /api/ad-park",
      method: req.method,
      url: req.originalUrl,
      count: adParks.length,
    });

    res.json(adParks);
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de récupérer les campagnes adPark." });
    logger.error({
      msg: "getAllAdParks failed",
      route: "GET /api/ad-park",
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

// Récupérer une campagne adPark par son ID
const getAdParkById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    const adPark = await adParkModel.findById(id);
    if (adPark) {
      logger.info({
        msg: "getAdParkById success",
        route: "GET /api/ad-park/:id",
        method: req.method,
        url: req.originalUrl,
        adParkId: id,
      });
      res.json(adPark);
    } else {
      logger.warn({
        msg: "getAdParkById not found",
        route: "GET /api/ad-park/:id",
        method: req.method,
        url: req.originalUrl,
        adParkId: id,
      });
      res.status(404).json({ message: "Campagne adPark non trouvée." });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de récupérer la campagne adPark." });
    logger.error({
      msg: "getAdParkById failed",
      route: "GET /api/ad-park/:id",
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

// Récupérer un adPark par advertisementId
const getAdParkByAdvertisementId = async (req: express.Request, res: express.Response) => {
  try {
    const { advertisementId } = req.params;
    logger.info({
      msg: "getAdParkByAdvertisementId start",
      route: "GET /api/ad-park-by-advertisement/:advertisementId",
      method: req.method,
      url: req.originalUrl,
      advertisementId,
    });

    if (!mongoose.Types.ObjectId.isValid(advertisementId)) {
      logger.warn({
        msg: "getAdParkByAdvertisementId invalid ObjectId",
        route: "GET /api/ad-park-by-advertisement/:advertisementId",
        method: req.method,
        url: req.originalUrl,
        advertisementId,
      });
      return res.status(400).json({ message: "ID de publicité invalide." });
    }

    const castedId = new mongoose.Types.ObjectId(advertisementId);

    // Debug utile pour mismatch éventuels d’id en base
    const resultList = await adParkModel.find({}, { advertisementId: 1 });
    logger.info({
      msg: "getAdParkByAdvertisementId fetched list",
      route: "GET /api/ad-park-by-advertisement/:advertisementId",
      method: req.method,
      url: req.originalUrl,
      count: resultList.length,
      ids: resultList.map((p) => p.advertisementId?.toString()),
    });

    const adPark = await adParkModel.findOne({ advertisementId: castedId });
    if (adPark) {
      logger.info({
        msg: "getAdParkByAdvertisementId success",
        route: "GET /api/ad-park-by-advertisement/:advertisementId",
        method: req.method,
        url: req.originalUrl,
        advertisementId,
        adParkId: adPark._id?.toString(),
      });
      return res.json(adPark);
    } else {
      logger.warn({
        msg: "getAdParkByAdvertisementId not found",
        route: "GET /api/ad-park-by-advertisement/:advertisementId",
        method: req.method,
        url: req.originalUrl,
        advertisementId,
      });
      return res.status(404).json({ message: "❌ Aucun adPark trouvé avec cet advertisementId." });
    }
  } catch (error: any) {
    logger.error({
      msg: "getAdParkByAdvertisementId failed",
      route: "GET /api/ad-park-by-advertisement/:advertisementId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// Mettre à jour une campagne adPark par son ID
const updateAdParkById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedAdPark = await adParkModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedAdPark) {
      logger.info({
        msg: "updateAdParkById success",
        route: "PUT /api/ad-park/:id",
        method: req.method,
        url: req.originalUrl,
        adParkId: id,
        body: sanitize(req.body),
      });
      res.json(updatedAdPark);
    } else {
      logger.warn({
        msg: "updateAdParkById not found",
        route: "PUT /api/ad-park/:id",
        method: req.method,
        url: req.originalUrl,
        adParkId: id,
      });
      res.status(404).json({ message: "Campagne adPark non trouvée." });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de mettre à jour la campagne adPark." });
    logger.error({
      msg: "updateAdParkById failed",
      route: "PUT /api/ad-park/:id",
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

// Supprimer une campagne adPark par son ID
const deleteAdParkById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedAdPark = await adParkModel.findByIdAndDelete(id);

    if (deletedAdPark) {
      logger.info({
        msg: "deleteAdParkById success",
        route: "DELETE /api/ad-park/:id",
        method: req.method,
        url: req.originalUrl,
        adParkId: id,
      });
      res.json({ message: "Campagne adPark supprimée avec succès." });
    } else {
      logger.warn({
        msg: "deleteAdParkById not found",
        route: "DELETE /api/ad-park/:id",
        method: req.method,
        url: req.originalUrl,
        adParkId: id,
      });
      res.status(404).json({ message: "Campagne adPark non trouvée." });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de supprimer la campagne adPark." });
    logger.error({
      msg: "deleteAdParkById failed",
      route: "DELETE /api/ad-park/:id",
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
  createAdPark,
  getAllAdParks,
  getAdParkById,
  updateAdParkById,
  deleteAdParkById,
  getAdParkByAdvertisementId,
};
