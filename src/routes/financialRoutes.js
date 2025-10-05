const express = require("express");
const financialController = require("../controllers/financialController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Route pour créer le paiement initial lors de la réservation
router.post("/financial/initial-payment", authMiddleware, financialController.createInitialPayment);

// Route pour traiter un remboursement (complet ou partiel)
router.post("/financial/refund", authMiddleware, financialController.processRefund);

// Route pour effectuer le versement (payout) au prestataire une fois la prestation terminée
router.post("/financial/payout", authMiddleware, financialController.processPayout);

// Route pour traiter un retrait (withdrawal) pour un prestataire
router.post("/financial/withdrawal", authMiddleware, financialController.processWithdrawal);

module.exports = router;
