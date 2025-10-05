const express = require("express");
const router = express.Router();
const adminSettingsController = require("../controllers/adminSettingsController");

// Route pour créer ou initialiser les paramètres administratifs
router.post("/admin-settings", adminSettingsController.createAdminSettings);

// Route pour récupérer les paramètres administratifs
router.get("/admin-settings", adminSettingsController.getAdminSettings);

// Route pour mettre à jour les paramètres administratifs
router.put("/admin-settings", adminSettingsController.updateAdminSettings);

// Route pour supprimer les paramètres administratifs
router.delete("/admin-settings", adminSettingsController.deleteAdminSettings);

module.exports = router;
