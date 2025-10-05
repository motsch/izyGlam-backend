const express = require('express');
const router = express.Router();
const openAIController = require('../controllers/openAIController');

// Route pour envoyer un message à ChatGPT et recevoir une réponse
router.post('/openai/chat', openAIController.getChatResponse);

module.exports = router;
