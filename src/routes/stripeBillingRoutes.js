// routes/stripeRoutes.js
const express = require("express");
const router = express.Router();
const stripeBillingController = require("../controllers/stripeBillingController");


// ⚠️ Route JSON normale (PAS raw)
router.post("/premium/checkout-session", /* authMiddleware, */ stripeBillingController.createPremiumCheckoutSession);

router.get("/premium/checkout-session-status", stripeBillingController.getCheckoutSessionStatus);

router.get("/premium/subscription", stripeBillingController.getPremiumSubscription);


module.exports = router;
