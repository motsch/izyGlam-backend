import axios from "axios";
import * as express from "express";
import UserModel from "../models/user";
import { logger } from "../utils/logger";

import dotenv from "dotenv";
import PostModel from "../models/post";

dotenv.config();

const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;
const META_IG_ACCESS_TOKEN = process.env.META_IG_ACCESS_TOKEN;
const GRAPH_VERSION = "v17.0"; // ou v21.0 suivant ce que tu utilises

if (!INSTAGRAM_USER_ID || !META_IG_ACCESS_TOKEN) {
  throw new Error("Instagram config missing (INSTAGRAM_USER_ID or META_IG_ACCESS_TOKEN)");
}


const LINKEDIN_USER_ID = process.env.LINKEDIN_USER_ID; // identifiant perso (sans "urn:li:person:")
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN; // token OAuth généré côté LinkedIn

if (!LINKEDIN_USER_ID || !LINKEDIN_ACCESS_TOKEN) {
  throw new Error("LinkedIn config missing (LINKEDIN_USER_ID or LINKEDIN_ACCESS_TOKEN)");
}

// Publier sur LinkedIn
const postOnLinkedIn = async (req: express.Request, res: express.Response) => {
  logger.info({
    msg: "social.linkedin.post.start",
    route: req.originalUrl,
    method: req.method,
    userId: (req as any).user?.id,
  });

  try {
    const { content, postId } = req.body;

    if (!content) {
      return res.status(400).json({
        message: "content est obligatoire pour publier sur LinkedIn",
      });
    }

    if (!postId) {
      return res.status(400).json({
        message: "postId est obligatoire pour mettre à jour le statut",
      });
    }

    // ⚠️ Important : LinkedIn attend urn:li:member:<id>
    const authorUrn = `urn:li:member:${LINKEDIN_USER_ID}`;

    const payload = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE", // Pour l’instant, post texte
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const response = await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      payload,
      {
        headers: {
          Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    // Mettre à jour le statut du post en "send"
    await PostModel.findByIdAndUpdate(postId, { status: "send" });

    logger.info({
      msg: "social.linkedin.post.success",
      id: response.data?.id,
    });

    return res.status(200).json({
      message: "Post publié sur LinkedIn",
      data: response.data,
    });
  } catch (error: any) {
    logger.error({
      msg: "social.linkedin.post.error",
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });

    return res.status(500).json({
      message: "Erreur lors de la publication sur LinkedIn",
      error: error?.response?.data || error.message,
    });
  }
};


// Publier sur Instagram
const postOnInstagram = async (req: express.Request, res: express.Response) => {
  logger.info({
    msg: "social.instagram.post.start",
    route: req.originalUrl,
    method: req.method,
    userId: (req as any).user?.id,
  });
  console.log("FRANCIS 666666666 :")
  console.log(JSON.stringify(req.body))

  try {
    const { imageUrl, caption, postId, _id, id } = req.body;

    if (!imageUrl || !caption) {
      return res.status(400).json({
        message: "imageUrl et caption sont obligatoires",
      });
    }

    // On accepte postId, _id ou id
    const mongoPostId = postId || _id || id;

    if (!mongoPostId) {
      return res.status(400).json({
        message: "postId (ou _id) est obligatoire pour mettre à jour le statut",
      });
    }

    // 1. Créer le container
    const containerResponse = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${INSTAGRAM_USER_ID}/media`,
      {
        image_url: imageUrl,
        caption: caption,
        access_token: META_IG_ACCESS_TOKEN,
      }
    );

    const creationId = containerResponse.data?.id;

    if (!creationId) {
      logger.error({
        msg: "social.instagram.post.no_creation_id",
        data: containerResponse.data,
      });
      return res.status(500).json({
        message: "Impossible de créer le container média Instagram",
      });
    }

    // 2. Publier le container
    const publishResponse = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${INSTAGRAM_USER_ID}/media_publish`,
      {
        creation_id: creationId,
        access_token: META_IG_ACCESS_TOKEN,
      }
    );

    // 3. Mettre à jour le statut du post en "send"
    await PostModel.findByIdAndUpdate(mongoPostId, { status: "send" });

    logger.info({
      msg: "social.instagram.post.success",
      containerId: creationId,
      publishId: publishResponse.data?.id,
    });

    return res.status(200).json({
      message: "Post publié sur Instagram",
      data: publishResponse.data,
      containerId: creationId,
    });
  } catch (error: any) {
    logger.error({
      msg: "social.instagram.post.error",
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });

    return res.status(500).json({
      message: "Erreur lors de la publication sur Instagram",
      error: error?.response?.data || error.message,
    });
  }
};

// Publier sur TikTok
const postOnTikTok = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "social.tiktok.post.start", route: req.originalUrl, method: req.method });
  try {
    const { videoUrl, caption, accessToken } = req.body;
    const response = await axios.post(
      "https://open-api.tiktok.com/share/video/upload/",
      { video_url: videoUrl, caption: caption, access_token: accessToken }
    );
    logger.info({ msg: "social.tiktok.post.success", data: !!response.data });
    res.status(200).json({ message: "Vidéo publiée sur TikTok", data: response.data });
  } catch (error: any) {
    logger.error({
      msg: "social.tiktok.post.error",
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la publication sur TikTok" });
  }
};

// Publier sur Facebook
const postOnFacebook = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "social.facebook.post.start", route: req.originalUrl, method: req.method });
  try {
    const { message, accessToken } = req.body;
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.FACEBOOK_PAGE_ID}/feed`,
      { message: message, access_token: accessToken }
    );
    logger.info({ msg: "social.facebook.post.success", id: response.data?.id });
    res.status(200).json({ message: "Post publié sur Facebook", data: response.data });
  } catch (error: any) {
    logger.error({
      msg: "social.facebook.post.error",
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la publication sur Facebook" });
  }
};

// Récupérer les informations d'un post
const getPostInfo = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "social.post.info.start", route: req.originalUrl, method: req.method });
  const { platform, postId, accessToken } = req.body;
  let url = "";

  switch (platform) {
    case "LinkedIn":
      url = `https://api.linkedin.com/v2/ugcPosts/${postId}`;
      break;
    case "Instagram":
      url = `https://graph.facebook.com/v17.0/${postId}?fields=id,caption,media_type,media_url,like_count,comments_count,timestamp&access_token=${accessToken}`;
      break;
    case "TikTok":
      url = `https://open-api.tiktok.com/share/video/${postId}`;
      break;
    case "Facebook":
      url = `https://graph.facebook.com/v17.0/${postId}?fields=message,created_time,likes.summary(true),comments.summary(true)&access_token=${accessToken}`;
      break;
    default:
      logger.warn({ msg: "social.post.info.unsupported_platform", platform });
      return res.status(400).json({ message: "Plateforme non supportée" });
  }

  try {
    const response = await axios.get(url, {
      headers: platform === "LinkedIn" ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    logger.info({ msg: "social.post.info.success", platform, postId });
    res.status(200).json({ message: "Informations du post récupérées", data: response.data });
  } catch (error: any) {
    logger.error({
      msg: "social.post.info.error",
      platform,
      postId,
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });
  }
};

const connect = async (req: express.Request, res: express.Response) => {
  const platform = req.params.platform.toLowerCase();
  logger.info({ msg: "social.connect.start", platform, route: req.originalUrl, method: req.method });
  try {
    const code = req.body.code;
    const { userId } = req.body;
    const user = await UserModel.findById(userId);

    if (!user) {
      logger.warn({ msg: "social.connect.user_not_found", userId, platform });
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    let tokenData: any;

    switch (platform) {
      case 'facebook':
        tokenData = await exchangeFacebookToken(code, userId);
        user.facebook = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      case 'instagram':
        tokenData = await exchangeInstagramToken(code, userId);
        user.instagram = {
          accessToken: tokenData.accessToken,
          businessAccountId: tokenData.businessAccountId,
        };
        break;

      case 'linkedin':
        tokenData = await exchangeLinkedInToken(code, userId);
        user.linkedin = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      case 'bluesky':
        tokenData = await exchangeBlueskyToken(code, userId);
        user.bluesky = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      case 'tiktok':
        tokenData = await exchangeTikTokToken(code, userId);
        user.tiktok = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      default:
        logger.warn({ msg: "social.connect.unsupported_platform", platform });
        return res.status(400).json({ message: 'Plateforme non supportée.' });
    }

    await user.save();
    logger.info({ msg: "social.connect.success", platform, userId });
    res.json({ message: `${platform} connecté avec succès.`, user });
  } catch (error: any) {
    logger.error({
      msg: "social.connect.error",
      platform,
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });
    console.error(`Erreur lors de la connexion à ${platform} :`, error);
    res.status(500).json({
      message: `Erreur lors de la connexion à ${platform}.`,
      error: error.response?.data || error.message,
    });
  }
};

const exchangeFacebookToken = async (code: string, userId: string) => {
  logger.info({ msg: "social.facebook.exchangeToken.start", userId });
  try {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_REDIRECT_URI;

    if (!code) {
      throw new Error("Le code est manquant dans la requête.");
    }

    const tokenResponse = await axios.get('https://graph.facebook.com/v17.0/oauth/access_token', {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code },
    });

    if (!tokenResponse.data.access_token || !tokenResponse.data.expires_in) {
      throw new Error("Données du token Facebook invalides.");
    }

    const accessToken = tokenResponse.data.access_token;
    const tokenExpiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);

    const userInfoResponse = await axios.get('https://graph.facebook.com/v17.0/me', {
      params: { access_token: accessToken, fields: 'id,name,email' },
    });

    const { id: facebookUserId, name, email } = userInfoResponse.data;
    if (!facebookUserId || !name) {
      throw new Error("Impossible de récupérer les informations utilisateur depuis Facebook.");
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        "facebook.accessToken": accessToken,
        "facebook.tokenExpiresAt": tokenExpiresAt,
        "facebook.userId": facebookUserId,
        firstname: name.split(" ")[0],
        lastname: name.split(" ")[1] || "",
        email: email || "",
      },
      { new: true, upsert: true }
    );

    logger.info({ msg: "social.facebook.exchangeToken.success", userId, fbUserId: facebookUserId });
    return {
      message: "Utilisateur connecté avec succès.",
      user: updatedUser,
      accessToken,
      expires_in: tokenResponse.data.expires_in,
      userId: facebookUserId,
      tokenExpiresAt,
    };
  } catch (error: any) {
    logger.error({
      msg: "social.facebook.exchangeToken.error",
      userId,
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    console.error("Erreur lors de l'échange du code Facebook :", error.message);
    throw new Error(error.response?.data?.error?.message || "Erreur lors de l'échange du code Facebook.");
  }
};

const exchangeInstagramToken = async (code: string, userId: string) => {
  logger.info({ msg: "social.instagram.exchangeToken.start", userId });
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  const tokenResponse = await axios.get('https://api.instagram.com/oauth/access_token', {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    },
  });

  const accessToken = tokenResponse.data.access_token;

  const userInfoResponse = await axios.get('https://graph.instagram.com/me', {
    params: { access_token: accessToken, fields: 'id,username' },
  });

  const { id, username } = userInfoResponse.data;

  await UserModel.findByIdAndUpdate(userId, {
    instagram: {
      accessToken,
      businessAccountId: id,
    },
  });

  logger.info({ msg: "social.instagram.exchangeToken.success", userId, igId: id, username });
  return { accessToken, businessAccountId: id, username };
};

const exchangeLinkedInToken = async (code: string, userId: string) => {
  logger.info({ msg: "social.linkedin.exchangeToken.start", userId });
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
    params: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });

  const accessToken = tokenResponse.data.access_token;

  await UserModel.findByIdAndUpdate(userId, {
    linkedin: {
      accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
    },
  });

  logger.info({ msg: "social.linkedin.exchangeToken.success", userId });
  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
  };
};

const exchangeBlueskyToken = async (code: string, userId: string) => {
  logger.info({ msg: "social.bluesky.exchangeToken.start", userId });
  const clientId = process.env.BLUESKY_CLIENT_ID;
  const clientSecret = process.env.BLUESKY_CLIENT_SECRET;
  const redirectUri = process.env.BLUESKY_REDIRECT_URI;

  const tokenResponse = await axios.post('https://api.blueskyweb.xyz/oauth/token', {
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
  });

  const accessToken = tokenResponse.data.access_token;

  const userInfoResponse = await axios.get('https://api.blueskyweb.xyz/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { id, username } = userInfoResponse.data;

  await UserModel.findByIdAndUpdate(userId, {
    bluesky: {
      accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
      userId: id,
    },
  });

  logger.info({ msg: "social.bluesky.exchangeToken.success", userId, bskyId: id, username });
  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
    userId: id,
    username,
  };
};

const exchangeTikTokToken = async (code: string, userId: string) => {
  logger.info({ msg: "social.tiktok.exchangeToken.start", userId });
  const clientId = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token', {
    client_key: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const accessToken = tokenResponse.data.data.access_token;

  const userInfoResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { open_id, display_name } = userInfoResponse.data.data;

  await UserModel.findByIdAndUpdate(userId, {
    tiktok: {
      accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenResponse.data.data.expires_in * 1000),
      userId: open_id,
    },
  });

  logger.info({ msg: "social.tiktok.exchangeToken.success", userId, tiktokOpenId: open_id, display_name });
  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.data.data.expires_in * 1000),
    userId: open_id,
    displayName: display_name,
  };
};

const checkConnectionStatus = async (req: express.Request, res: express.Response) => {
  const platform = req.params.platform.toLowerCase();
  const userId = req.body.userId;
  logger.info({ msg: "social.status.start", platform, userId, route: req.originalUrl, method: req.method });
  try {
    const user = await UserModel.findById(userId);

    if (!user) {
      logger.warn({ msg: "social.status.user_not_found", platform, userId });
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    let isConnected = false;

    switch (platform) {
      case 'facebook':
        isConnected = !!user.facebook?.accessToken;
        break;
      case 'instagram':
        isConnected = !!user.instagram?.accessToken;
        break;
      case 'linkedin':
        isConnected = !!user.linkedin?.accessToken;
        break;
      case 'bluesky':
        isConnected = !!user.bluesky?.accessToken;
        break;
      case 'tiktok':
        isConnected = !!user.tiktok?.accessToken;
        break;
      default:
        logger.warn({ msg: "social.status.unsupported_platform", platform });
        return res.status(400).json({ message: 'Plateforme non supportée.' });
    }

    logger.info({ msg: "social.status.success", platform, userId, isConnected });
    res.json({ platform, isConnected });
  } catch (error: any) {
    logger.error({
      msg: "social.status.error",
      platform,
      userId,
      errorMessage: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      route: req.originalUrl,
      method: req.method,
    });
    console.error(`Erreur lors de la vérification de connexion à ${platform} :`, error);
    res.status(500).json({
      message: `Erreur lors de la vérification de connexion à ${platform}.`,
      error: error.response?.data || error.message,
    });
  }
};

// Export des fonctions
module.exports = {
  postOnLinkedIn,
  postOnInstagram,
  postOnTikTok,
  postOnFacebook,
  getPostInfo,
  connect,
  checkConnectionStatus,
};
