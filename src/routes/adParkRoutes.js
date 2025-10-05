const express = require("express");
const router = express.Router();
const adParkController = require("../controllers/adParkController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer une nouvelle campagne adPark
router.post("/ad-park", authMiddleware, adParkController.createAdPark);

// Route pour récupérer toutes les campagnes adPark
router.get("/ad-park", adParkController.getAllAdParks);

// Route pour récupérer une campagne adPark par ID
router.get("/ad-park/:id", adParkController.getAdParkById);

// Route pour mettre à jour une campagne adPark par ID
router.put("/ad-park/:id", authMiddleware, adParkController.updateAdParkById);

// Route pour supprimer une campagne adPark par ID
router.delete("/ad-park/:id", authMiddleware, adParkController.deleteAdParkById);

// Route pour récupérer une campagne adPark via l'ID de publicité
router.get(
  "/ad-park-by-advertisement/:advertisementId",
  adParkController.getAdParkByAdvertisementId
);

module.exports = router;
