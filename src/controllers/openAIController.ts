import axios from "axios";
import { logger } from "../utils/logger";
import * as express from "express";

// Fonction pour gérer la requête et réponse d'OpenAI avec personnalisation
const getChatResponse = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    let lang = req.body.lang;
    const prompt = req.body.prompt;
    const conversationHistory = Array.isArray(req.body.history) ? req.body.history : []; // garde-fou discret

    if (!lang) {
      lang = "French";
    }

    // Message système pour définir les instructions à l'AI
    const systemMessage = {
      role: "system",
      content: `You are Lizy, an expert in beauty and wellness. You are assisting users on the IzyGlam platform. 
    You provide detailed, friendly, and approachable advice related to skincare, haircare, and self-care routines.
    You always respond in French. When the user asks a question about creating a boutique, in addition to your usual response, 
    you **must** include a "navigateTo: createBoutique" parameter in your response.
        Tu sais que :
        Si l'utilisateur s'interroge sur la création d'une boutique sur la plateforme, en plus de ta réponse habituelle, tu dois m'envoyer un paramètre navigateTo contenant createBoutique.`,
    };

    // Ajoute le message système à la conversation
    const messages = [
      systemMessage,
      ...conversationHistory, // historique
      { role: "user", content: prompt },
    ];

    logger.info({
      msg: "openai.chat.request",
      route: "POST /api/openai/chat",
      method: req.method,
      url: req.originalUrl,
      lang,
      historyLen: conversationHistory.length || 0,
      hasPrompt: !!prompt,
    });

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: messages, // Envoi de la conversation en cours
        max_tokens: 150,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // ne pas logger la clé
        },
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content ?? "";

    logger.info({
      msg: "openai.chat.success",
      route: "POST /api/openai/chat",
      method: req.method,
      url: req.originalUrl,
      durationMs: Date.now() - t0,
      hasContent: !!content,
    });

    res.status(200).json({ message: content });
  } catch (error: any) {
    // console.error conservé pour ta console locale si utile
    console.error(error?.response ? error.response.data : error?.message);

    logger.error({
      msg: "openai.chat.error",
      route: "POST /api/openai/chat",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      queryKeys: Object.keys(req.query || {}),
      bodyKeys: Object.keys(req.body || {}),
      errorName: error?.name,
      errorMessage: error?.message,
      providerData: error?.response?.data, // payload provider utile au debug
      durationMs: Date.now() - t0,
      stack: error?.stack,
    });

    res.status(500).json({ message: "Erreur lors de la communication avec OpenAI" });
  }
};

module.exports = {
  getChatResponse,
};
