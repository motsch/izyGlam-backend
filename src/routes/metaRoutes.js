const express = require('express');
const metaController = require('../controllers/metaController');
const authMiddleware = require("../middlewares/authMiddleware");
const facebookTokenMiddleware = require('../middlewares/facebookTokenMiddleware');

const router = express.Router();

// Route pour obtenir un token d'accès Meta
router.post("/meta/getAccessToken", metaController.getAccessToken);

// Route pour publier un post sur Facebook
router.post("/meta/publishFacebookPost", authMiddleware,facebookTokenMiddleware, metaController.publishFacebookPost);

// Route pour publier un post sur Instagram
router.post("/meta/publishInstagramPost", authMiddleware,facebookTokenMiddleware, metaController.publishInstagramPost);

// Route pour vérifier les publications
router.get("/meta/posts", authMiddleware,facebookTokenMiddleware, metaController.getPosts);

// Nouvelle route : Vérification de l'état du token
router.get("/meta/validateToken", authMiddleware,facebookTokenMiddleware, metaController.validateAccessToken);
router.post("/meta/exchangeCode", metaController.exchangeCodeForToken);


// Route pour gérer le callback de Facebook
router.get("/meta/callback", async (req, res) => {
    try {
        console.log('in callback !!')
      const code = req.query.code; // Le code envoyé par Facebook dans l'URL
  
      if (!code) {
        return res.status(400).json({ message: "Code manquant dans la requête." });
      }
  
      // Tu peux rediriger l'utilisateur ou afficher un message
      res.status(200).json({ message: "Code reçu avec succès", code });
    } catch (error) {
      res.status(500).json({ message: "Erreur lors du traitement du callback", error });
    }
  });
  

router.post("/meta/exchange-code", metaController.exchangeForLongLivedToken);
router.post("/meta/validate-token", metaController.validateAndRenewToken);

  module.exports = router;
