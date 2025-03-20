import VilleModel, { iVille } from "../models/ville";
import * as express from "express";
// On crée un type décrivant la structure de l'objet cityGroups
// où la clé (city) est une string et la valeur est un tableau de iVille.
type CityGroups = {
  [city: string]: iVille[];
};
// Créer une nouvelle ville
const createVille = async (req: express.Request, res: express.Response) => {
  try {
    const newVille = new VilleModel(req.body);
    await newVille.save();
    res.status(201).json(newVille);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la ville" });
  }
};

// Récupérer toutes les villes
const getAllVilles = async (req: express.Request, res: express.Response) => {
  try {
    const villes = await VilleModel.find();
    res.json(villes);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les villes" });
  }
};

// Récupérer toutes les villes et retourner un objet structuré
export const getAllVillesLimited = async (req: express.Request, res: express.Response) => {
  try {
    // On précise à TypeScript que "villes" est un tableau de iVille
    const villes: iVille[] = await VilleModel.find();

    // On crée un objet cityGroups (avec type explicite) pour regrouper les documents par city
    const cityGroups: CityGroups = villes.reduce((acc: CityGroups, ville: iVille) => {
      // Si le groupe pour cette city n'existe pas, on l'initialise
      if (!acc[ville.city]) {
        acc[ville.city] = [];
      }
      // On pousse la ville actuelle dans le tableau correspondant
      acc[ville.city].push(ville);
      return acc;
    }, {});

    // On crée la liste de villes selon la règle :
    // - S'il y a plusieurs documents pour une même city => on retourne city
    // - S'il n'y en a qu'un => on retourne name
    const listeVilles = Object.values(cityGroups).map((group: iVille[]) => {
      if (group.length > 1) {
        return group[0].city; // ex. "Paris"
      }
      return group[0].name;   // ex. "Timișoara"
    });

    // On crée la liste des pays uniques
    const listePays = [...new Set(villes.map((ville: iVille) => ville.pays))];

    // On renvoie l'objet structuré
    res.json({
      villes: listeVilles, // Liste unique de villes
      pays: listePays,     // Liste unique des pays
      data: villes,        // Données brutes
    });
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les villes" });
  }
};




// Récupérer une ville par son ID
const getVilleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const ville = await VilleModel.findById(id);
    if (ville) {
      res.json(ville);
    } else {
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la ville" });
  }
};

// Mettre à jour une ville par son ID
const updateVilleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedVille = await VilleModel.findByIdAndUpdate(id, req.body, { new: true });
    if (updatedVille) {
      res.json(updatedVille);
    } else {
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la ville" });
  }
};

// Supprimer une ville par son ID
const deleteVilleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedVille = await VilleModel.findByIdAndDelete(id);
    if (deletedVille) {
      res.json({ message: "Ville supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error) {
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
