// src/controllers/conversationController.ts

import axios from "axios";
import ConversationModel, { iConversation, IMessage } from "../models/conversation";
import UserModel from "../models/user";
import * as express from "express";
import { notifyNewMessage } from "../services/notify";

const SUPPORT_USER_ID = process.env.SUPPORT_USER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Créer une nouvelle conversation (générique).
 * Pour un chat privé (2 participants), on vérifie qu'il n'existe pas déjà.
 */
const createConversation = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { participants, name } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: "Participants requis" });
    }

    // Si c'est un chat privé (2 participants), on vérifie qu'il n'existe pas déjà.
    if (participants.length === 2) {
      const existingConversation = await ConversationModel.findOne({
        participants: { $all: participants },
        "participants.2": { $exists: false }
      });
      if (existingConversation) {
        return res.status(200).json(existingConversation);
      }
    }

    const newConversation = new ConversationModel({ participants, name });
    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la conversation", error });
  }
};

/**
 * Récupérer toutes les conversations (avec participants renseignés)
 */
const getAllConversations = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const conversations = await ConversationModel.find()
      .populate({
        path: "participants",
        model: UserModel,
        select: "firstname lastname email"
      });
    res.json(conversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations :", error);
    res.status(500).json({ message: "Impossible de récupérer les conversations", error });
  }
};

/**
 * Récupérer une conversation par ID
 */
const getConversationById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const conversation = await ConversationModel.findById(id)
      .populate({
        path: "participants",
        model: UserModel,
        select: "firstname lastname email"
      });
    if (conversation) {
      res.json(conversation);
    } else {
      res.status(404).json({ message: "Conversation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la conversation", error });
  }
};

/**
 * Ajouter un message à une conversation
 */
const addMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params; // ID de la conversation
    const { sender, content, messageType, mediaUrl, language } = req.body;

    if (!sender) {
      return res.status(400).json({ message: "L'expéditeur est requis" });
    }

    const conversation = await ConversationModel.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    let translatedContent = content;
    if (language !== "fr" && conversation.name === "Support") {
      translatedContent = await translateMessage(content, language, "fr");
    }

    const newMessage: IMessage = {
      sender,
      content: content || "",
      contentFr: translatedContent || "",
      messageType: messageType || "text",
      mediaUrl: mediaUrl || "",
      createdAt: new Date(),
      deleted: false,
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    // 🔥 Envoi des notifs push
    await notifyNewMessage(conversation, newMessage);

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un message :", error);
    res.status(500).json({ message: "Impossible d'ajouter le message", error });
  }
};


/**
 * Supprimer (complètement) une conversation par ID
 */
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
    res.status(500).json({ message: "Impossible de supprimer la conversation", error });
  }
};

/**
 * Suppression soft d'un message dans une conversation (accessible à tous)
 */
const deleteMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.body.userId; // On récupère l'ID de l'utilisateur depuis le body

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    const message = conversation.messages.find(
      (msg) => msg._id?.toString() === messageId
    );
    if (!message) {
      return res.status(404).json({ message: "Message non trouvé" });
    }

    message.deleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId || null;

    await conversation.save();
    res.status(200).json({
      message: "Message supprimé (soft)",
      conversation
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du message :", error);
    res.status(500).json({ message: "Impossible de supprimer le message", error });
  }
};

/**
 * Créer une conversation à partir de l'email d'un utilisateur cible.
 * On reçoit dans les params : { email } et dans le body : { userEmail }.
 * userEmail correspond à l'email de l'utilisateur connecté.
 */
const createConversationByEmail = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    console.log("=== Début de createConversationByEmail ===");

    // Récupérer l'email cible depuis les params et l'email de l'utilisateur connecté depuis le body
    const { email } = req.params;
    const { userEmail } = req.body;

    console.log("Email reçu dans les params :", email);
    console.log("userEmail reçu dans le body :", userEmail);

    if (!email) {
      console.error("Aucun email fourni (params).");
      return res.status(400).json({ message: "L'email (params) est requis" });
    }

    if (!userEmail) {
      console.error("Aucun userEmail fourni (body).");
      return res.status(400).json({ message: "Le userEmail (body) est requis" });
    }
    console.log(userEmail)

    console.log("Recherche de l'utilisateur cible par email...");
    const targetUser = await UserModel.findOne({ email });
    console.log("Résultat de la recherche d'utilisateur cible :", targetUser);
    if (!targetUser) {
      console.error("Aucun utilisateur trouvé avec l'email :", email);
      return res.status(404).json({ message: "Utilisateur non trouvé avec cet email" });
    }

    console.log("Recherche de l'utilisateur connecté par userEmail...");
    const currentUser = await UserModel.findOne({ email: userEmail });
    console.log("Utilisateur connecté :", currentUser);
    if (!currentUser || !currentUser._id) {
      console.error("Utilisateur connecté non authentifié ou ID manquant.");
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    console.log("Vérification de l'existence d'une conversation entre", currentUser._id, "et", targetUser._id);
    const existingConversation = await ConversationModel.findOne({
      participants: { $all: [currentUser._id, targetUser._id] },
      "participants.2": { $exists: false }
    });
    console.log("Conversation existante :", existingConversation);
    if (existingConversation) {
      console.log("Une conversation existe déjà, renvoi de celle-ci.");
      return res.status(200).json(existingConversation);
    }

    // Pour un chat privé, on peut ne pas définir de nom statique (l'affichage se fera côté front)
    const conversationName = "";
    console.log("Nom de la nouvelle conversation (vide pour chat privé) :", conversationName);

    console.log("Création de la nouvelle conversation...");
    const newConversation = new ConversationModel({
      participants: [currentUser._id, targetUser._id],
      name: conversationName,
      messages: []
    });

    console.log("Enregistrement de la nouvelle conversation en base de données...");
    await newConversation.save();
    console.log("Nouvelle conversation enregistrée avec succès :", newConversation);

    console.log("=== Fin de createConversationByEmail ===");
    res.status(201).json(newConversation);
  } catch (error) {
    console.error("Erreur lors de la création de la conversation par email :", error);
    res.status(500).json({ message: "Erreur lors de la création de la conversation", error });
  }
};

/**
 * Inviter un utilisateur dans une conversation existante
 */
const inviteUser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "L'ID utilisateur est requis" });
    }
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation non trouvée" });
    }
    // Vérifier que l'utilisateur n'est pas déjà participant
    if (conversation.participants.includes(userId)) {
      return res.status(400).json({ message: "Utilisateur déjà invité" });
    }
    conversation.participants.push(userId);
    await conversation.save();
    res.status(200).json({ message: "Utilisateur invité", conversation });
  } catch (error) {
    res.status(500).json({ message: "Impossible d'inviter l'utilisateur", error });
  }
};

/**
 * Récupérer ou créer une conversation pour un utilisateur donné
 * (exemple pour conversation privée : si participants = 1)
 */
const getOrCreateConversationByUserId = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;
    let conversation = await ConversationModel.findOne({ participants: userId });
    if (!conversation) {
      conversation = new ConversationModel({
        participants: [userId],
        messages: []
      });
      await conversation.save();

      const user = await UserModel.findById(userId);
      if (user) {
        user.conversationId = conversation._id.toString();
        await user.save();
      } else {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
    }
    res.status(200).json(conversation);
  } catch (error) {
    console.error("Erreur lors de la récupération/création de la conversation :", error);
    res.status(500).json({ message: "Impossible de récupérer ou créer la conversation", error });
  }
};

// Récupérer ou créer la conversation Support pour un utilisateur
const getOrCreateSupportConversation = async (
  req: express.Request,
  res: express.Response) => {
  try {
    // Récupération depuis req.query car les paramètres sont dans l'URL
    const { userId, language } = req.query;
    console.log('USER_ID ======> ' + JSON.stringify(userId));

    if (!userId) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    let conversation = await ConversationModel.findOne({
      participants: { $all: [userId, SUPPORT_USER_ID] },
      name: "Support",
    });

    if (!conversation) {
      conversation = new ConversationModel({
        participants: [userId, SUPPORT_USER_ID],
        name: "Support",
        language: language || "fr",
      });
      await conversation.save();
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Erreur lors de la récupération/création de la conversation Support:", error);
    res.status(500).json({ message: "Impossible d'obtenir la conversation Support", error });
  }
};


// Ajouter un message à la conversation Support
const getSupportMessages = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const conversations = await ConversationModel.find({ name: "Support" }) // Filtrer les conversations
      .populate({
        path: "participants",
        model: UserModel,
        select: "firstname lastname email"
      });

    for (let conv of conversations) {
      let idUser = conv.participants[0];
      const user = await UserModel.findById(idUser);
      if (!user) {
        res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      conv.user = user;
    }
    await res.status(200).json(conversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des messages Support:", error);
    res.status(500).json({ message: "Impossible de récupérer les messages Support", error });
  }
};


// Ajouter un message à la conversation Support
const addSupportMessage = async (
  req: express.Request,
  res: express.Response) => {
  try {
    console.log("ADD SUPPORT MESSAGE :")
    const { content, messageType, mediaUrl } = req.body;

    const { userId, language } = req.params;
    // const userId = req.user.id; // Utilisateur connecté

    let conversation: any = await ConversationModel.findOne({
      participants: { $all: [userId, SUPPORT_USER_ID] },
      name: "Support",
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation Support non trouvée" });
    }
    console.log(language);
    let translatedContent = content;
    if (language !== "fr" && userId === SUPPORT_USER_ID) {
      console.log("Langue pas française ====> " + language)
      translatedContent = await translateMessage(content, language, "fr");
    }

    const newMessage = {
      sender: userId,
      content: content,
      contentFr: translatedContent,
      messageType: messageType || "text",
      mediaUrl: mediaUrl || "",
      createdAt: new Date(),
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un message Support:", error);
    res.status(500).json({ message: "Impossible d'ajouter le message", error });
  }
};

const translateMessage = async (content: any, sourceLang: string, targetLang: string) => {
  if (!OPENAI_API_KEY) {
    console.error("Clé API OpenAI manquante");
    return content;
  }

  if (sourceLang === targetLang) {
    return content;
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Tu es un traducteur précis. Traduis ce texte de ${sourceLang} vers ${targetLang}.`
          },
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.3
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error: any) {
    console.error("Erreur de traduction OpenAI :", error.response?.data || error.message);
    return content;
  }
};
module.exports = {
  createConversation,
  getAllConversations,

  getConversationById,
  addMessage,
  deleteConversationById,
  deleteMessage,
  addSupportMessage,
  inviteUser,
  getSupportMessages,
  getOrCreateSupportConversation,
  getOrCreateConversationByUserId,
  createConversationByEmail
};
