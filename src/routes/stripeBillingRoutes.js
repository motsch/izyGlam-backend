// routes/stripeRoutes.js
const express = require("express");
const router = express.Router();
const stripeBillingController = require("../controllers/stripeBillingController");


// ⚠️ Route JSON normale (PAS raw)
router.post("/premium/checkout-session", /* authMiddleware, */ stripeBillingController.createPremiumCheckoutSession);

router.get("/premium/checkout-session-status", stripeBillingController.getCheckoutSessionStatus);

router.get("/premium/subscription", stripeBillingController.getPremiumSubscription);

router.post("/premium/cancel", stripeBillingController.cancelPremiumSubscription);
router.post("/premium/resume", stripeBillingController.resumePremiumSubscription);
router.post("/premium/portal", stripeBillingController.createCustomerPortalSession);

module.exports = router;
