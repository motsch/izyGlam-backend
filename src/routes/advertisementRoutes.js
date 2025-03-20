const express = require("express");
const router = express.Router();
const advertisementController = require("../controllers/advertisementController");
const authMiddleware = require("../middlewares/authMiddleware");


// Route to create a new color
router.post("/ads", authMiddleware, advertisementController.addAdvertisement);

// Route to retrieve all colors
router.get("/ads", advertisementController.getAdvertisements);

// Route to retrieve a specific color by ID
router.get("/ads/:id", advertisementController.getAdvertisementById);

// Route to update a color by ID
router.put("/ads/:id", authMiddleware, advertisementController.updateAdvertisement);



// Route to update a color by ID
router.put("/ads/:id/impression", authMiddleware, advertisementController.incrementImpression);

// Route to update a color by ID
router.put("/ads/:id/click", authMiddleware, advertisementController.incrementClick);

// Route pour mettre à jour le temps d'affichage
router.put("/ads/:id/affichage", authMiddleware, advertisementController.updateAdDisplayTime);

module.exports = router;
