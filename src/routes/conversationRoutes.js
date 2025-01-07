const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversationController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer une nouvelle conversation
router.post("/conversation", conversationController.createConversation);

// Route pour récupérer toutes les conversations
router.get("/conversation", conversationController.getAllConversations);

// Route pour récupérer une conversation par ID
router.get("/conversation/:id", conversationController.getConversationById);

// Route pour ajouter un message à une conversation
router.post("/conversation/:id/message", conversationController.addMessage);

// Route pour supprimer une conversation par ID
router.delete("/conversation/:id", authMiddleware, conversationController.deleteConversationById);

// Route pour récupérer les messages d'un user par ID
router.get("/conversation-user/:userId", conversationController.getOrCreateConversationByUserId);


module.exports = router;
