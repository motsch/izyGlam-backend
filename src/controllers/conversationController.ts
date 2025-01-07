import ConversationModel from "../models/conversation";
import * as express from "express";
import UserModel from "../models/user";

// Créer une nouvelle conversation
const createConversation = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { participants } = req.body;
    const newConversation = new ConversationModel({ participants });
    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de créer la conversation", error });
  }
};

// Récupérer toutes les conversations avec les informations des utilisateurs
const getAllConversations = async (req: express.Request, res: express.Response) => {
  try {
    // Recherche toutes les conversations
    const conversations = await ConversationModel.find()
      .populate({
        path: "userId", // Assure-toi que `userId` est un ObjectId dans le modèle `Conversation`
        model: UserModel, // Relie avec le modèle utilisateur
        select: "firstname lastname email", // Sélectionne uniquement les champs nécessaires
      });

    res.json(conversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations :", error);
    res
      .status(500)
      .json({ message: "Impossible de récupérer les conversations", error });
  }
};

// Récupérer une conversation par ID
const getConversationById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const conversation = await ConversationModel.findById(id);
    if (conversation) {
      res.json(conversation);
    } else {
      res.status(404).json({ message: "Conversation non trouvée" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de récupérer la conversation", error });
  }
};

// Ajouter un message à une conversation
const addMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params; // ID de la conversation
    const { content, sender } = req.body; // Données du message
    console.log("id : " + id);
    console.log("content : " + content);
    console.log("sender : " + sender);
    // Trouve la conversation par son ID
    const conversation = await ConversationModel.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    // Crée un nouvel objet message
    const newMessage = {
      content,
      sender,
      createdAt: new Date(),
    };

    // Ajoute le message au tableau messages
    conversation.messages.push(newMessage);

    // Sauvegarde la conversation
    await conversation.save();

    // Renvoie la conversation mise à jour
    res.status(200).json(conversation);
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un message :", error);
    res.status(500).json({ message: "Impossible d'ajouter le message", error });
  }
};

// Supprimer une conversation par ID
const deleteConversationById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const deletedConversation = await ConversationModel.findByIdAndDelete(id);
    if (deletedConversation) {
      res.json({ message: "Conversation supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Conversation non trouvée" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de supprimer la conversation", error });
  }
};

// Récupérer ou créer une conversation par userId
const getOrCreateConversationByUserId = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params; // ID de l'utilisateur

    // Cherche une conversation existante pour cet utilisateur
    let conversation = await ConversationModel.findOne({ userId });

    if (!conversation) {
      // Si aucune conversation n'existe, crée-en une nouvelle
      conversation = new ConversationModel({
        userId,
        messages: [], // Initialise avec un tableau vide de messages
      });

      // Sauvegarde la nouvelle conversation
      await conversation.save();

      // Met à jour l'utilisateur avec l'`conversationId`
      const user = await UserModel.findById(userId);
      if (user) {
        user.conversationId = conversation._id.toString(); // Assure-toi que l'ID est une chaîne
        await user.save();
      } else {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
    }

    // Renvoie la conversation existante ou nouvellement créée
    res.status(200).json(conversation);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération ou de la création de la conversation :",
      error
    );
    res
      .status(500)
      .json({
        message: "Impossible de récupérer ou de créer la conversation",
        error,
      });
  }
};

module.exports = {
  createConversation,
  getAllConversations,
  getConversationById,
  addMessage,
  deleteConversationById,
  getOrCreateConversationByUserId,
};
