const express = require("express");
const router = express.Router();
const villeController = require("../controllers/villeController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer une nouvelle ville
router.post("/ville", authMiddleware, villeController.createVille);

// Route pour récupérer toutes les villes
router.get("/ville", villeController.getAllVilles);

// Route pour récupérer toutes les villes clients
router.get("/ville-limited", villeController.getAllVillesLimited);

// Route pour récupérer une ville par son ID
router.get("/ville/:id", villeController.getVilleById);

// Route pour mettre à jour une ville par son ID
router.put("/ville/:id", authMiddleware, villeController.updateVilleById);

// Route pour supprimer une ville par son ID
router.delete("/ville/:id", authMiddleware, villeController.deleteVilleById);

module.exports = router;
