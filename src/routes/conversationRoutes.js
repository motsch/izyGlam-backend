// src/routes/conversationRoutes.ts

const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversationController");
const authMiddleware = require("../middlewares/authMiddleware");

// Création d'une nouvelle conversation
router.post("/conversation", authMiddleware, conversationController.createConversation);

// Récupérer toutes les conversations
router.get("/conversation", authMiddleware, conversationController.getAllConversations);

// Récupérer une conversation par ID
router.get("/conversation/:id", authMiddleware, conversationController.getConversationById);

// Ajouter un message (texte ou photo) à une conversation
router.post("/conversation/:id/message", authMiddleware, conversationController.addMessage);

// Supprimer une conversation par ID (action restreinte)
router.delete("/conversation/:id", authMiddleware, conversationController.deleteConversationById);

// Route pour récupérer ou créer la conversation Support
router.get("/support", authMiddleware, conversationController.getOrCreateSupportConversation);

// Route pour envoyer un message au support
router.post("/support/message", authMiddleware, conversationController.addSupportMessage);

// Supprimer (soft) un message d'une conversation (action admin)
router.delete(
  "/conversation/:conversationId/message/:messageId",
  authMiddleware,
  conversationController.deleteMessage
);

// Inviter un utilisateur dans une conversation existante (action restreinte)
router.post(
  "/conversation/:conversationId/invite",
  authMiddleware,
  conversationController.inviteUser
);

// Récupérer ou créer une conversation pour un utilisateur donné (exemple pour conversation privée)
router.get("/conversation-user/:userId", authMiddleware, conversationController.getOrCreateConversationByUserId);

// Nouvelle route pour créer une conversation à partir d'un email
router.put("/conversation-email/:email", authMiddleware, conversationController.createConversationByEmail);


// Récupérer toutes les conversations
router.get("/support-conversation", authMiddleware, conversationController.getSupportMessages);
module.exports = router;
