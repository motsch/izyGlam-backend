const express = require("express");
const router = express.Router();
const socialMediaController = require("../controllers/socialMediaController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour publier un post sur LinkedIn
router.post("/linkedin/post", authMiddleware, socialMediaController.postOnLinkedIn);

// Route pour publier un post sur Instagram
router.post("/instagram/post", authMiddleware, socialMediaController.postOnInstagram);

// Route pour publier une vidéo sur TikTok
router.post("/tiktok/post", authMiddleware, socialMediaController.postOnTikTok);

// Route pour publier un post sur Facebook
router.post("/facebook/post", authMiddleware, socialMediaController.postOnFacebook);

// Route pour récupérer les informations d'un post (sur toutes les plateformes)
router.get("/post/info", authMiddleware, socialMediaController.getPostInfo);

router.post('/connect/:platform', socialMediaController.connect);
router.get('/status/:platform', authMiddleware, socialMediaController.checkConnectionStatus);

module.exports = router;
