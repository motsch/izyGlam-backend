import CityModel from "../models/city";
import * as express from "express";

// Créer une nouvelle ville
const createCity = async (req: express.Request, res: express.Response) => {
  try {
    const newCity = new CityModel(req.body);
    await newCity.save();
    res.status(201).json(newCity);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la ville" });
  }
};

// Récupérer toutes les villes (filtrable par pays)
const getAllCities = async (req: express.Request, res: express.Response) => {
  try {
    const { pays } = req.query;
    const filter = pays ? { pays } : {};
    const cities = await CityModel.find(filter);
    res.json(cities);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les villes" });
  }
};

// Récupérer une ville par ID
const getCityById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const city = await CityModel.findById(id);
    city ? res.json(city) : res.status(404).json({ message: "Ville non trouvée" });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération" });
  }
};

// Modifier une ville par ID
const updateCityById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedCity = await CityModel.findByIdAndUpdate(id, req.body, { new: true });
    updatedCity ? res.json(updatedCity) : res.status(404).json({ message: "Ville non trouvée" });
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la ville" });
  }
};

// Supprimer une ville
const deleteCityById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedCity = await CityModel.findByIdAndDelete(id);
    deletedCity
      ? res.json({ message: "Ville supprimée avec succès" })
      : res.status(404).json({ message: "Ville non trouvée" });
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la ville" });
  }
};

// Récupérer toutes les villes avec un même code postal (et pays en query ?pays=France)
const getCitiesByPostalCode = async (req: express.Request, res: express.Response) => {
    try {
      const { postalCode } = req.params;
      const { pays } = req.query;
  
      // Filtre de base
      const filter: any = { code_postal: postalCode };
      if (pays) filter.pays = pays;
  
      const cities = await CityModel.find(filter);
      res.json(cities);
    } catch (err) {
      res.status(500).json({ message: "Erreur lors de la récupération des villes" });
    }
  };

module.exports = {
  createCity,
  getAllCities,
  getCityById,
  updateCityById,
  deleteCityById,
  getCitiesByPostalCode,
};
