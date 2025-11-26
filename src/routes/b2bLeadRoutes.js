const express = require("express");
const router = express.Router();
const b2bLeadController = require("../controllers/b2bLeadController");
const authMiddleware = require("../middlewares/authMiddleware");

// Créer un nouveau lead B2B
router.post(
  "/b2b-leads",
  authMiddleware,
  b2bLeadController.createB2BLead
);

// Récupérer tous les leads B2B
router.get("/b2b-leads", b2bLeadController.getAllB2BLeads);

// Récupérer un lead B2B spécifique par ID
router.get("/b2b-leads/:id", b2bLeadController.getB2BLeadById);

// Mettre à jour un lead B2B par ID
router.put(
  "/b2b-leads/:id",
  authMiddleware,
  b2bLeadController.updateB2BLeadById
);

// Supprimer un lead B2B par ID
router.delete(
  "/b2b-leads/:id",
  authMiddleware,
  b2bLeadController.deleteB2BLeadById
);

router.post(
  "/b2b-leads/enrich-emails",
  authMiddleware,
  b2bLeadController.enrichEmailsForLeads
);

module.exports = router;
