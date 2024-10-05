import * as express from "express";
import fs from "fs";
import path from "path";

// Étendre le type Request pour inclure la propriété 'file'
interface MulterRequest extends express.Request {
  file: any;
}

// Upload d'une nouvelle image
const uploadImage = async (req: MulterRequest, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier uploadé" });
      }
      const imageUrl = `/uploads/images/${req.file.filename}`;
      res.status(201).json({ message: "Image uploadée avec succès", imageUrl });
    } catch (error) {
      res.status(500).json({ message: "Impossible d'uploader l'image" });
    }
  };

// Récupérer une image par son nom de fichier
const getImageByFilename = async (req: express.Request, res: express.Response) => {
    try {
      const { filename } = req.params;
      const imagePath = path.join(__dirname, '../uploads/images/', filename);
  
      if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
      } else {
        res.status(404).json({ message: "Image non trouvée" });
      }
    } catch (error) {
      res.status(500).json({ message: "Impossible de récupérer l'image" });
    }
  };

// Supprimer une image par son nom de fichier
const deleteImage = async (req: express.Request, res: express.Response) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(__dirname, '../uploads/images/', filename);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);  // Supprime l'image
      res.status(200).json({ message: "Image supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Image non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer l'image" });
  }
};

module.exports = {
  uploadImage,
  getImageByFilename,
  deleteImage,
};
