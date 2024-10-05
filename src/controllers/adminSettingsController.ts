import AdminSettingsModel from "../models/adminSettings";
import * as express from "express";

// Créer ou initialiser les paramètres administratifs
const createAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const existingSettings = await AdminSettingsModel.findOne();
    if (existingSettings) {
      return res.status(400).json({ message: "Les paramètres administratifs existent déjà" });
    }

    const newSettings = new AdminSettingsModel(req.body);
    await newSettings.save();
    res.status(201).json(newSettings);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer les paramètres administratifs" });
  }
};

// Récupérer les paramètres administratifs
const getAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const settings = await AdminSettingsModel.findOne();
    if (settings) {
      res.json(settings);
    } else {
      res.status(404).json({ message: "Paramètres administratifs non trouvés" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les paramètres administratifs" });
  }
};

// Mettre à jour les paramètres administratifs
const updateAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const updatedSettings = await AdminSettingsModel.findOneAndUpdate({}, req.body, {
      new: true,
    });

    if (updatedSettings) {
      res.json(updatedSettings);
    } else {
      res.status(404).json({ message: "Paramètres administratifs non trouvés" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour les paramètres administratifs" });
  }
};

// Supprimer les paramètres administratifs
const deleteAdminSettings = async (req: express.Request, res: express.Response) => {
  try {
    const deletedSettings = await AdminSettingsModel.findOneAndDelete();
    if (deletedSettings) {
      res.json({ message: "Paramètres administratifs supprimés avec succès" });
    } else {
      res.status(404).json({ message: "Paramètres administratifs non trouvés" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer les paramètres administratifs" });
  }
};

module.exports = {
  createAdminSettings,
  getAdminSettings,
  updateAdminSettings,
  deleteAdminSettings,
};
