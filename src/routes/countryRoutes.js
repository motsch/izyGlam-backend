const express = require("express");
const router = express.Router();
const countryController = require("../controllers/countryController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route to create a new country
router.post("/country", authMiddleware, countryController.createCountry);

// Route to retrieve all countries (optional filters: ?active=true/false & ?q=search)
router.get("/country", countryController.getCountries);

// Route to retrieve a specific country by ID
router.get("/country/:id", countryController.getCountryById);

// Route to update a country by ID
router.put("/country/:id", authMiddleware, countryController.updateCountry);

// Route to delete a country by ID
router.delete("/country/:id", authMiddleware, countryController.deleteCountry);

// Route to activate/deactivate a country quickly (expects active=true|false in body or query)
router.patch("/country/:id/active", authMiddleware, countryController.setCountryActive);

// Route to retrieve languages of a country by its name (case-insensitive)
router.get("/country/name/:name/languages", countryController.getLanguagesByCountryName);

module.exports = router;
