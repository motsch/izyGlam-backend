import SuggestionModel from "../models/suggestion";
import * as express from "express";

// Créer une nouvelle suggestion
export const createSuggestion = async (req: express.Request, res: express.Response) => {
  try {
    const newSuggestion = new SuggestionModel(req.body);
    await newSuggestion.save();
    res.status(201).json(newSuggestion);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la suggestion", error });
  }
};

// Récupérer toutes les suggestions
export const getAllSuggestions = async (req: express.Request, res: express.Response) => {
  try {
    const suggestions = await SuggestionModel.find();
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les suggestions", error });
  }
};

// Récupérer une suggestion par son ID
export const getSuggestionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const suggestion = await SuggestionModel.findById(id);
    if (suggestion) {
      res.json(suggestion);
    } else {
      res.status(404).json({ message: "Suggestion non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la suggestion", error });
  }
};

// Supprimer une suggestion par son ID
export const deleteSuggestionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedSuggestion = await SuggestionModel.findByIdAndDelete(id);
    if (deletedSuggestion) {
      res.json({ message: "Suggestion supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Suggestion non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la suggestion", error });
  }
};

module.exports = {
  createSuggestion,
  getAllSuggestions,
  getSuggestionById,
  deleteSuggestionById,
};
