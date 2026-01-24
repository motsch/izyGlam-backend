const express = require("express");
const router = express.Router();
const proLeadController = require("../controllers/proLeadController");
const authMiddleware = require("../middlewares/authMiddleware");

// Créer un lead prestataire
router.post("/pro-leads", authMiddleware, proLeadController.createProLead);

// Récupérer tous les leads prestataires (avec filtres optionnels)
router.get("/pro-leads", authMiddleware, proLeadController.getAllProLeads);

// Récupérer un lead prestataire par ID
router.get("/pro-leads/:id", authMiddleware, proLeadController.getProLeadById);

// Mettre à jour un lead prestataire
router.put(
  "/pro-leads/:id",
  authMiddleware,
  proLeadController.updateProLeadById
);

// Supprimer un lead prestataire
router.delete(
  "/pro-leads/:id",
  authMiddleware,
  proLeadController.deleteProLeadById
);

module.exports = router;
