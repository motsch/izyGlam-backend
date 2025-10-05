import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import { logger } from "../utils/logger";
import LanguageModel, { ILanguage } from "../models/language";

// Configuration du stockage des fichiers avec multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/flags/"); // Dossier de stockage des images
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage }).single("flag");

// Créer une nouvelle langue avec upload d'image
export const createLanguage = async (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error({
        msg: "createLanguage upload error",
        route: "POST /api/language",
        method: req.method,
        url: req.originalUrl,
        errorName: (err as any)?.name,
        errorMessage: (err as any)?.message,
        stack: (err as any)?.stack,
      });
      return res.status(500).json({ message: "Erreur lors du téléchargement de l'image" });
    }

    try {
      const { code, name, trad, active } = req.body;
      const flagPath = req.file ? `/uploads/flags/${req.file.filename}` : "";

      const newLanguage = new LanguageModel({ code, name, flag: flagPath, trad, active });
      await newLanguage.save();

      logger.info({
        msg: "createLanguage success",
        route: "POST /api/language",
        method: req.method,
        url: req.originalUrl,
        code,
        name,
        hasFlag: !!req.file,
      });

      res.status(201).json(newLanguage);
    } catch (error: any) {
      logger.error({
        msg: "createLanguage failed",
        route: "POST /api/language",
        method: req.method,
        url: req.originalUrl,
        bodyKeys: Object.keys(req.body || {}),
        errorName: error?.name,
        errorMessage: error?.message,
        stack: error?.stack,
      });
      res.status(500).json({ message: "Impossible de créer la langue" });
    }
  });
};

// Récupérer toutes les langues
export const getAllLanguages = async (req: Request, res: Response) => {
  try {
    const languages = await LanguageModel.find();
    logger.info({
      msg: "getAllLanguages success",
      route: "GET /api/language",
      method: req.method,
      url: req.originalUrl,
      count: languages.length,
    });
    res.json(languages);
  } catch (error: any) {
    logger.error({
      msg: "getAllLanguages failed",
      route: "GET /api/language",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les langues" });
  }
};

// Récupérer toutes les langues (actives) pour le client
export const getAllLanguagesCleaned = async (req: Request, res: Response) => {
  try {
    const languages = await LanguageModel.find({ active: true }); // Filtrer uniquement les langues actives
    logger.info({
      msg: "getAllLanguagesCleaned success",
      route: "GET /api/language-cleaned",
      method: req.method,
      url: req.originalUrl,
      count: languages.length,
    });
    res.json(languages);
  } catch (error: any) {
    logger.error({
      msg: "getAllLanguagesCleaned failed",
      route: "GET /api/language-cleaned",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les langues actives" });
  }
};

// Récupérer une langue par son ID
export const getLanguageById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const language = await LanguageModel.findById(id);
    if (language) {
      logger.info({
        msg: "getLanguageById success",
        route: "GET /api/language/:id",
        method: req.method,
        url: req.originalUrl,
        id,
      });
      res.json(language);
    } else {
      logger.warn({
        msg: "getLanguageById not found",
        route: "GET /api/language/:id",
        method: req.method,
        url: req.originalUrl,
        id,
      });
      res.status(404).json({ message: "Langue non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getLanguageById failed",
      route: "GET /api/language/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la langue" });
  }
};

// Mettre à jour une langue par son ID (avec option de mise à jour du drapeau)
export const updateLanguageById = async (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error({
        msg: "updateLanguageById upload error",
        route: "PUT /api/language/:id",
        method: req.method,
        url: req.originalUrl,
        errorName: (err as any)?.name,
        errorMessage: (err as any)?.message,
        stack: (err as any)?.stack,
      });
      return res.status(500).json({ message: "Erreur lors du téléchargement de l'image" });
    }

    try {
      const { id } = req.params;
      const { code, name, trad, active } = req.body;
      const flagPath = req.file ? `/uploads/flags/${req.file.filename}` : undefined;

      const updateData: Partial<ILanguage> = { code, name, trad, active };
      if (flagPath) updateData.flag = flagPath;

      const updatedLanguage = await LanguageModel.findByIdAndUpdate(id, updateData, { new: true });

      if (updatedLanguage) {
        logger.info({
          msg: "updateLanguageById success",
          route: "PUT /api/language/:id",
          method: req.method,
          url: req.originalUrl,
          id,
          updatedFields: Object.keys(updateData),
          hasFlag: !!flagPath,
        });
        res.json(updatedLanguage);
      } else {
        logger.warn({
          msg: "updateLanguageById not found",
          route: "PUT /api/language/:id",
          method: req.method,
          url: req.originalUrl,
          id,
        });
        res.status(404).json({ message: "Langue non trouvée" });
      }
    } catch (error: any) {
      logger.error({
        msg: "updateLanguageById failed",
        route: "PUT /api/language/:id",
        method: req.method,
        url: req.originalUrl,
        params: req.params,
        errorName: error?.name,
        errorMessage: error?.message,
        stack: error?.stack,
      });
      res.status(500).json({ message: "Impossible de mettre à jour la langue" });
    }
  });
};

// Supprimer une langue par son ID
export const deleteLanguageById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedLanguage = await LanguageModel.findByIdAndDelete(id);
    if (deletedLanguage) {
      logger.info({
        msg: "deleteLanguageById success",
        route: "DELETE /api/language/:id",
        method: req.method,
        url: req.originalUrl,
        id,
      });
      res.json({ message: "Langue supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteLanguageById not found",
        route: "DELETE /api/language/:id",
        method: req.method,
        url: req.originalUrl,
        id,
      });
      res.status(404).json({ message: "Langue non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteLanguageById failed",
      route: "DELETE /api/language/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la langue" });
  }
};
