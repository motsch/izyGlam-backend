const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer un abonnement
router.post("/subscription", authMiddleware, subscriptionController.createSubscription);

// Route pour récupérer tous les abonnements (filtrables par pays via query ?country=FR)
router.get("/subscription", subscriptionController.getAllSubscriptions);

// Route pour récupérer un abonnement par ID
router.get("/subscription/:id", subscriptionController.getSubscriptionById);

// Route pour mettre à jour un abonnement par ID
router.put("/subscription/:id", authMiddleware, subscriptionController.updateSubscriptionById);

// Route pour supprimer un abonnement par ID
router.delete("/subscription/:id", authMiddleware, subscriptionController.deleteSubscriptionById);

module.exports = router;
