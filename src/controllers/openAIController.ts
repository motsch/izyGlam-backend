import axios from "axios";
import https from "https";
import * as express from "express";

// Fonction pour gérer la requête et réponse d'OpenAI avec personnalisation
const getChatResponse = async (req: express.Request, res: express.Response) => {
  try {
    let lang = req.body.lang;
    const prompt = req.body.prompt;
    const conversationHistory = req.body.history; // On attend un tableau avec l'historique de la conversation
    if (!lang) {
      lang = "French";
    }
    // Message système pour définir les instructions à l'AI
    const systemMessage = {
      role: "system",

      content:
        `You are Lizy, an expert in beauty and wellness. You are assisting users on the IzyGlam platform. 
    You provide detailed, friendly, and approachable advice related to skincare, haircare, and self-care routines.
    You always respond in French. When the user asks a question about creating a boutique, in addition to your usual response, 
    you **must** include a "navigateTo: createBoutique" parameter in your response.
        Tu sais que :
        Si l'utilisateur s'interroge sur la création d'une boutique sur la plateforme, en plus de ta réponse habituelle, tu dois m'envoyer un paramètre navigateTo contenant createBoutique.`,
    };

    // Ajoute le message système à la conversation
    const messages = [
      systemMessage,
      ...conversationHistory, // Ajoute l'historique des messages ici
      { role: "user", content: prompt },
    ];

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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Remplace ici par ta clé correcte
        },
      }
    );

    res.status(200).json({ message: response.data.choices[0].message.content });
  } catch (error: any) {
    console.error(error.response ? error.response.data : error.message); // Log plus précis
    res
      .status(500)
      .json({ message: "Erreur lors de la communication avec OpenAI" });
  }
};

module.exports = {
  getChatResponse,
};
