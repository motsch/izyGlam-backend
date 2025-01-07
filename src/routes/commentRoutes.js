const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Créer un commentaire
router.post("/comments", authMiddleware, commentController.createComment);

// Récupérer tous les commentaires
router.get("/comments", commentController.getAllComments);

// Récupérer un commentaire par ID
router.get("/comments/:id", commentController.getCommentById);

// Mettre à jour un commentaire
router.put("/comments/:id", authMiddleware, commentController.updateCommentById);

// Supprimer un commentaire
router.delete("/comments/:id", authMiddleware, commentController.deleteCommentById);

module.exports = router;
