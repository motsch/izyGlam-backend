const express = require("express");
const router = express.Router();
const tipsController = require("../controllers/tipsController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer un nouveau tip
router.post("/tips", authMiddleware, tipsController.createTip);

// Route pour récupérer tous les tips
router.get("/tips", tipsController.getAllTips);

// Route pour récupérer un tip spécifique par ID
router.get("/tips/:id", tipsController.getTipById);

// Route pour mettre à jour un tip par ID
router.put("/tips/:id", authMiddleware, tipsController.updateTipById);

// Route pour supprimer un tip par ID
router.delete("/tips/:id", authMiddleware, tipsController.deleteTipById);

module.exports = router;
