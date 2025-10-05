import * as express from "express";
import AdvertisementModel from "../models/advertisement";
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

// Créer une nouvelle publicité
export const addAdvertisement = async (req: express.Request, res: express.Response) => {
  try {
    const newAd = new AdvertisementModel(req.body);
    await newAd.save();

    logger.info({
      msg: "addAdvertisement success",
      route: "POST /api/ads",
      method: req.method,
      url: req.originalUrl,
      userId: (req as any).user?._id,
      adId: newAd?._id?.toString(),
    });

    res.status(201).json(newAd);
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de l’ajout de la pub", error });
    logger.error({
      msg: "addAdvertisement failed",
      route: "POST /api/ads",
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

// Récupérer les publicités selon le type (PREMIUM ou CLASSIC) et non expirées
export const getAdvertisements = async (req: express.Request, res: express.Response) => {
  try {
    const now = new Date();
    const { type } = req.query;

    // Vérifie que le type est bien défini et valide
    const filterType = type === "PREMIUM" || type === "CLASSIC" ? (type as string) : null;

    const filter: any = {
      date_expiration: { $gte: now },
    };

    // Si un type valide est fourni, on l'ajoute au filtre
    if (filterType) {
      filter.type = filterType;
    }

    const ads = await AdvertisementModel.find(filter).sort({
      nombre_affichages_valides: 1,
    });

    logger.info({
      msg: "getAdvertisements success",
      route: "GET /api/ads",
      method: req.method,
      url: req.originalUrl,
      count: ads.length,
      type: filterType || "ANY",
    });

    res.json(ads);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des pubs", error });

    logger.error({
      msg: "getAdvertisements failed",
      route: "GET /api/ads",
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

// Récupérer une publicité par son ID
export const getAdvertisementById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const ad = await AdvertisementModel.findById(id);

    if (ad) {
      logger.info({
        msg: "getAdvertisementById success",
        route: "GET /api/ads/:id",
        method: req.method,
        url: req.originalUrl,
        adId: id,
      });
      res.json(ad);
    } else {
      logger.warn({
        msg: "getAdvertisementById not found",
        route: "GET /api/ads/:id",
        method: req.method,
        url: req.originalUrl,
        adId: id,
      });
      res.status(404).json({ message: "Publicité non trouvée" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Impossible de récupérer la publicité", error });

    logger.error({
      msg: "getAdvertisementById failed",
      route: "GET /api/ads/:id",
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

// Mettre à jour une publicité par son ID
export const updateAdvertisement = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedAd = await AdvertisementModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    logger.info({
      msg: "updateAdvertisement success",
      route: "PUT /api/ads/:id",
      method: req.method,
      url: req.originalUrl,
      adId: id,
    });

    res.json(updatedAd);
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la mise à jour", error });

    logger.error({
      msg: "updateAdvertisement failed",
      route: "PUT /api/ads/:id",
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

// Incrémenter le nombre d'impressions
export const incrementImpression = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    const ad = await AdvertisementModel.findById(id);
    if (!ad) {
      logger.warn({
        msg: "incrementImpression not found",
        route: "PUT /api/ads/:id/impression",
        method: req.method,
        url: req.originalUrl,
        adId: id,
      });
      return res.status(404).json({ message: "Publicité non trouvée" });
    }

    ad.impressions += 1;
    ad.taux_conversion = ad.impressions > 0 ? (ad.clics / ad.impressions) * 100 : 0;

    await ad.save();

    logger.info({
      msg: "incrementImpression success",
      route: "PUT /api/ads/:id/impression",
      method: req.method,
      url: req.originalUrl,
      adId: id,
      impressions: ad.impressions,
      clics: ad.clics,
      taux_conversion: ad.taux_conversion,
    });

    res.json({ message: "Impression mise à jour", ad });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour des impressions", error });

    logger.error({
      msg: "incrementImpression failed",
      route: "PUT /api/ads/:id/impression",
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

// Incrémenter le nombre de clics
export const incrementClick = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const ad = await AdvertisementModel.findById(id);

    if (!ad) {
      logger.warn({
        msg: "incrementClick not found",
        route: "PUT /api/ads/:id/click",
        method: req.method,
        url: req.originalUrl,
        adId: id,
      });
      return res.status(404).json({ message: "Publicité non trouvée" });
    }

    ad.clics += 1;
    ad.taux_conversion = ad.impressions > 0 ? (ad.clics / ad.impressions) * 100 : 0;

    await ad.save();

    logger.info({
      msg: "incrementClick success",
      route: "PUT /api/ads/:id/click",
      method: req.method,
      url: req.originalUrl,
      adId: id,
      impressions: ad.impressions,
      clics: ad.clics,
      taux_conversion: ad.taux_conversion,
    });

    res.json({ message: "Clic mis à jour", ad });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour des clics", error });

    logger.error({
      msg: "incrementClick failed",
      route: "PUT /api/ads/:id/click",
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

// Mettre à jour le temps d'affichage d'une publicité
export const updateAdDisplayTime = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { duree_affichage } = req.body; // Durée en secondes

    if (!duree_affichage || duree_affichage <= 0) {
      logger.warn({
        msg: "updateAdDisplayTime invalid duration",
        route: "PUT /api/ads/:id/affichage",
        method: req.method,
        url: req.originalUrl,
        adId: id,
        duree_affichage,
      });
      return res.status(400).json({ message: "Durée d'affichage invalide" });
    }

    const ad = await AdvertisementModel.findById(id);
    if (!ad) {
      logger.warn({
        msg: "updateAdDisplayTime not found",
        route: "PUT /api/ads/:id/affichage",
        method: req.method,
        url: req.originalUrl,
        adId: id,
      });
      return res.status(404).json({ message: "Publicité non trouvée" });
    }

    // ✅ Mise à jour des statistiques d'affichage
    ad.temps_affichage_total += duree_affichage;
    ad.nombre_affichages_valides += 1;

    await ad.save();

    logger.info({
      msg: "updateAdDisplayTime success",
      route: "PUT /api/ads/:id/affichage",
      method: req.method,
      url: req.originalUrl,
      adId: id,
      duree_affichage,
      temps_affichage_total: ad.temps_affichage_total,
      nombre_affichages_valides: ad.nombre_affichages_valides,
    });

    res.json({ message: "Temps d'affichage mis à jour", ad });
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour du temps d'affichage",
      error,
    });

    logger.error({
      msg: "updateAdDisplayTime failed",
      route: "PUT /api/ads/:id/affichage",
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

// (Optionnel) Si tu veux aussi exposer incrementValidImpression :
export const incrementValidImpression = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const ad = await AdvertisementModel.findById(id);

    if (!ad) {
      logger.warn({
        msg: "incrementValidImpression not found",
        route: "PUT /api/ads/:id/valid-impression",
        method: req.method,
        url: req.originalUrl,
        adId: id,
      });
      return res.status(404).json({ message: "Publicité non trouvée" });
    }

    ad.nombre_affichages_valides += 1;
    await ad.save();

    logger.info({
      msg: "incrementValidImpression success",
      route: "PUT /api/ads/:id/valid-impression",
      method: req.method,
      url: req.originalUrl,
      adId: id,
      nombre_affichages_valides: ad.nombre_affichages_valides,
    });

    res.json({ message: "Affichage valide mis à jour", ad });
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour des affichages valides",
      error,
    });

    logger.error({
      msg: "incrementValidImpression failed",
      route: "PUT /api/ads/:id/valid-impression",
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

export default {
  addAdvertisement,
  getAdvertisements,
  getAdvertisementById,
  updateAdvertisement,
  incrementImpression,
  incrementClick,
  updateAdDisplayTime,
  incrementValidImpression,
};
