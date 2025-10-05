import SuggestionModel from "../models/suggestion";
import * as express from "express";
import { logger } from "../utils/logger";

// Créer une nouvelle suggestion
export const createSuggestion = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "suggestion.create.start",
      route: req.originalUrl,
      method: req.method,
      // évite les secrets : on ne log pas le body en entier
    });

    const newSuggestion = new SuggestionModel(req.body);
    await newSuggestion.save();

    logger.info({
      msg: "suggestion.create.success",
      id: newSuggestion._id?.toString(),
    });

    res.status(201).json(newSuggestion);
  } catch (error: any) {
    logger.error({
      msg: "suggestion.create.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la suggestion", error });
  }
};

// Récupérer toutes les suggestions
export const getAllSuggestions = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "suggestion.list.start",
      route: req.originalUrl,
      method: req.method,
    });

    const suggestions = await SuggestionModel.find();

    logger.info({
      msg: "suggestion.list.success",
      count: suggestions.length,
    });

    res.json(suggestions);
  } catch (error: any) {
    logger.error({
      msg: "suggestion.list.error",
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les suggestions", error });
  }
};

// Récupérer une suggestion par son ID
export const getSuggestionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    logger.info({
      msg: "suggestion.get_by_id.start",
      route: req.originalUrl,
      method: req.method,
      id,
    });

    const suggestion = await SuggestionModel.findById(id);

    if (suggestion) {
      logger.info({
        msg: "suggestion.get_by_id.success",
        id,
      });
      res.json(suggestion);
    } else {
      logger.warn({
        msg: "suggestion.get_by_id.not_found",
        id,
      });
      res.status(404).json({ message: "Suggestion non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "suggestion.get_by_id.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la suggestion", error });
  }
};

// Supprimer une suggestion par son ID
export const deleteSuggestionById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    logger.info({
      msg: "suggestion.delete.start",
      route: req.originalUrl,
      method: req.method,
      id,
    });

    const deletedSuggestion = await SuggestionModel.findByIdAndDelete(id);

    if (deletedSuggestion) {
      logger.info({
        msg: "suggestion.delete.success",
        id,
      });
      res.json({ message: "Suggestion supprimée avec succès" });
    } else {
      logger.warn({
        msg: "suggestion.delete.not_found",
        id,
      });
      res.status(404).json({ message: "Suggestion non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "suggestion.delete.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la suggestion", error });
  }
};

module.exports = {
  createSuggestion,
  getAllSuggestions,
  getSuggestionById,
  deleteSuggestionById,
};
