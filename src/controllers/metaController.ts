import axios from "axios";
import { Request, Response } from "express";
import UserModel from "../models/user";
const jwt = require("jsonwebtoken");

// Fonction pour obtenir un token d'accès
export const getAccessToken = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.META_APP_ID as string;
    const clientSecret = process.env.META_APP_SECRET as string;
    const redirectUri = process.env.META_REDIRECT_URI as string;
    const code = req.body.code; // Code reçu après l'autorisation utilisateur

    const response = await axios.get(`https://graph.facebook.com/v17.0/oauth/access_token`, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const accessToken = response.data.access_token;
    const tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);

    res.json({ accessToken, tokenExpiresAt });
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la récupération du token",
      error: error.response?.data || error.message,
    });
  }
};

// Fonction pour publier un post sur Facebook
export const publishFacebookPost = async (req: Request, res: Response) => {
  try {
    const { pageId, message } = req.body;
    const accessToken = req.headers.authorization?.split(" ")[1]; // Bearer Token

    if (!accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${pageId}/feed`,
      { message },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la publication sur Facebook",
      error: error.response?.data || error.message,
    });
  }
};

// Fonction pour publier un post sur Instagram
export const publishInstagramPost = async (req: Request, res: Response) => {
  try {
    const { instagramAccountId, imageUrl, caption } = req.body;
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    // Étape 1 : Télécharger l'image
    const mediaResponse = await axios.post(
      `https://graph.facebook.com/v17.0/${instagramAccountId}/media`,
      { image_url: imageUrl, caption },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Étape 2 : Publier l'image téléchargée
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v17.0/${instagramAccountId}/media_publish`,
      { creation_id: mediaResponse.data.id },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(publishResponse.data);
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la publication sur Instagram",
      error: error.response?.data || error.message,
    });
  }
};

// Fonction pour récupérer les publications existantes
export const getPosts = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    const response = await axios.get(`https://graph.facebook.com/v17.0/${accountId}/media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la récupération des publications",
      error: error.response?.data || error.message,
    });
  }
};

export const validateAndRenewToken = async (req: Request, res: Response) => {
  try {
    const accessToken = req.body.accessToken;

    if (!accessToken) {
      return res.status(400).json({ message: "Token d'accès manquant." });
    }

    // Vérification du token
    const response = await axios.get(`https://graph.facebook.com/debug_token`, {
      params: {
        input_token: accessToken,
        access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
      },
    });

    const isValid = response.data.data.is_valid;

    // Si le token n'est pas valide, tenter de le renouveler
    if (!isValid) {
      const renewedResponse = await axios.get(`https://graph.facebook.com/v17.0/oauth/access_token`, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: accessToken,
        },
      });

      const newAccessToken = renewedResponse.data.access_token;
      const tokenExpiresAt = new Date(Date.now() + renewedResponse.data.expires_in * 1000);

      return res.json({
        message: "Token renouvelé avec succès.",
        newAccessToken,
        tokenExpiresAt,
      });
    }

    res.json({
      message: "Token valide.",
    });
  } catch (error: any) {
    console.error("Erreur lors de la validation ou du renouvellement du token :", error);
    res.status(500).json({
      message: "Erreur lors de la validation ou du renouvellement du token.",
      error: error.response?.data || error.message,
    });
  }
};

export const exchangeForLongLivedToken = async (req: Request, res: Response) => {
  try {
    const accessToken = req.body.accessToken;

    if (!accessToken) {
      return res.status(400).json({ message: "Token d'accès court manquant." });
    }

    const response = await axios.get(`https://graph.facebook.com/v17.0/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: accessToken,
      },
    });

    const longLivedToken = response.data.access_token;
    const tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);

    res.json({ longLivedToken, tokenExpiresAt });
  } catch (error: any) {
    console.error("Erreur lors de l'extension du token :", error);
    res.status(500).json({
      message: "Erreur lors de l'extension du token.",
      error: error.response?.data || error.message,
    });
  }
};

// Fonction pour échanger le code contre un token et mettre à jour ou créer l'utilisateur
export const exchangeCodeForToken = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.META_APP_ID as string;
    const clientSecret = process.env.META_APP_SECRET as string;
    const redirectUri = process.env.META_REDIRECT_URI as string;
    const code = req.body.code;

    if (!code) {
      return res.status(400).json({ message: "Code manquant dans la requête." });
    }

    // Échange du code contre un access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v17.0/oauth/access_token', {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    if (!tokenResponse.data.access_token || !tokenResponse.data.expires_in) {
      return res.status(500).json({ message: "Données du token invalides." });
    }

    const accessToken = tokenResponse.data.access_token;
    const expiresIn = tokenResponse.data.expires_in;

    // ⚠️ NE PAS MODIFIER L’UTILISATEUR ICI

    // Répondre simplement avec le token pour que `facebook-login` gère la suite
    res.json({
      message: "AccessToken récupéré avec succès",
      accessToken,
      expires_in: expiresIn,
    });
  } catch (error: any) {
    console.error("Erreur lors de l'échange du code :", error);
    res.status(500).json({
      message: "Erreur lors de l'échange du code.",
      error: error.response?.data || error.message,
    });
  }
};

// Fonction pour valider le token d'accès
export const validateAccessToken = async (req: Request, res: Response) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    const response = await axios.get(`https://graph.facebook.com/debug_token`, {
      params: {
        input_token: accessToken,
        access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
      },
    });

    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({
      message: "Erreur lors de la validation du token",
      error: error.response?.data || error.message,
    });
  }
};
