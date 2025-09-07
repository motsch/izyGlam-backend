// src/controllers/conversationController.ts

import axios from "axios";
import ConversationModel, { iConversation, IMessage } from "../models/conversation";
import UserModel from "../models/user";
import * as express from "express";
import mongoose from "mongoose";
import { rooms, WebSocket } from "../index";

const SUPPORT_USER_ID = process.env.SUPPORT_USER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Créer une nouvelle conversation
 */
const createConversation = async (req: express.Request, res: express.Response) => {
  try {
    const { participants, name } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: "Participants requis" });
    }

    // Si c'est un chat privé (2 participants), on vérifie qu'il n'existe pas déjà
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
 * Récupérer toutes les conversations
 */
const getAllConversations = async (req: express.Request, res: express.Response) => {
  try {
    const conversations = await ConversationModel.find()
      .populate({
        path: "participants",
        model: UserModel,
        select: "firstname lastname email"
      });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les conversations", error });
  }
};

/**
 * Récupérer une conversation par ID
 */
const getConversationById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const conversation = await ConversationModel.findById(id)
      .populate({
        path: "participants",
        model: UserModel,
        select: "firstname lastname email"
      });
    if (!conversation) return res.status(404).json({ message: "Conversation non trouvée" });
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la conversation", error });
  }
};

/**
 * Ajouter un message à une conversation
 */
const addMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { sender, content, messageType, mediaUrl } = req.body;

    if (!sender) {
      return res.status(400).json({ message: "L'expéditeur est requis" });
    }

    const conversation = await ConversationModel.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    const newMessage: IMessage = {
      sender,
      content: content || "",
      messageType: messageType || "text",
      mediaUrl: mediaUrl || "",
      createdAt: new Date(),
      deleted: false
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    // ✅ Diffusion WebSocket
    const payload = JSON.stringify({
      topic: `conversation/${id}`,
      message: newMessage,
    });

    rooms[`conversation/${id}`]?.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });

    return res.status(200).json(newMessage);
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un message :", error);
    res.status(500).json({ message: "Impossible d'ajouter le message", error });
  }
};

/**
 * Supprimer une conversation
 */
const deleteConversationById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedConversation = await ConversationModel.findByIdAndDelete(id);
    if (!deletedConversation) return res.status(404).json({ message: "Conversation non trouvée" });
    res.json({ message: "Conversation supprimée avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la conversation", error });
  }
};

/**
 * Soft delete d’un message
 */
const deleteMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.body.userId;

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation non trouvée" });

    const message = conversation.messages.find(
      (msg) => msg._id?.toString() === messageId
    );
    if (!message) return res.status(404).json({ message: "Message non trouvé" });

    message.deleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId || null;

    await conversation.save();
    res.status(200).json({ message: "Message supprimé", conversation });
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer le message", error });
  }
};

/**
 * Créer une conversation via email
 */
const createConversationByEmail = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.params;
    const { userEmail } = req.body;

    if (!email || !userEmail) {
      return res.status(400).json({ message: "Email manquant" });
    }

    const targetUser = await UserModel.findOne({ email });
    const currentUser = await UserModel.findOne({ email: userEmail });

    if (!targetUser || !currentUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const existingConversation = await ConversationModel.findOne({
      participants: { $all: [currentUser._id, targetUser._id] },
      "participants.2": { $exists: false }
    });

    if (existingConversation) return res.status(200).json(existingConversation);

    const newConversation = new ConversationModel({
      participants: [currentUser._id, targetUser._id],
      name: "",
      messages: []
    });

    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la création de la conversation", error });
  }
};

/**
 * Inviter un utilisateur
 */
const inviteUser = async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "ID utilisateur requis" });

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation non trouvée" });

    if (conversation.participants.includes(userId)) {
      return res.status(400).json({ message: "Utilisateur déjà présent" });
    }

    conversation.participants.push(userId);
    await conversation.save();
    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: "Impossible d'inviter l'utilisateur", error });
  }
};

module.exports = {
  createConversation,
  getAllConversations,
  getConversationById,
  addMessage,
  deleteConversationById,
  deleteMessage,
  inviteUser,
  createConversationByEmail
};
