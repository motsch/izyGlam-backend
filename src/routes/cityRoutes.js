const express = require("express");
const router = express.Router();
const cityController = require("../controllers/cityController");
const authMiddleware = require("../middlewares/authMiddleware");

// CRUD
router.post("/city", authMiddleware, cityController.createCity);
router.get("/city", cityController.getAllCities);
router.get("/city/:id", cityController.getCityById);
router.put("/city/:id", authMiddleware, cityController.updateCityById);
router.delete("/city/:id", authMiddleware, cityController.deleteCityById);

// Récupérer les villes par code postal (et éventuellement pays ?pays=France)
router.get("/city-by-postal/:postalCode", cityController.getCitiesByPostalCode);

module.exports = router;
