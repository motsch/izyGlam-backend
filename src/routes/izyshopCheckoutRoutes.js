const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const izyshopCheckout = require("../controllers/izyshopCheckout.controller");

// POST /izyshop/checkout/shipping-options
router.post("/izyshop/checkout/shipping-options", authMiddleware, izyshopCheckout.getShippingOptions);

// POST /izyshop/checkout/intent
router.post("/izyshop/checkout/intent", authMiddleware, izyshopCheckout.createCheckoutIntent);

module.exports = router;
