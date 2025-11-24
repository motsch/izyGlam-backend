const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour récupérer ou générer les posts mensuels
router.get("/posts-monthly/:userId", authMiddleware, postController.getOrGenerateMonthlyPosts);

// Route pour envoyer un prompt à Midjourney
router.get("/posts-ai-image/:postId", authMiddleware, postController.sendPromptToDallE);

// Génération d'images pour plusieurs posts
router.post('/posts-multiple-ai-image', authMiddleware, postController.sendPromptsToDallE);

// Route pour mettre à jour un post
router.get("/posts-update-one/:userId/:postId", authMiddleware, postController.updateUniquePost);

// Route pour récupérer tous les posts d'un utilisateur
router.get("/posts/:userId", authMiddleware, postController.getAllPosts);

// Route pour supprimer un post par ID
router.delete("/posts/:postId", authMiddleware, postController.deletePostById);

// Route pour récupérer un post par ID
router.get("/posts/:postId", authMiddleware, postController.getPostById);

// Route pour mettre à jour un post par ID
router.put("/posts/:postId", authMiddleware, postController.updatePostById);

// Route pour améliorer un texte Instagram
router.post("/posts/improve-instagram-post/:postId", authMiddleware, postController.improveInstagramPost);

// Route pour mettre à jour l'URL de l'image d'un post
router.put("/posts-update-image-url", authMiddleware, postController.updatePostImageUrl);

// Route pour générer un nouveau post
router.get("/posts-create-one/:userId/:platform", authMiddleware, postController.createUniquePost);

module.exports = router;
