const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require('path');
import fs from 'fs';
import CityModel from "./models/city";
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import ConversationModel from './models/conversation';
import AdvertisementModel from './models/advertisement';
import ShopModel from './models/shop';
import { seedDatabase } from './seeds/seeder';
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(cors());

// Point d'entrée de l'API
app.get("/", (req: any, res: any) => {
  res.send("Bienvenue sur l'API de mon application.");
});

// Routes
const bookingRoutes = require("./routes/bookingRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const serviceTemplateRoutes = require("./routes/serviceTemplateRoutes");
const shopRoutes = require("./routes/shopRoutes");
const userRoutes = require("./routes/userRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const companyRoutes = require("./routes/companyRoutes");
const categoryRoutes = require('./routes/categoryRoutes');
const colorRoutes = require('./routes/colorRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const imageRoutes = require('./routes/imageRoutes');
const openAIRoutes = require('./routes/openAIRoutes');
const profileRoutes = require('./routes/profileRoutes');
const socialMediaRoutes = require('./routes/socialMediaRoutes');
const postRoutes = require('./routes/postRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const planRoutes = require('./routes/planRoutes');
const tipsRoutes = require("./routes/tipsRoutes");
const vpnCheckerRoutes = require('./routes/vpnCheckerRoutes');
const metaRoutes = require('./routes/metaRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const kpiRoutes = require('./routes/kpiRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const financialRoutes = require('./routes/financialRoutes');
const villeRoutes = require('./routes/villeRoutes');
const languageRoutes = require('./routes/languageRoutes');
const advertisementRoutes = require('./routes/advertisementRoutes');
const adParkRoutes = require("./routes/adParkRoutes");
const cityRoutes = require("./routes/cityRoutes");
const subscriptionRoutes = require("./routes/subscription");

// Utilisation des routes OpenAI dans l'application
app.use("/api", bookingRoutes);
app.use("/api", advertisementRoutes);
app.use("/api", serviceRoutes);
app.use("/api", serviceTemplateRoutes);
app.use("/api", shopRoutes);
app.use("/api", userRoutes);
app.use("/api", scheduleRoutes);
app.use("/api", companyRoutes);
app.use('/api', categoryRoutes);
app.use('/api', colorRoutes);
app.use('/api', adminSettingsRoutes);
app.use('/api', imageRoutes);
app.use('/api', openAIRoutes);
app.use('/api', kpiRoutes);
app.use('/api', transactionRoutes);
app.use('/api', financialRoutes);
app.use('/api', profileRoutes);
app.use('/api', socialMediaRoutes);
app.use('/api', postRoutes);
app.use('/api', suggestionRoutes);
app.use('/api', conversationRoutes);
app.use('/api', planRoutes);
app.use("/api", tipsRoutes);
app.use('/api', vpnCheckerRoutes);
app.use('/api', metaRoutes);
app.use('/api', stripeRoutes);
app.use("/api", villeRoutes);
app.use("/api", languageRoutes);
app.use("/api", adParkRoutes);
app.use("/api", cityRoutes);
app.use("/api", subscriptionRoutes);

// Middleware pour servir les fichiers statiques dans le dossier 'uploads'
app.use('/uploads/images', express.static(path.join(__dirname, '../uploads/images')));

// Créer le serveur HTTP basé sur Express
const server = http.createServer(app);

// Initialisation des files d'attente
const pubImpressionQueue: { pubId: string; count: number }[] = [];
const shopImpressionQueue: { shopId: string; count: number }[] = [];
const pubClickQueue: { pubId: string; count: number }[] = [];
const shopClickQueue: { shopId: string; count: number }[] = [];

// Fonction pour stocker les impressions en mémoire
async function handleMessage(topic: string, message: Buffer) {
  if (topic === 'pub/impression') {
    try {
      const { pubId } = JSON.parse(message.toString());

      // Vérifie si la pub est déjà dans la file
      const existing = pubImpressionQueue.find((item) => item.pubId === pubId);
      if (existing) {
        existing.count += 1;
      } else {
        pubImpressionQueue.push({ pubId, count: 1 });
      }
    } catch (error) {
      console.error('❌ Erreur parsing WebSocket message:', error);
    }
  } else if (topic === 'shop/impression') {
    try {
      const { shopId } = JSON.parse(message.toString());

      // Vérifie si la pub est déjà dans la file
      const existing = shopImpressionQueue.find((item) => item.shopId === shopId);
      if (existing) {
        existing.count += 1;
      } else {
        shopImpressionQueue.push({ shopId, count: 1 });
      }
    } catch (error) {
      console.error('❌ Erreur parsing WebSocket message:', error);
    }
  } else if (topic === 'pub/click') {
    try {
      const { pubId } = JSON.parse(message.toString());
      // Vérifie si la pub est déjà dans le buffer
      const existing = pubClickQueue.find((item) => item.pubId === pubId);
      if (existing) {
        existing.count += 1;
      } else {
        pubClickQueue.push({ pubId, count: 1 });
      }
    } catch (error) {
      console.error('❌ Erreur parsing WebSocket message:', error);
    }
  } else if (topic === 'shop/click') {
    try {
      const { shopId } = JSON.parse(message.toString());
      // Vérifie si la pub est déjà dans le buffer
      const existing = shopClickQueue.find((item) => item.shopId === shopId);
      if (existing) {
        existing.count += 1;
      } else {
        shopClickQueue.push({ shopId, count: 1 });
      }
    } catch (error) {
      console.error('❌ Erreur parsing WebSocket message:', error);
    }
  } else if (topic.startsWith('conversation/') && topic.endsWith('/new')) {
    const parts = topic.split('/');
    const conversationId = parts[1];
    try {
      const msg = JSON.parse(message.toString());
      const conversation = await ConversationModel.findById(conversationId);
      if (!conversation) {
        console.warn(`❌ Conversation non trouvée: ${conversationId}`);
        return;
      }
      conversation.messages.push({
        sender: msg.sender,
        content: msg.content,
        messageType: msg.messageType || 'text',
        createdAt: new Date(),
      });
      await conversation.save();
      // Broadcast aux abonnés du topic conversation/{id}
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ topic: `conversation/${conversationId}`, message: conversation.messages }));
        }
      });
      console.log(`💬 Nouveau message publié dans conversation/${conversationId}`);
    } catch (error) {
      console.error('❌ Erreur traitement message de conversation:', error);
    }
  } else if (topic === "pub/temps_impression") {
    try {
      const msg = JSON.parse(message.toString());
      const { advertisementId, duree } = msg;
      if (!advertisementId || typeof duree !== "number") {
        console.warn("❌ Données invalides pour 'pub/temps_impression'", msg);
        return;
      }
      const pub = await AdvertisementModel.findById(advertisementId);
      if (!pub) {
        console.warn(`❌ Publicité non trouvée: ${advertisementId}`);
        return;
      }
      pub.temps_affichage_total += duree;
      pub.nombre_affichages_valides += 1;
      await pub.save();
      console.log(`📈 Publicité ${advertisementId} mise à jour : +${duree}s d'affichage`);
      // Si tu veux notifier d'autres clients WebSocket de la mise à jour :
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            topic: `pub/${advertisementId}/updated`,
            message: {
              advertisementId,
              temps_affichage_total: pub.temps_affichage_total,
              nombre_affichages_valides: pub.nombre_affichages_valides,
              temps_affichage_moyen: pub.temps_affichage_moyen // via le virtual
            }
          }));
        }
      });
    } catch (error) {
      console.error("❌ Erreur traitement 'pub/temps_impression':", error);
    }
  } else if (topic === "shop/display") {
    try {
      const msg = JSON.parse(message.toString());
      const { _id, timeSpent } = msg;

      if (!_id || typeof timeSpent !== "number") {
        console.warn("❌ Données invalides pour 'shop/display'", msg);
        return;
      }

      const shop = await ShopModel.findById(_id);
      if (!shop) {
        console.warn(`❌ Shop non trouvé: ${_id}`);
        return;
      }

      // Mise à jour des stats d'affichage
      shop.temps_affichage_total += timeSpent;
      shop.nombre_affichages_valides += 1;
      shop.temps_affichage_moyen =
        shop.temps_affichage_total / shop.nombre_affichages_valides;

      await shop.save();

      console.log(`📊 Shop ${_id} mis à jour : +${timeSpent}s d'affichage`);

      // Notification WebSocket
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            topic: `shop/${_id}/updated`,
            message: {
              _id,
              temps_affichage_total: shop.temps_affichage_total,
              nombre_affichages_valides: shop.nombre_affichages_valides,
              temps_affichage_moyen: shop.temps_affichage_moyen
            }
          }));
        }
      });

    } catch (error) {
      console.error("❌ Erreur traitement 'shop/display':", error);
    }
  }


}

// Créer le serveur WebSocket
const wss = new WebSocketServer({ server });

// Gérer les connexions WebSocket
wss.on('connection', (ws) => {
  console.log('🧠 Nouvelle connexion WebSocket');
  ws.on('message', async (message: any) => {
    console.log(`📩 Message reçu : ${message}`);
    try {
      const parsedMessage = JSON.parse(message);
      const { topic, message: msg } = parsedMessage;
      await handleMessage(topic, Buffer.from(msg));
      // Tu peux envoyer une réponse
      ws.send(`Echo : ${message}`);
    } catch (error) {
      console.error('❌ Erreur parsing WebSocket message:', error);
      ws.send('❌ Erreur lors du traitement du message');
    }
  });
  ws.send('👋 Bienvenue sur le WebSocket Server !');
});

// Connexion à la base de données
mongoose
  .connect(
    "mongodb+srv://fmotsch:Fr%40ncis2018%21@cluster0.dzdgnj3.mongodb.net/devfreelance",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(async () => {
    // Appel du seed
    await seedDatabase();
    await seedCities();
    console.log("Connexion à la base de données réussie");
  })
  .catch((err: any) => {
    console.error("Erreur de connexion à la base de données :", err.message);
    process.exit(1);
  });

// Démarrer le serveur HTTP (et donc WS aussi)
server.listen(port, () => {
  console.log(`✅ Serveur HTTP + WebSocket démarré sur http://localhost:${port}`);
});

const seedCities = async () => {
  const count = await CityModel.countDocuments();
  if (count > 0) return;

  console.log("Initialisation des villes...");

  const filePath = path.join(__dirname, "./data/villes-france.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data } = JSON.parse(raw);

  const formattedCities = data.map((v: any) => ({
    code_insee: v.code_insee,
    nom: v.nom_standard,
    code_postal: v.code_postal,
    dep_nom: v.dep_nom,
    reg_nom: v.reg_nom,
    pays: "France",
    latitude: parseFloat(v.latitude_mairie),
    longitude: parseFloat(v.longitude_mairie),
  }));

  await CityModel.insertMany(formattedCities);
  console.log(`✅ ${formattedCities.length} villes importées avec coordonnées`);
};
