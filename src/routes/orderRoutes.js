// routes/order.ts
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const orderController = require("../controllers/orderController");


router.post("/orders/check", authMiddleware, orderController.checkOrder);
router.post("/orders/create-payment-intent", authMiddleware, orderController.createPaymentIntentForOrder);
router.get("/orders/my", authMiddleware, orderController.getMyOrders);
router.get("/orders/:id", authMiddleware, orderController.getOrderById);

module.exports = router;
