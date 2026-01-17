const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authMiddleware = require("../middlewares/authMiddleware");

// Public
router.get("/product", productController.getAllProducts);

router.get("/product/search", productController.searchProducts);

router.get("/product/best-sellers/week", productController.getBestSellersWeek);
router.get("/product/:id", productController.getProductById);

// Admin (protégé)
router.get("/admin/products", authMiddleware, productController.getAllProductsAdmin);
router.put("/product/:id", authMiddleware, productController.updateProductById);
router.delete("/product/:id", authMiddleware, productController.deleteProductById);

module.exports = router;
