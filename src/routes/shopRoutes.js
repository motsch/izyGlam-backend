const shopController = require("../controllers/shopController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();
// Route to create a new shop
router.post("/shop", authMiddleware, shopController.createShop);

// Route to retrieve all shops
router.get("/shop", shopController.getAllShops);

// Route to retrieve a specific shop by ID
router.get("/shop/:id", authMiddleware, shopController.getShopById);

// Route to update a shop
router.put("/shop/:id", authMiddleware, shopController.updateShopById);

// Route to delete a shop
router.delete("/shop/:id", authMiddleware, shopController.deleteShopById);

// Route pour récupérer les services d'une boutique
router.get('/shop/:id/services', shopController.getServicesByShop);
module.exports = router;
