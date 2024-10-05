import ColorModel from "../models/color";
import * as express from "express";

// Créer une nouvelle couleur
const createColor = async (req: express.Request, res: express.Response) => {
  try {
    const newColor = new ColorModel(req.body);
    await newColor.save();
    res.status(201).json(newColor);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la couleur" });
  }
};

// Récupérer toutes les couleurs
const getAllColors = async (req: express.Request, res: express.Response) => {
  try {
    const colors = await ColorModel.find();
    res.json(colors);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les couleurs" });
  }
};

// Récupérer une couleur par son ID
const getColorById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const color = await ColorModel.findById(id);
    if (color) {
      res.json(color);
    } else {
      res.status(404).json({ message: "Couleur non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la couleur" });
  }
};

// Mettre à jour une couleur par son ID
const updateColorById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedColor = await ColorModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedColor) {
      res.json(updatedColor);
    } else {
      res.status(404).json({ message: "Couleur non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la couleur" });
  }
};

// Supprimer une couleur par son ID
const deleteColorById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedColor = await ColorModel.findByIdAndDelete(id);
    if (deletedColor) {
      res.json({ message: "Couleur supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Couleur non trouvée" });
    }
  } catch (error) {
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
