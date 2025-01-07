const axios = require('axios');
const UserModel = require('../models/user');
require('dotenv').config();

const facebookTokenMiddleware = async (req, res, next) => {
  const userId = req.userId; // Récupéré depuis le middleware authMiddleware

  try {
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const { accessToken, tokenExpiresAt } = user.facebook || {};

    // Vérifier si le token Facebook est expiré
    if (accessToken && tokenExpiresAt && new Date() >= new Date(tokenExpiresAt)) {
      console.log('Token Facebook expiré, tentative de renouvellement...');
      const renewedResponse = await axios.get(`https://graph.facebook.com/v17.0/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: accessToken,
        },
      });

      const newAccessToken = renewedResponse.data.access_token;
      const newTokenExpiresAt = new Date(Date.now() + renewedResponse.data.expires_in * 1000);

      // Mise à jour du token dans la base de données
      await UserModel.findByIdAndUpdate(userId, {
        'facebook.accessToken': newAccessToken,
        'facebook.tokenExpiresAt': newTokenExpiresAt,
      });

      console.log('Token Facebook renouvelé avec succès');
      req.headers.authorization = `Bearer ${newAccessToken}`;
    }

    next();
  } catch (error) {
    console.error('Erreur lors de la gestion du token Facebook :', error);
    res.status(500).json({ message: 'Erreur lors de la gestion du token Facebook.' });
  }
};

module.exports = facebookTokenMiddleware;
