const shopController = require("../controllers/shopController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();
// Route to create a new shop
router.post("/shop", authMiddleware, shopController.createShop);

// Route to retrieve all shops
router.get("/shop", authMiddleware, shopController.getAllShops);

// Route to retrieve a specific shop by ID
router.get("/shop/:id", authMiddleware, shopController.getShopById);

// Route to update a shop
router.put("/shop/:id", authMiddleware, shopController.updateShopById);

// Route to delete a shop
router.delete("/shop/:id", authMiddleware, shopController.deleteShopById);

module.exports = router;
