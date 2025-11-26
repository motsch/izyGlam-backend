import * as express from "express";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

// ✅ Typage compatible avec @types/multer (pas d'extends qui casse)
type MulterRequest = express.Request & { file?: Express.Multer.File };

// Upload d'une nouvelle image
const uploadImage = async (req: MulterRequest, res: express.Response) => {
  try {
    if (!req.file) {
      logger.warn({
        msg: "uploadImage bad request (no file)",
        route: "POST /api/image/upload",
        method: req.method,
        url: req.originalUrl,
      });
      return res.status(400).json({ message: "Aucun fichier uploadé" });
    }
    const imageUrl = `${req.file.filename}`;

    logger.info({
      msg: "uploadImage success",
      route: "POST /api/image/upload",
      method: req.method,
      url: req.originalUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    res.status(201).json({ message: "Image uploadée avec succès", imageUrl });
  } catch (error: any) {
    logger.error({
      msg: "uploadImage failed",
      route: "POST /api/image/upload",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible d'uploader l'image" });
  }
};

// Récupérer une image par son nom de fichier
const getImageByFilename = async (req: express.Request, res: express.Response) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(__dirname, "../uploads/images/", filename);

    if (fs.existsSync(imagePath)) {
      logger.info({
        msg: "getImageByFilename success",
        route: "GET /api/image/:filename",
        method: req.method,
        url: req.originalUrl,
        filename,
      });
      res.sendFile(imagePath);
    } else {
      logger.warn({
        msg: "getImageByFilename not found",
        route: "GET /api/image/:filename",
        method: req.method,
        url: req.originalUrl,
        filename,
      });
      res.status(404).json({ message: "Image non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getImageByFilename failed",
      route: "GET /api/image/:filename",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer l'image" });
  }
};

// Supprimer une image par son nom de fichier
const deleteImage = async (req: express.Request, res: express.Response) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(__dirname, "../uploads/images/", filename);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath); // Supprime l'image
      logger.info({
        msg: "deleteImage success",
        route: "DELETE /api/image/:filename",
        method: req.method,
        url: req.originalUrl,
        filename,
      });
      res.status(200).json({ message: "Image supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteImage not found",
        route: "DELETE /api/image/:filename",
        method: req.method,
        url: req.originalUrl,
        filename,
      });
      res.status(404).json({ message: "Image non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteImage failed",
      route: "DELETE /api/image/:filename",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer l'image" });
  }
};

module.exports = {
  uploadImage,
  getImageByFilename,
  deleteImage,
};
