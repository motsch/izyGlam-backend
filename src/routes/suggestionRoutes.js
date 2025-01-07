const express = require("express");
const router = express.Router();
const suggestionController = require("../controllers/suggestionController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer une nouvelle suggestion
router.post("/suggestion", suggestionController.createSuggestion);

// Route pour récupérer toutes les suggestions
router.get("/suggestion", suggestionController.getAllSuggestions);

// Route pour récupérer une suggestion par ID
router.get("/suggestion/:id", suggestionController.getSuggestionById);

// Route pour supprimer une suggestion par ID
router.delete("/suggestion/:id", authMiddleware, suggestionController.deleteSuggestionById);

module.exports = router;
