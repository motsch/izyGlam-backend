import ProfileModel from "../models/profile";
import * as express from "express";
import { logger } from "../utils/logger";

// Créer un nouveau profil
const createProfile = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "profiles.create.request",
      route: "POST /api/profile/:userId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { userId } = req.params;
    const newProfile = new ProfileModel({ ...req.body, userId: userId });
    await newProfile.save();

    logger.info({
      msg: "profiles.create.success",
      route: "POST /api/profile/:userId",
      method: req.method,
      url: req.originalUrl,
      profileId: newProfile?._id?.toString(),
      durationMs: Date.now() - t0,
    });

    res.status(201).json(newProfile);
  } catch (error: any) {
    logger.error({
      msg: "profiles.create.error",
      route: "POST /api/profile/:userId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de créer le profil" });
  }
};

// Récupérer tous les profils
const getAllProfiles = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "profiles.list.request",
      route: "GET /api/profiles",
      method: req.method,
      url: req.originalUrl,
      queryKeys: Object.keys(req.query || {}),
    });

    const profiles = await ProfileModel.find();

    logger.info({
      msg: "profiles.list.success",
      route: "GET /api/profiles",
      method: req.method,
      url: req.originalUrl,
      count: profiles.length,
      durationMs: Date.now() - t0,
    });

    res.json(profiles);
  } catch (error: any) {
    logger.error({
      msg: "profiles.list.error",
      route: "GET /api/profiles",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer les profils" });
  }
};

// Récupérer un profil par ID
const getProfileById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "profiles.get.request",
      route: "GET /api/profile/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { id } = req.params;
    const profile = await ProfileModel.findById(id);

    if (profile) {
      logger.info({
        msg: "profiles.get.success",
        route: "GET /api/profile/:id",
        method: req.method,
        url: req.originalUrl,
        profileId: id,
        durationMs: Date.now() - t0,
      });
      res.json(profile);
    } else {
      logger.warn({
        msg: "profiles.get.not_found",
        route: "GET /api/profile/:id",
        method: req.method,
        url: req.originalUrl,
        profileId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Profil non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "profiles.get.error",
      route: "GET /api/profile/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer le profil" });
  }
};

// Récupérer les profils par userId
const getProfilesByUserId = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "profiles.by_user.request",
      route: "GET /api/profile-by-user/:userId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { userId } = req.params;
    const profiles = await ProfileModel.find({ userId });

    if (profiles.length > 0) {
      logger.info({
        msg: "profiles.by_user.success",
        route: "GET /api/profile-by-user/:userId",
        method: req.method,
        url: req.originalUrl,
        userId,
        count: profiles.length,
        durationMs: Date.now() - t0,
      });
      res.json(profiles);
    } else {
      logger.warn({
        msg: "profiles.by_user.not_found",
        route: "GET /api/profile-by-user/:userId",
        method: req.method,
        url: req.originalUrl,
        userId,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Aucun profil trouvé pour cet utilisateur" });
    }
  } catch (error: any) {
    logger.error({
      msg: "profiles.by_user.error",
      route: "GET /api/profile-by-user/:userId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer les profils par utilisateur" });
  }
};

// Mettre à jour un profil par ID
const updateProfileById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "profiles.update.request",
      route: "PUT /api/profile/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { id } = req.params;
    const updatedProfile = await ProfileModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedProfile) {
      logger.info({
        msg: "profiles.update.success",
        route: "PUT /api/profile/:id",
        method: req.method,
        url: req.originalUrl,
        profileId: id,
        durationMs: Date.now() - t0,
      });
      res.json(updatedProfile);
    } else {
      logger.warn({
        msg: "profiles.update.not_found",
        route: "PUT /api/profile/:id",
        method: req.method,
        url: req.originalUrl,
        profileId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Profil non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "profiles.update.error",
      route: "PUT /api/profile/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de mettre à jour le profil" });
  }
};

// Supprimer un profil par ID
const deleteProfileById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "profiles.delete.request",
      route: "DELETE /api/profile/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { id } = req.params;
    const deletedProfile = await ProfileModel.findByIdAndDelete(id);

    if (deletedProfile) {
      logger.info({
        msg: "profiles.delete.success",
        route: "DELETE /api/profile/:id",
        method: req.method,
        url: req.originalUrl,
        profileId: id,
        durationMs: Date.now() - t0,
      });
      res.json({ message: "Profil supprimé avec succès" });
    } else {
      logger.warn({
        msg: "profiles.delete.not_found",
        route: "DELETE /api/profile/:id",
        method: req.method,
        url: req.originalUrl,
        profileId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Profil non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "profiles.delete.error",
      route: "DELETE /api/profile/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de supprimer le profil" });
  }
};

export {
  createProfile,
  getAllProfiles,
  getProfileById,
  updateProfileById,
  deleteProfileById,
  getProfilesByUserId,
};
