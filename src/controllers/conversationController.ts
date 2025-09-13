import axios from "axios";
import ConversationModel, { IMessage } from "../models/conversation";
import UserModel from "../models/user";
import * as express from "express";
import mongoose from "mongoose";
import { rooms, WebSocket } from "../index";
// ✅ Import notification (utilise ton fichier utilitaire fourni)
import { notifyChatMessage } from "../services/notify";

const SUPPORT_USER_ID = process.env.SUPPORT_USER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPPORT_AGENT_URL =
  process.env.SUPPORT_AGENT_URL || "http://support-agent:9000/support/reply";

/**
 * Créer une nouvelle conversation
 */
const createConversation = async (req: express.Request, res: express.Response) => {
  try {
    const { participants, name } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: "Participants requis" });
    }

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
    const conversations = await ConversationModel.find().populate({
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
    const conversation = await ConversationModel.findById(id).populate({
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
 * Ajouter un message
 */
const addMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { sender, content, messageType, mediaUrl, clientId } = req.body;

    if (!sender) return res.status(400).json({ message: "L'expéditeur est requis" });

    const conversation = await ConversationModel.findById(id);
    if (!conversation) return res.status(404).json({ message: "Conversation non trouvée" });

    const newMessage: IMessage = {
      sender,
      content: content || "",
      messageType: messageType || "text",
      mediaUrl: mediaUrl || "",
      createdAt: new Date(),
      deleted: false,
      clientId // ✅ pour dédup côté front
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    // ✅ Récupérer la vraie version sauvegardée (avec _id)
    const savedMsg = conversation.messages[conversation.messages.length - 1];

    // ✅ Diffusion temps réel via WS
    const payload = JSON.stringify({ topic: `conversation/${id}`, message: savedMsg });
    rooms[`conversation/${id}`]?.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });

    // ✅ Notification push aux destinataires (pas l'expéditeur)
    // Message clair, sympa et pro généré par notifyNewMessage (titre + preview).
    try {
      await notifyChatMessage(conversation, savedMsg);
    } catch (e) {
      console.error("[NOTIFY][chat] erreur envoi notification:", e);
      // On ne bloque pas la réponse HTTP si la notif échoue
    }

    // ✅ Retourner la vraie version
    return res.status(200).json(savedMsg);
  } catch (error) {
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

    const message = conversation.messages.find((msg) => msg._id?.toString() === messageId);
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

/**
 * Récupérer ou créer une conversation pour un utilisateur
 */
const getOrCreateConversationByUserId = async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    let conversation = await ConversationModel.findOne({ participants: userId });
    if (!conversation) {
      conversation = new ConversationModel({ participants: [userId], messages: [] });
      await conversation.save();
    }
    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer ou créer la conversation", error });
  }
};

/**
 * Récupérer ou créer la conversation Support
 */
const getOrCreateSupportConversation = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, language } = req.query;
    if (!userId) return res.status(400).json({ message: "Utilisateur requis" });

    let conversation = await ConversationModel.findOne({
      participants: { $all: [userId, SUPPORT_USER_ID] },
      name: "Support"
    });

    if (!conversation) {
      conversation = new ConversationModel({
        participants: [userId, SUPPORT_USER_ID],
        name: "Support",
        language: (language as string) || "fr"
      });
      await conversation.save();
    }

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: "Impossible d'obtenir la conversation Support", error });
  }
};

/**
 * Récupérer toutes les conversations Support
 */
const getSupportMessages = async (req: express.Request, res: express.Response) => {
  try {
    const conversations = await ConversationModel.find({ name: "Support" }).populate({
      path: "participants",
      model: UserModel,
      select: "firstname lastname email"
    });

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les messages Support", error });
  }
};

/**
 * Ajouter un message à la conversation Support
 */
/**
 * Ajouter un message à la conversation Support
 */
const addSupportMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { content, messageType, mediaUrl, clientId, language, conversationId } = req.body;

    const authUser = (req as any).user || null;
    const userId = authUser?._id || authUser?.id || null;

    console.log("➡️ [Support] Nouveau message reçu:");
    console.log("   userId (auth):", userId || "(absent)");
    console.log("   conversationId (body):", conversationId || "(absent)");
    console.log("   language:", language);
    console.log("   content:", content);
    console.log("   messageType:", messageType);

    if (!content && !mediaUrl) {
      return res.status(400).json({ message: "Message vide" });
    }

    if (!SUPPORT_USER_ID) {
      console.error("❌ [Support] SUPPORT_USER_ID non défini en env");
      return res.status(500).json({ message: "Support non configuré (SUPPORT_USER_ID manquant)" });
    }

    const supportOid = new mongoose.Types.ObjectId(String(SUPPORT_USER_ID));
    let conversation: any = null;

    // 1) Si on fournit la conversation directement (recommandé côté front)
    if (conversationId) {
      conversation = await ConversationModel.findById(conversationId);
      if (!conversation) {
        console.warn("⚠️ [Support] conversationId inexistant → 404");
        return res.status(404).json({ message: "Conversation Support non trouvée" });
      }
      // Vérifier que c’est bien la conv Support
      if ((conversation.name || "").toLowerCase() !== "support") {
        console.warn("⚠️ [Support] conversationId fourni mais name != Support");
      }
      console.log("✅ [Support] Conversation trouvée par ID:", conversation._id);
    } else {
      // 2) Sinon, on s’appuie sur le user authentifié
      if (!userId) {
        console.warn("❌ [Support] userId introuvable (auth manquante ?).");
        return res.status(400).json({ message: "Utilisateur non authentifié (userId manquant)" });
      }
      const uid = new mongoose.Types.ObjectId(String(userId));

      conversation = await ConversationModel.findOne({
        participants: { $all: [uid, supportOid] },
        name: "Support"
      });

      if (!conversation) {
        console.warn("⚠️ [Support] Conversation non trouvée pour user", userId, "→ création…");
        conversation = new ConversationModel({
          participants: [uid, supportOid],
          name: "Support",
          language: language || "fr",
          messages: []
        });
        await conversation.save();
        console.log("✅ [Support] Conversation créée:", conversation._id);
      } else {
        console.log("✅ [Support] Conversation trouvée:", conversation._id);
      }
    }

    // ---- 1. Sauvegarder le message utilisateur ----
    const senderId = userId
      ? new mongoose.Types.ObjectId(String(userId))
      : conversation.participants.find((p: any) => String(p) !== String(SUPPORT_USER_ID));

    const newMessage: IMessage = {
      sender: senderId,
      content,
      messageType: messageType || "text",
      mediaUrl: mediaUrl || "",
      createdAt: new Date(),
      clientId
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    const savedMsg = conversation.messages[conversation.messages.length - 1];
    console.log("💾 [Support] Message utilisateur sauvegardé:", savedMsg._id);

    // Diffusion WS
    const payload = JSON.stringify({
      topic: `conversation/${conversation._id}`,
      message: savedMsg
    });
    rooms[`conversation/${conversation._id}`]?.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        console.log("📡 [WS] Message utilisateur diffusé");
      }
    });

    // Notif push
    try {
      await notifyChatMessage(conversation, savedMsg);
      console.log("📲 [Push] Notification envoyée (user → support)");
    } catch (e) {
      console.error("❌ [Push] Erreur notification:", e);
    }

    // ---- 2. Appeler l’agent IA pour une réponse éventuelle ----
    try {
      console.log("🤖 [Agent] Appel à l’IA…");
      const resp = await axios.post(SUPPORT_AGENT_URL, {
        conversationId: String(conversation._id),
        lastMessageId: String(savedMsg._id),
        lastMessageText: savedMsg.content,
        language: language || conversation.language || "fr",
        userId: String(senderId)
      });
      console.log("✅ [Agent] Réponse:", resp.data);

      if (resp.data.action === "reply" && resp.data.reply) {
        const autoReply: IMessage = {
          sender: new mongoose.Types.ObjectId(String(SUPPORT_USER_ID)),
          content: resp.data.reply,
          messageType: "text",
          createdAt: new Date(),
          clientId: ""
        };
        conversation.messages.push(autoReply);
        await conversation.save();

        const savedReply = conversation.messages[conversation.messages.length - 1];
        console.log("💾 [Support] Réponse IA sauvegardée:", savedReply._id);

        const replyPayload = JSON.stringify({
          topic: `conversation/${conversation._id}`,
          message: savedReply
        });
        rooms[`conversation/${conversation._id}`]?.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(replyPayload);
            console.log("📡 [WS] Réponse IA diffusée");
          }
        });

        await notifyChatMessage(conversation, savedReply);
        console.log("📲 [Push] Notification envoyée (support → user)");
      } else if (resp.data.action === "escalate") {
        console.warn("⚠️ [Agent] Escalade requise (humain)");
      } else {
        console.log("ℹ️ [Agent] noop (pas de réponse)");
      }
    } catch (agentErr) {
      console.error("❌ [Agent] Erreur appel IA:", agentErr);
      // On ne bloque pas la réponse HTTP au client
    }

    // ---- 3. Réponse API ----
    res.status(200).json(savedMsg);
    console.log("✅ [Support] addSupportMessage terminé");

  } catch (error) {
    console.error("🔥 [Support] Erreur addSupportMessage:", error);
    res.status(500).json({ message: "Impossible d'ajouter le message Support", error });
  }
};

export {
  createConversation,
  getAllConversations,
  getConversationById,
  addMessage,
  deleteConversationById,
  deleteMessage,
  inviteUser,
  createConversationByEmail,
  getOrCreateConversationByUserId,
  getOrCreateSupportConversation,
  getSupportMessages,
  addSupportMessage
};
