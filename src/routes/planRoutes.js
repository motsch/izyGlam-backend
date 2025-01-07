const express = require("express");
const planController = require("../controllers/planController");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

// Créer un nouveau plan tarifaire
router.post("/plans", authMiddleware, planController.createPlan);

// Récupérer tous les plans tarifaires
router.get("/plans", planController.getAllPlans);

// Récupérer un plan tarifaire par ID
router.get("/plans/:id", planController.getPlanById);

// Mettre à jour un plan tarifaire par ID
router.put("/plans/:id", authMiddleware, planController.updatePlanById);

// Supprimer un plan tarifaire par ID
router.delete("/plans/:id", authMiddleware, planController.deletePlanById);

module.exports = router;
