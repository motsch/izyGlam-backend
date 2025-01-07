import TipModel from "../models/tips";
import * as express from "express";

// Créer un nouveau tip
export const createTip = async (req: express.Request, res: express.Response) => {
  try {
    const newTip = new TipModel(req.body);
    await newTip.save();
    res.status(201).json(newTip);
  } catch (error:any) {
    res.status(500).json({ message: "Impossible de créer le tip", error: error.message });
  }
};

// Récupérer tous les tips
export const getAllTips = async (req: express.Request, res: express.Response) => {
  try {
    const tips = await TipModel.find();
    res.json(tips);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les tips" });
  }
};

// Récupérer un tip par son ID
export const getTipById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const tip = await TipModel.findById(id);
    if (tip) {
      res.json(tip);
    } else {
      res.status(404).json({ message: "Tip non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le tip" });
  }
};

// Mettre à jour un tip par son ID
export const updateTipById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedTip = await TipModel.findByIdAndUpdate(id, req.body, { new: true });
    if (updatedTip) {
      res.json(updatedTip);
    } else {
      res.status(404).json({ message: "Tip non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour le tip" });
  }
};

// Supprimer un tip par son ID
export const deleteTipById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedTip = await TipModel.findByIdAndDelete(id);
    if (deletedTip) {
      res.json({ message: "Tip supprimé avec succès" });
    } else {
      res.status(404).json({ message: "Tip non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer le tip" });
  }
};

export default {
  createTip,
  getAllTips,
  getTipById,
  updateTipById,
  deleteTipById,
};
