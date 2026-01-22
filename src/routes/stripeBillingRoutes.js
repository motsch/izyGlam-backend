// routes/stripeRoutes.js
const express = require("express");
const router = express.Router();
const stripeBillingController = require("../controllers/stripeBillingController");


// ⚠️ Route JSON normale (PAS raw)
router.post("/premium/checkout-session", /* authMiddleware, */ stripeBillingController.createPremiumCheckoutSession);


module.exports = router;
