// routes/stripeRoutes.js
const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripeController");

// Route pour récupérer toutes les cartes
router.get("/stripe/get-cards", stripeController.getCards);

// Route pour enregistrer une nouvelle carte
router.post("/stripe/save-card", stripeController.saveCard);

// Statut Stripe prestataire
router.get("/stripe/connect/status", stripeController.getStripeStatus);

// Route pour le onboarding prestataires
router.post("/stripe/connect/onboarding-link", stripeController.createOnboardingLink);

// Route pour définir la carte principale
router.post("/stripe/set-primary-card", stripeController.setPrimaryCard);

// Nouvelle route pour créer une méthode de paiement à partir des détails de la carte
router.post("/stripe/create-payment-method-from-details", stripeController.createPaymentMethodFromDetails);

router.post("/stripe/create-payment-intent", stripeController.createPaymentIntent);



// Nouvelle route pour le remboursement
router.post("/stripe/refund", stripeController.refundPayment);


module.exports = router;