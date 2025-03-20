import { Request, Response } from "express";
import multer from "multer";
import path from "path";
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
      return res.status(500).json({ message: "Erreur lors du téléchargement de l'image" });
    }

    try {
      const { code, name, trad, active } = req.body;
      const flagPath = req.file ? `/uploads/flags/${req.file.filename}` : "";

      const newLanguage = new LanguageModel({ code, name, flag: flagPath, trad, active });
      await newLanguage.save();
      res.status(201).json(newLanguage);
    } catch (error) {
      res.status(500).json({ message: "Impossible de créer la langue" });
    }
  });
};

// Récupérer toutes les langues
export const getAllLanguages = async (req: Request, res: Response) => {
  try {
    const languages = await LanguageModel.find();
    res.json(languages);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les langues" });
  }
};

// Récupérer toutes les langues
export const getAllLanguagesCleaned = async (req: Request, res: Response) => {
  try {
    const languages = await LanguageModel.find({ active: true }); // Filtrer uniquement les langues actives
    res.json(languages);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les langues actives" });
  }
};


// Récupérer une langue par son ID
export const getLanguageById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const language = await LanguageModel.findById(id);
    if (language) {
      res.json(language);
    } else {
      res.status(404).json({ message: "Langue non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la langue" });
  }
};

// Mettre à jour une langue par son ID (avec option de mise à jour du drapeau)
export const updateLanguageById = async (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    if (err) {
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
        res.json(updatedLanguage);
      } else {
        res.status(404).json({ message: "Langue non trouvée" });
      }
    } catch (error) {
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
      res.json({ message: "Langue supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Langue non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la langue" });
  }
};
