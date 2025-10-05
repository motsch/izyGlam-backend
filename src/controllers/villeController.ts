import VilleModel, { iVille } from "../models/ville";
import * as express from "express";
import { logger } from "../utils/logger";

type CityGroups = {
  [city: string]: iVille[];
};

// Créer une nouvelle ville
const createVille = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "ville.create.start" });
    const newVille = new VilleModel(req.body);
    await newVille.save();
    logger.info({ msg: "ville.create.success", id: newVille._id?.toString() });
    res.status(201).json(newVille);
  } catch (error: any) {
    logger.error({
      msg: "ville.create.error",
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la ville" });
  }
};

// Récupérer toutes les villes
const getAllVilles = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "ville.list.start" });
    const villes = await VilleModel.find();
    logger.info({ msg: "ville.list.success", count: villes.length });
    res.json(villes);
  } catch (error: any) {
    logger.error({
      msg: "ville.list.error",
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les villes" });
  }
};

// Récupérer toutes les villes et retourner un objet structuré
export const getAllVillesLimited = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "ville.listLimited.start" });
    const villes: iVille[] = await VilleModel.find();

    const cityGroups: CityGroups = villes.reduce((acc: CityGroups, ville: iVille) => {
      if (!acc[ville.city]) acc[ville.city] = [];
      acc[ville.city].push(ville);
      return acc;
    }, {});

    const listeVilles = Object.values(cityGroups).map((group: iVille[]) =>
      group.length > 1 ? group[0].city : group[0].name
    );

    const listePays = [...new Set(villes.map((ville: iVille) => ville.pays))];

    logger.info({
      msg: "ville.listLimited.success",
      villesCount: listeVilles.length,
      paysCount: listePays.length,
      totalDocs: villes.length,
    });

    res.json({
      villes: listeVilles,
      pays: listePays,
      data: villes,
    });
  } catch (error: any) {
    logger.error({
      msg: "ville.listLimited.error",
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les villes" });
  }
};

// Récupérer une ville par son ID
const getVilleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "ville.getById.start", id });
    const ville = await VilleModel.findById(id);
    if (ville) {
      logger.info({ msg: "ville.getById.success", id });
      res.json(ville);
    } else {
      logger.warn({ msg: "ville.getById.notFound", id });
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "ville.getById.error",
      id: req.params?.id,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la ville" });
  }
};

// Mettre à jour une ville par son ID
const updateVilleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "ville.update.start", id });
    const updatedVille = await VilleModel.findByIdAndUpdate(id, req.body, { new: true });
    if (updatedVille) {
      logger.info({ msg: "ville.update.success", id });
      res.json(updatedVille);
    } else {
      logger.warn({ msg: "ville.update.notFound", id });
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "ville.update.error",
      id: req.params?.id,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour la ville" });
  }
};

// Supprimer une ville par son ID
const deleteVilleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "ville.delete.start", id });
    const deletedVille = await VilleModel.findByIdAndDelete(id);
    if (deletedVille) {
      logger.info({ msg: "ville.delete.success", id });
      res.json({ message: "Ville supprimée avec succès" });
    } else {
      logger.warn({ msg: "ville.delete.notFound", id });
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "ville.delete.error",
      id: req.params?.id,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la ville" });
  }
};

module.exports = {
  createVille,
  getAllVilles,
  getVilleById,
  updateVilleById,
  deleteVilleById,
  getAllVillesLimited,
};
