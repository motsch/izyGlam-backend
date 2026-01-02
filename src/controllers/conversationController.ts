import axios from "axios";
import ConversationModel, { IMessage } from "../models/conversation";
import UserModel from "../models/user";
import * as express from "express";
import mongoose from "mongoose";
import { rooms, WebSocket } from "../index";
import { logger } from "../utils/logger";
import { notifyChatMessage } from "../services/notify";

const SUPPORT_USER_ID = process.env.SUPPORT_USER_ID;
const SUPPORT_AGENT_URL = process.env.SUPPORT_AGENT_URL || "http://support-agent:9000/support/reply";

// --- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban", "api_key", "apikey", "authorization"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

/**
 * Créer une nouvelle conversation
 */
const createConversation = async (req: express.Request, res: express.Response) => {
  try {
    const { participants, name } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      logger.warn({
        msg: "createConversation bad request",
        route: "POST /api/conversation",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "Participants requis" });
    }

    if (participants.length === 2) {
      const existingConversation = await ConversationModel.findOne({
        participants: { $all: participants },
        "participants.2": { $exists: false },
      });
      if (existingConversation) {
        logger.info({
          msg: "createConversation existing returned",
          route: "POST /api/conversation",
          method: req.method,
          url: req.originalUrl,
          conversationId: existingConversation._id?.toString(),
        });
        return res.status(200).json(existingConversation);
      }
    }

    const newConversation = new ConversationModel({ participants, name });
    await newConversation.save();

    logger.info({
      msg: "createConversation success",
      route: "POST /api/conversation",
      method: req.method,
      url: req.originalUrl,
      conversationId: newConversation._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newConversation);
  } catch (error: any) {
    logger.error({
      msg: "createConversation failed",
      route: "POST /api/conversation",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la conversation" });
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
      select: "firstname lastname email",
    });

    logger.info({
      msg: "getAllConversations success",
      route: "GET /api/conversation",
      method: req.method,
      url: req.originalUrl,
      count: conversations.length,
    });

    res.json(conversations);
  } catch (error: any) {
    logger.error({
      msg: "getAllConversations failed",
      route: "GET /api/conversation",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les conversations" });
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
      select: "firstname lastname email",
    });

    if (!conversation) {
      logger.warn({
        msg: "getConversationById not found",
        route: "GET /api/conversation/:id",
        method: req.method,
        url: req.originalUrl,
        conversationId: id,
      });
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    logger.info({
      msg: "getConversationById success",
      route: "GET /api/conversation/:id",
      method: req.method,
      url: req.originalUrl,
      conversationId: id,
    });

    res.json(conversation);
  } catch (error: any) {
    logger.error({
      msg: "getConversationById failed",
      route: "GET /api/conversation/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la conversation" });
  }
};

/**
 * Ajouter un message
 */
const addMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { sender, content, messageType, mediaUrl, clientId } = req.body;

    if (!sender) {
      logger.warn({
        msg: "addMessage bad request (sender missing)",
        route: "POST /api/conversation/:id/message",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "L'expéditeur est requis" });
    }

    const conversation = await ConversationModel.findById(id);
    if (!conversation) {
      logger.warn({
        msg: "addMessage conversation not found",
        route: "POST /api/conversation/:id/message",
        method: req.method,
        url: req.originalUrl,
        conversationId: id,
      });
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    const newMessage: IMessage = {
      sender,
      content: content || "",
      messageType: messageType || "text",
      mediaUrl: mediaUrl || "",
      createdAt: new Date(),
      deleted: false,
      clientId,
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    // ✅ Récupérer la version sauvegardée
    const savedMsg = conversation.messages[conversation.messages.length - 1];

    // Diffusion WS
    const payload = JSON.stringify({ topic: `conversation/${id}`, message: savedMsg });
    rooms[`conversation/${id}`]?.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });

    // Notif push (fire & forget)
    notifyChatMessage(conversation, savedMsg).catch((e) =>
      logger.error({
        msg: "notifyChatMessage failed",
        route: "POST /api/conversation/:id/message",
        method: req.method,
        url: req.originalUrl,
        conversationId: id,
        errorMessage: e?.message,
        stack: e?.stack,
      })
    );

    logger.info({
      msg: "addMessage success",
      route: "POST /api/conversation/:id/message",
      method: req.method,
      url: req.originalUrl,
      conversationId: id,
      messageId: (savedMsg as any)?._id?.toString(),
    });

    return res.status(200).json(savedMsg);
  } catch (error: any) {
    logger.error({
      msg: "addMessage failed",
      route: "POST /api/conversation/:id/message",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible d'ajouter le message" });
  }
};

/**
 * Supprimer une conversation
 */
const deleteConversationById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedConversation = await ConversationModel.findByIdAndDelete(id);

    if (!deletedConversation) {
      logger.warn({
        msg: "deleteConversationById not found",
        route: "DELETE /api/conversation/:id",
        method: req.method,
        url: req.originalUrl,
        conversationId: id,
      });
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    logger.info({
      msg: "deleteConversationById success",
      route: "DELETE /api/conversation/:id",
      method: req.method,
      url: req.originalUrl,
      conversationId: id,
    });

    res.json({ message: "Conversation supprimée avec succès" });
  } catch (error: any) {
    logger.error({
      msg: "deleteConversationById failed",
      route: "DELETE /api/conversation/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la conversation" });
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
    if (!conversation) {
      logger.warn({
        msg: "deleteMessage conversation not found",
        route: "DELETE /api/conversation/:conversationId/message/:messageId",
        method: req.method,
        url: req.originalUrl,
        conversationId,
        messageId,
      });
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    const message = conversation.messages.find((msg) => msg._id?.toString() === messageId);
    if (!message) {
      logger.warn({
        msg: "deleteMessage message not found",
        route: "DELETE /api/conversation/:conversationId/message/:messageId",
        method: req.method,
        url: req.originalUrl,
        conversationId,
        messageId,
      });
      return res.status(404).json({ message: "Message non trouvé" });
    }

    message.deleted = true;
    (message as any).deletedAt = new Date();
    (message as any).deletedBy = userId || null;

    await conversation.save();

    logger.info({
      msg: "deleteMessage success",
      route: "DELETE /api/conversation/:conversationId/message/:messageId",
      method: req.method,
      url: req.originalUrl,
      conversationId,
      messageId,
      userId,
    });

    res.status(200).json({ message: "Message supprimé", conversation });
  } catch (error: any) {
    logger.error({
      msg: "deleteMessage failed",
      route: "DELETE /api/conversation/:conversationId/message/:messageId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer le message" });
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
      logger.warn({
        msg: "createConversationByEmail bad request",
        route: "PUT /api/conversation-email/:email",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "Email manquant" });
    }

    const targetUser = await UserModel.findOne({ email });
    const currentUser = await UserModel.findOne({ email: userEmail });

    if (!targetUser || !currentUser) {
      logger.warn({
        msg: "createConversationByEmail user not found",
        route: "PUT /api/conversation-email/:email",
        method: req.method,
        url: req.originalUrl,
        email,
        userEmail,
      });
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const existingConversation = await ConversationModel.findOne({
      participants: { $all: [currentUser._id, targetUser._id] },
      "participants.2": { $exists: false },
    });

    if (existingConversation) {
      logger.info({
        msg: "createConversationByEmail existing returned",
        route: "PUT /api/conversation-email/:email",
        method: req.method,
        url: req.originalUrl,
        conversationId: existingConversation._id?.toString(),
      });
      return res.status(200).json(existingConversation);
    }

    const newConversation = new ConversationModel({
      participants: [currentUser._id, targetUser._id],
      name: "",
      messages: [],
    });

    await newConversation.save();

    logger.info({
      msg: "createConversationByEmail success",
      route: "PUT /api/conversation-email/:email",
      method: req.method,
      url: req.originalUrl,
      conversationId: newConversation._id?.toString(),
    });

    res.status(201).json(newConversation);
  } catch (error: any) {
    logger.error({
      msg: "createConversationByEmail failed",
      route: "PUT /api/conversation-email/:email",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Erreur lors de la création de la conversation" });
  }
};

/**
 * Inviter un utilisateur
 */
const inviteUser = async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      logger.warn({
        msg: "inviteUser bad request",
        route: "POST /api/conversation/:conversationId/invite",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "ID utilisateur requis" });
    }

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      logger.warn({
        msg: "inviteUser conversation not found",
        route: "POST /api/conversation/:conversationId/invite",
        method: req.method,
        url: req.originalUrl,
        conversationId,
      });
      return res.status(404).json({ message: "Conversation non trouvée" });
    }

    if (conversation.participants.map(String).includes(String(userId))) {
      logger.warn({
        msg: "inviteUser already participant",
        route: "POST /api/conversation/:conversationId/invite",
        method: req.method,
        url: req.originalUrl,
        conversationId,
        userId,
      });
      return res.status(400).json({ message: "Utilisateur déjà présent" });
    }

    conversation.participants.push(userId);
    await conversation.save();

    logger.info({
      msg: "inviteUser success",
      route: "POST /api/conversation/:conversationId/invite",
      method: req.method,
      url: req.originalUrl,
      conversationId,
      userId,
    });

    res.status(200).json(conversation);
  } catch (error: any) {
    logger.error({
      msg: "inviteUser failed",
      route: "POST /api/conversation/:conversationId/invite",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible d'inviter l'utilisateur" });
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
      logger.info({
        msg: "getOrCreateConversationByUserId created",
        route: "GET /api/conversation-user/:userId",
        method: req.method,
        url: req.originalUrl,
        userId,
        conversationId: conversation._id?.toString(),
      });
    } else {
      logger.info({
        msg: "getOrCreateConversationByUserId found",
        route: "GET /api/conversation-user/:userId",
        method: req.method,
        url: req.originalUrl,
        userId,
        conversationId: conversation._id?.toString(),
      });
    }

    res.status(200).json(conversation);
  } catch (error: any) {
    logger.error({
      msg: "getOrCreateConversationByUserId failed",
      route: "GET /api/conversation-user/:userId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer ou créer la conversation" });
  }
};

/**
 * Récupérer ou créer la conversation Support
 */
const getOrCreateSupportConversation = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, language } = req.query;
    if (!userId) {
      logger.warn({
        msg: "getOrCreateSupportConversation bad request",
        route: "GET /api/support",
        method: req.method,
        url: req.originalUrl,
        query: req.query,
      });
      return res.status(400).json({ message: "Utilisateur requis" });
    }

    if (!SUPPORT_USER_ID) {
      logger.error({
        msg: "getOrCreateSupportConversation missing SUPPORT_USER_ID",
        route: "GET /api/support",
        method: req.method,
        url: req.originalUrl,
      });
      return res.status(500).json({ message: "Support non configuré" });
    }

    let conversation = await ConversationModel.findOne({
      participants: { $all: [userId, SUPPORT_USER_ID] },
      name: "Support",
    });

    if (!conversation) {
      conversation = new ConversationModel({
        participants: [userId, SUPPORT_USER_ID],
        name: "Support",
        language: (language as string) || "fr",
      });
      await conversation.save();

      logger.info({
        msg: "getOrCreateSupportConversation created",
        route: "GET /api/support",
        method: req.method,
        url: req.originalUrl,
        conversationId: conversation._id?.toString(),
      });
    } else {
      logger.info({
        msg: "getOrCreateSupportConversation found",
        route: "GET /api/support",
        method: req.method,
        url: req.originalUrl,
        conversationId: conversation._id?.toString(),
      });
    }

    res.status(200).json(conversation);
  } catch (error: any) {
    logger.error({
      msg: "getOrCreateSupportConversation failed",
      route: "GET /api/support",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible d'obtenir la conversation Support" });
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
      select: "firstname lastname email",
    });

    logger.info({
      msg: "getSupportMessages success",
      route: "GET /api/support-conversation",
      method: req.method,
      url: req.originalUrl,
      count: conversations.length,
    });

    res.status(200).json(conversations);
  } catch (error: any) {
    logger.error({
      msg: "getSupportMessages failed",
      route: "GET /api/support-conversation",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les messages Support" });
  }
};

// Helper de stringify robuste pour les logs
const j = (o: any) => {
  try { return JSON.stringify(o); } catch { return String(o); }
};

/**
 * Ajouter un message à la conversation Support (avec éventuelle réponse de l’agent)
 * Version simple + logs explicites + stringify sûr
 */
const addSupportMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { content, messageType, mediaUrl, clientId, language, conversationId } = req.body;

    // URL de l'agent en dur (réseau Docker interne)
    const AGENT_URL = 'http://host.docker.internal:9000/support/reply';

    const authUser = (req as any).user || null;
    const userId = authUser?._id || authUser?.id || null;

    if (!content && !mediaUrl) {
      logger.warn('[support] empty message ' + j({ bodyKeys: Object.keys(req.body || {}) }));
      return res.status(400).json({ message: "Message vide" });
    }

    if (!SUPPORT_USER_ID) {
      logger.error('[support] missing SUPPORT_USER_ID');
      return res.status(500).json({ message: "Support non configuré (SUPPORT_USER_ID manquant)" });
    }

    let supportOid: mongoose.Types.ObjectId;
    try {
      supportOid = new mongoose.Types.ObjectId(String(SUPPORT_USER_ID));
    } catch {
      logger.error('[support] invalid SUPPORT_USER_ID ' + String(SUPPORT_USER_ID));
      return res.status(500).json({ message: "SUPPORT_USER_ID invalide" });
    }

    // ---- 0) Récupérer / créer la conversation
    let conversation: any = null;
    if (conversationId) {
      conversation = await ConversationModel.findById(conversationId);
      if (!conversation) {
        logger.warn('[support] conversationId not found ' + conversationId);
        return res.status(404).json({ message: "Conversation Support non trouvée" });
      }
      if ((conversation.name || '').toLowerCase() !== 'support') {
        logger.warn('[support] conversation not support ' + j({ conversationId, name: conversation.name }));
      }
    } else {
      if (!userId) {
        logger.warn('[support] missing userId');
        return res.status(400).json({ message: "Utilisateur non authentifié (userId manquant)" });
      }
      const uid = new mongoose.Types.ObjectId(String(userId));
      conversation = await ConversationModel.findOne({
        participants: { $all: [uid, supportOid] },
        name: 'Support',
      });
      if (!conversation) {
        conversation = new ConversationModel({
          participants: [uid, supportOid],
          name: 'Support',
          language: language || 'fr',
          messages: [],
        });
        await conversation.save();
        logger.info('[support] conversation created ' + String(conversation._id));
      }
    }

    logger.info('[support] conversation loaded ' + j({
      conversationId: String(conversation._id),
      lang: conversation.language || language || 'fr',
      messagesCount: conversation.messages?.length ?? 0
    }));

    // ---- 1) Sauvegarder le message utilisateur
    const beforeUserCount = conversation.messages?.length ?? 0;

    const senderId = userId
      ? new mongoose.Types.ObjectId(String(userId))
      : conversation.participants.find((p: any) => String(p) !== String(SUPPORT_USER_ID));

    const newMessage: IMessage = {
      sender: senderId,
      content,
      messageType: messageType || 'text',
      mediaUrl: mediaUrl || '',
      createdAt: new Date(),
      clientId,
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    const afterUserCount = conversation.messages?.length ?? 0;
    const savedMsg = conversation.messages[afterUserCount - 1];

    logger.info('[support] user-message saved ' + j({
      conversationId: String(conversation._id),
      before: beforeUserCount,
      after: afterUserCount,
      userMessageId: String((savedMsg as any)?._id),
      clientId
    }));

    // Diffusion WS (user) — simple et compatible Set/Array
    try {
      const roomKey = `conversation/${conversation._id}`;
      const payload = JSON.stringify({ topic: roomKey, message: savedMsg });
      let wsCount = 0;
      (rooms as any)?.[roomKey]?.forEach?.((client: any) => {
        wsCount++;
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      });
      logger.info('[support] ws user broadcast ' + j({ roomKey, wsCount }));
    } catch (e: any) {
      logger.error('[support] ws user broadcast failed ' + (e?.message || e));
    }

    // Notif push (user)
    notifyChatMessage(conversation, savedMsg).catch((e) =>
      logger.error('[support] push (user->support) failed ' + j({
        conversationId: String(conversation._id),
        messageId: String((savedMsg as any)?._id),
        error: e?.message
      }))
    );

    // ---- 2) Appeler l’agent IA
    try {
      logger.info('[support] agent call ' + j({
        url: AGENT_URL,
        conversationId: String(conversation._id),
        lastMessageId: String((savedMsg as any)?._id)
      }));

      const resp = await axios.post(
        AGENT_URL,
        {
          conversationId: String(conversation._id),
          lastMessageId: String((savedMsg as any)?._id),
          lastMessageText: savedMsg.content,
          language: language || conversation.language || 'fr',
          userId: String(senderId),
        },
        { timeout: 25000 }
      );

      logger.info('[support] agent response ' + j({
        status: resp?.status,
        action: resp?.data?.action,
        intent: resp?.data?.intent
      }));

      if (resp.data?.action === 'reply' && resp.data?.reply) {
        const beforeAuto = conversation.messages?.length ?? 0;

        const autoReply: IMessage = {
          sender: new mongoose.Types.ObjectId(String(SUPPORT_USER_ID)),
          content: resp.data.reply,
          messageType: 'text',
          createdAt: new Date(),
          clientId: '',
        };

        conversation.messages.push(autoReply);
        await conversation.save();

        const afterAuto = conversation.messages?.length ?? 0;
        const savedReply = conversation.messages[afterAuto - 1];

        logger.info('[support] auto-reply saved ' + j({
          conversationId: String(conversation._id),
          before: beforeAuto,
          after: afterAuto,
          autoReplyId: String((savedReply as any)?._id),
          replyPreview: String(resp.data.reply).slice(0, 120)
        }));

        // WS (auto)
        try {
          const roomKey = `conversation/${conversation._id}`;
          const replyPayload = JSON.stringify({ topic: roomKey, message: savedReply });
          let wsCount = 0;
          (rooms as any)?.[roomKey]?.forEach?.((client: any) => {
            wsCount++;
            if (client.readyState === WebSocket.OPEN) client.send(replyPayload);
          });
          logger.info('[support] ws auto broadcast ' + j({ roomKey, wsCount }));
        } catch (e: any) {
          logger.error('[support] ws auto broadcast failed ' + (e?.message || e));
        }

        // Push (auto)
        notifyChatMessage(conversation, savedReply).catch((e) =>
          logger.error('[support] push (support->user) failed ' + j({
            conversationId: String(conversation._id),
            messageId: String((savedReply as any)?._id),
            error: e?.message
          }))
        );
      } else if (resp.data?.action === 'escalate') {
        logger.warn('[support] agent escalate ' + String(conversation._id));
      } else {
        logger.info('[support] agent noop ' + String(conversation._id));
      }
    } catch (agentErr: any) {
      logger.error('[support] agent-call failed ' + j({
        url: 'http://host.docker.internal:9000/support/reply',
        status: agentErr?.response?.status,
        data: agentErr?.response?.data,
        code: agentErr?.code,          // ENOTFOUND / ECONNREFUSED / ETIMEDOUT
        message: agentErr?.message
      }));
      // on n'interrompt pas la réponse HTTP
    }

    logger.info('[support] addSupportMessage success ' + j({
      conversationId: String(conversation._id),
      userMessageId: String((savedMsg as any)?._id)
    }));

    return res.status(200).json(savedMsg);
  } catch (error: any) {
    logger.error('[support] addSupportMessage failed ' + j({
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    }));
    return res.status(500).json({ message: "Impossible d'ajouter le message Support" });
  }
};

/**
 * Récupérer toutes les conversations liées à un utilisateur (client ou pro)
 * Params :
 *  - type : "user" | "pro"
 *  - id   : string (userId)
 */
const getConversationsByUserTypeAndId = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { type, id } = req.params;

    if (!type || !id) {
      return res.status(400).json({
        message: "Paramètres requis : type (user|pro) et id",
      });
    }

    if (!["user", "pro"].includes(type)) {
      return res.status(400).json({
        message: "Type invalide (attendu : user ou pro)",
      });
    }

    // Construction dynamique du filtre
    const filter =
      type === "user"
        ? { "bookingRef.clientId": id }
        : { "bookingRef.userProId": id };

    const conversations = await ConversationModel.find(filter)
      .sort({ updatedAt: -1 }) // conversations les plus récentes en premier
      .populate({
        path: "participants",
        model: UserModel,
        select: "firstname lastname email",
      });

    logger.info({
      msg: "getConversationsByUserTypeAndId success",
      route: "GET /api/conversation/user/:type/:id",
      method: req.method,
      type,
      userId: id,
      count: conversations.length,
    });

    return res.status(200).json(conversations);
  } catch (error: any) {
    logger.error({
      msg: "getConversationsByUserTypeAndId failed",
      route: "GET /api/conversation/user/:type/:id",
      method: req.method,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({
      message: "Impossible de récupérer les conversations",
    });
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
  addSupportMessage,
  getConversationsByUserTypeAndId,
};
