import axios from "axios";
import * as express from "express";
import UserModel from "../models/user";
// Publier sur LinkedIn
const postOnLinkedIn = async (req: express.Request, res: express.Response) => {
  try {
    const { content, accessToken } = req.body;
    const response = await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      {
        author: `urn:li:person:${process.env.LINKEDIN_USER_ID}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: content },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    res.status(200).json({ message: "Post publié sur LinkedIn", data: response.data });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la publication sur LinkedIn" });
  }
};

// Publier sur Instagram
const postOnInstagram = async (req: express.Request, res: express.Response) => {
  try {
    const { imageUrl, caption, accessToken } = req.body;
    const containerResponse = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.INSTAGRAM_USER_ID}/media`,
      { image_url: imageUrl, caption: caption, access_token: accessToken }
    );
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.INSTAGRAM_USER_ID}/media_publish`,
      { creation_id: containerResponse.data.id, access_token: accessToken }
    );
    res.status(200).json({ message: "Post publié sur Instagram", data: response.data });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la publication sur Instagram" });
  }
};

// Publier sur TikTok
const postOnTikTok = async (req: express.Request, res: express.Response) => {
  try {
    const { videoUrl, caption, accessToken } = req.body;
    const response = await axios.post(
      "https://open-api.tiktok.com/share/video/upload/",
      { video_url: videoUrl, caption: caption, access_token: accessToken }
    );
    res.status(200).json({ message: "Vidéo publiée sur TikTok", data: response.data });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la publication sur TikTok" });
  }
};

// Publier sur Facebook
const postOnFacebook = async (req: express.Request, res: express.Response) => {
  try {
    const { message, accessToken } = req.body;
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.FACEBOOK_PAGE_ID}/feed`,
      { message: message, access_token: accessToken }
    );
    res.status(200).json({ message: "Post publié sur Facebook", data: response.data });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la publication sur Facebook" });
  }
};

// Récupérer les informations d'un post
const getPostInfo = async (req: express.Request, res: express.Response) => {
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
      return res.status(400).json({ message: "Plateforme non supportée" });
  }

  try {
    const response = await axios.get(url);
    res.status(200).json({ message: "Informations du post récupérées", data: response.data });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la récupération des informations du post" });
  }
};

const connect = async (req: express.Request, res: express.Response) => {
  const platform = req.params.platform.toLowerCase();
  try {
    const  code  = req.body.code;
    const { userId } = req.body;
    const user = await UserModel.findById(userId);
    console.log(code)
    console.log(platform)
    console.log(userId)
    console.log(user)

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    let tokenData:any;

    switch (platform) {
      case 'facebook':
        console.log('in facebook')
        tokenData = await exchangeFacebookToken(code, userId);
        user.facebook = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      case 'instagram':
        console.log('in instagram')
        tokenData = await exchangeInstagramToken(code, userId);
        user.instagram = {
          accessToken: tokenData.accessToken,
          businessAccountId: tokenData.businessAccountId,
        };
        break;

      case 'linkedin':
        console.log('in linkedIn')
        tokenData = await exchangeLinkedInToken(code, userId);
        user.linkedin = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      case 'bluesky':
        console.log('in bluesky')
        tokenData = await exchangeBlueskyToken(code, userId);
        user.bluesky = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      case 'tiktok':
        console.log('in tiktok')
        tokenData = await exchangeTikTokToken(code, userId);
        user.tiktok = {
          accessToken: tokenData.accessToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          userId: tokenData.userId,
        };
        break;

      default:
        return res.status(400).json({ message: 'Plateforme non supportée.' });
    }

    await user.save();
    res.json({ message: `${platform} connecté avec succès.`, user });
  } catch (error: any) {
    console.error(`Erreur lors de la connexion à ${platform} :`, error);
    res.status(500).json({
      message: `Erreur lors de la connexion à ${platform}.`,
      error: error.response?.data || error.message,
    });
  }
};

const exchangeFacebookToken = async (code: string, userId: string) => {
  try {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_REDIRECT_URI;

    if (!code) {
      throw new Error("Le code est manquant dans la requête.");
    }

    // Échange du code contre un token d'accès
    const tokenResponse = await axios.get('https://graph.facebook.com/v17.0/oauth/access_token', {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    // Validation des données du token
    if (!tokenResponse.data.access_token || !tokenResponse.data.expires_in) {
      throw new Error("Données du token Facebook invalides.");
    }

    const accessToken = tokenResponse.data.access_token;
    const tokenExpiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);

    // Récupération des informations utilisateur depuis Facebook
    const userInfoResponse = await axios.get('https://graph.facebook.com/v17.0/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email',
      },
    });

    const { id: facebookUserId, name, email } = userInfoResponse.data;

    if (!facebookUserId || !name) {
      throw new Error("Impossible de récupérer les informations utilisateur depuis Facebook.");
    }

    // Mise à jour ou création de l'utilisateur dans la base de données
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
      { new: true, upsert: true } // Met à jour ou crée l'utilisateur si inexistant
    );

    return {
      message: "Utilisateur connecté avec succès.",
      user: updatedUser,
      accessToken,
      expires_in: tokenResponse.data.expires_in,
    };
  } catch (error: any) {
    console.error("Erreur lors de l'échange du code Facebook :", error.message);

    throw new Error(
      error.response?.data?.error?.message || "Erreur lors de l'échange du code Facebook."
    );
  }
};


const exchangeInstagramToken = async (code: string, userId: string) => {
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

  // Récupérer les infos utilisateur Instagram
  const userInfoResponse = await axios.get('https://graph.instagram.com/me', {
    params: {
      access_token: accessToken,
      fields: 'id,username',
    },
  });

  const { id, username } = userInfoResponse.data;

  // Mettre à jour l'utilisateur dans la base de données
  await UserModel.findByIdAndUpdate(userId, {
    instagram: {
      accessToken,
      businessAccountId: id,
    },
  });

  return {
    accessToken,
    businessAccountId: id,
    username,
  };
};

const exchangeLinkedInToken = async (code: string, userId: string) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  // Échange du code pour un token d'accès
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

  // Stocker le token dans la base de données
  await UserModel.findByIdAndUpdate(userId, {
    linkedin: {
      accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000), // Expiration du token
    },
  });

  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
  };
};



const exchangeBlueskyToken = async (code: string, userId: string) => {
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

  // Récupérer les infos utilisateur Bluesky
  const userInfoResponse = await axios.get('https://api.blueskyweb.xyz/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const { id, username } = userInfoResponse.data;

  // Mettre à jour l'utilisateur dans la base de données
  await UserModel.findByIdAndUpdate(userId, {
    bluesky: {
      accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
      userId: id,
    },
  });

  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
    userId: id,
    username,
  };
};

const exchangeTikTokToken = async (code: string, userId: string) => {
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

  // Récupérer les infos utilisateur TikTok
  const userInfoResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const { open_id, display_name } = userInfoResponse.data.data;

  // Mettre à jour l'utilisateur dans la base de données
  await UserModel.findByIdAndUpdate(userId, {
    tiktok: {
      accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenResponse.data.data.expires_in * 1000),
      userId: open_id,
    },
  });

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

  try {
    const user = await UserModel.findById(userId);

    if (!user) {
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
        return res.status(400).json({ message: 'Plateforme non supportée.' });
    }

    res.json({ platform, isConnected });
  } catch (error: any) {
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
