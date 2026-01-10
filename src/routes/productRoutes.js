const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authMiddleware = require("../middlewares/authMiddleware");

// Public
router.get("/product", productController.getAllProducts);
router.get("/product/best-sellers/week", productController.getBestSellersWeek);
router.get("/product/:id", productController.getProductById);

// Admin (protégé)
router.put("/product/:id", authMiddleware, productController.updateProductById);

module.exports = router;
