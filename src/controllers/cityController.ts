import CityModel from "../models/city";
import * as express from "express";
import { logger } from "../utils/logger";

// -- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

// Créer une nouvelle ville
const createCity = async (req: express.Request, res: express.Response) => {
  try {
    const newCity = new CityModel(req.body);
    await newCity.save();

    logger.info({
      msg: "createCity success",
      route: "POST /api/city",
      method: req.method,
      url: req.originalUrl,
      cityId: newCity?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newCity);
  } catch (error: any) {
    logger.error({
      msg: "createCity failed",
      route: "POST /api/city",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la ville" });
  }
};

// Récupérer toutes les villes (filtrable par pays)
const getAllCities = async (req: express.Request, res: express.Response) => {
  try {
    const { pays } = req.query;
    const filter = pays ? { pays } : {};
    const cities = await CityModel.find(filter);

    logger.info({
      msg: "getAllCities success",
      route: "GET /api/city",
      method: req.method,
      url: req.originalUrl,
      pays: pays || null,
      count: cities.length,
    });

    res.json(cities);
  } catch (error: any) {
    logger.error({
      msg: "getAllCities failed",
      route: "GET /api/city",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les villes" });
  }
};

// Récupérer une ville par ID
const getCityById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const city = await CityModel.findById(id);

    if (city) {
      logger.info({
        msg: "getCityById success",
        route: "GET /api/city/:id",
        method: req.method,
        url: req.originalUrl,
        cityId: id,
      });
      res.json(city);
    } else {
      logger.warn({
        msg: "getCityById not found",
        route: "GET /api/city/:id",
        method: req.method,
        url: req.originalUrl,
        cityId: id,
      });
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getCityById failed",
      route: "GET /api/city/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Erreur lors de la récupération" });
  }
};

// Modifier une ville par ID
const updateCityById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedCity = await CityModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedCity) {
      logger.info({
        msg: "updateCityById success",
        route: "PUT /api/city/:id",
        method: req.method,
        url: req.originalUrl,
        cityId: id,
        body: sanitize(req.body),
      });
      res.json(updatedCity);
    } else {
      logger.warn({
        msg: "updateCityById not found",
        route: "PUT /api/city/:id",
        method: req.method,
        url: req.originalUrl,
        cityId: id,
      });
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateCityById failed",
      route: "PUT /api/city/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour la ville" });
  }
};

// Supprimer une ville
const deleteCityById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedCity = await CityModel.findByIdAndDelete(id);

    if (deletedCity) {
      logger.info({
        msg: "deleteCityById success",
        route: "DELETE /api/city/:id",
        method: req.method,
        url: req.originalUrl,
        cityId: id,
      });
      res.json({ message: "Ville supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteCityById not found",
        route: "DELETE /api/city/:id",
        method: req.method,
        url: req.originalUrl,
        cityId: id,
      });
      res.status(404).json({ message: "Ville non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteCityById failed",
      route: "DELETE /api/city/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la ville" });
  }
};

// Récupérer toutes les villes avec un même code postal (et pays en query ?pays=France)
const getCitiesByPostalCode = async (req: express.Request, res: express.Response) => {
  try {
    const { postalCode } = req.params;
    const { pays } = req.query;

    const filter: any = { code_postal: postalCode };
    if (pays) filter.pays = pays;

    const cities = await CityModel.find(filter);

    logger.info({
      msg: "getCitiesByPostalCode success",
      route: "GET /api/city-by-postal/:postalCode",
      method: req.method,
      url: req.originalUrl,
      postalCode,
      pays: pays || null,
      count: cities.length,
    });

    res.json(cities);
  } catch (error: any) {
    logger.error({
      msg: "getCitiesByPostalCode failed",
      route: "GET /api/city-by-postal/:postalCode",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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
