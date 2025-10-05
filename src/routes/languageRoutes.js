const express = require("express");
const languageController = require("../controllers/languageController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Route pour créer une nouvelle langue (avec upload d'image)
router.post("/language", authMiddleware, languageController.createLanguage);

// Route pour récupérer toutes les langues
router.get("/language", languageController.getAllLanguages);

// Route pour récupérer toutes les langues pour le client
router.get("/language-cleaned", languageController.getAllLanguagesCleaned);

// Route pour récupérer une langue spécifique par ID
router.get("/language/:id", languageController.getLanguageById);

// Route pour mettre à jour une langue par ID (avec upload d'image)
router.put("/language/:id", authMiddleware, languageController.updateLanguageById);

// Route pour supprimer une langue par ID
router.delete("/language/:id", authMiddleware, languageController.deleteLanguageById);

module.exports = router;
