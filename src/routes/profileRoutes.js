const express = require("express");
const profileController = require("../controllers/profileController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/profile/:userId", authMiddleware, profileController.createProfile);

// Route pour récupérer tous les profils
router.get("/profiles", authMiddleware, profileController.getAllProfiles);

// Route pour récupérer un profil spécifique par ID
router.get("/profile/:id", authMiddleware, profileController.getProfileById);

// Route pour récupérer les profils par userId
router.get("/profile-by-user/:userId", authMiddleware, profileController.getProfilesByUserId);

// Route pour mettre à jour un profil par ID
router.put("/profile/:id", authMiddleware, profileController.updateProfileById);

// Route pour supprimer un profil par ID
router.delete("/profile/:id", authMiddleware, profileController.deleteProfileById);

module.exports = router;
