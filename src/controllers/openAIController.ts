import axios from "axios";
import https from "https";
import * as express from "express";

// Fonction pour gérer la requête et réponse d'OpenAI
const getChatResponse = async (req: express.Request, res: express.Response) => {
  
    try {
        const prompt = req.body.prompt;
    
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 150,
            temperature: 0.7,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // Remplace ici par ta clé correcte
            }
          }
        );
    
        res.status(200).json({ message: response.data.choices[0].message.content });
      } catch (error:any) {
        console.error(error.response ? error.response.data : error.message); // Log plus précis
        res.status(500).json({ message: 'Erreur lors de la communication avec OpenAI' });
      }
};

module.exports = {
  getChatResponse,
};
