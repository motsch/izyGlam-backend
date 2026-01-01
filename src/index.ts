// import helmet from "helmet";
const helmet = require("helmet");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require('path');
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";



require('dotenv').config();
import fs from 'fs';
import CityModel from "./models/city";
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import ConversationModel from './models/conversation';
import { seedDatabase } from './seeds/seeder';
import "./cron/b2bLeadImport.cron";
import "./cron/proLeadImport.cron";
import { startB2BDripCron } from "./cron/b2bDripCron";
import sitemapRouter from './routes/sitemap';
import { scheduleWeeklyPayouts } from './cron/weeklyPayoutJob';
import { Request, Response, NextFunction } from "express";
import { startShopStatsCron } from "./cron/shopStats.cron";


const app = express();
app.set("trust proxy", 1);

const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use('/', sitemapRouter);
// Point d'entrée de l'API
app.get("/", (req: any, res: any) => {
  res.send("Bienvenue sur l'API de mon application.");
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // <-- IMPORTANT pour tes images
}));

// limite les attaques par gros JSON / form flood
const bigJson = express.json({ limit: "20mb" });
const bigUrl = express.urlencoded({ extended: true, limit: "20mb" });

const smallJson = express.json({ limit: "500kb" });
const smallUrl = express.urlencoded({ extended: true, limit: "500kb" });

// ⚠️ routes “probables” d’images/docs (pour ne pas casser l’existant)
const BIG_BODY_PATHS = [
  "/uploads",
  "/api/upload",
  "/api/uploads",
  "/api/image",
  "/api/images",
  "/api/avatar",
  "/api/photo",
  "/api/photos",
  "/api/document",
  "/api/documents",
  "/api/docs",
];

app.use(BIG_BODY_PATHS, bigJson, bigUrl);
app.use(smallJson);
app.use(smallUrl);

// Limite “générale” API
const apiLimiter = rateLimit({
  windowMs: 60_000,      // 1 min
  max: 120,              // 120 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// Ralentissement progressif (très efficace)
const apiSpeedLimiter = slowDown({
  windowMs: 60_000,      // 1 min
  delayAfter: 60,        // à partir de 60 req/min
  delayMs: () => 250,    // +250ms par requête au-delà
});

// Zone sensible: auth/login/register/reset
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 min
  max: 30,               // 30 tentatives / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts" },
});

app.use("/api", apiLimiter, apiSpeedLimiter);

let inflight = 0;
const MAX_INFLIGHT = 200;

app.use((req: Request, res: Response, next: NextFunction) => {
  inflight++;

  if (inflight > MAX_INFLIGHT) {
    inflight--;
    return res.status(503).json({ error: "Server busy" });
  }

  res.on("finish", () => inflight--);
  res.on("close", () => inflight--);

  next();
});

app.get("/ip-check", (req: Request, res: Response) => {
  res.json({
    ip: req.ip,
    xff: req.headers["x-forwarded-for"],
  });
});

// Routes
const prospectionRoutes = require("./routes/prospectionRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const proLeadRoutes = require("./routes/proLeadRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const serviceTemplateRoutes = require("./routes/serviceTemplateRoutes");
const shopRoutes = require("./routes/shopRoutes");
const userRoutes = require("./routes/userRoutes");
const countryRoutes = require("./routes/countryRoutes");
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
const notifyRoutes = require('./routes/notify');
const devicesRoutes = require('./routes/devices');
const b2bLeadRoutes = require("./routes/b2bLeadRoutes");
const fakePost = require("./routes/fakePost");

// Utilisation des routes
app.use("/api", prospectionRoutes);
app.use("/api", bookingRoutes);
app.use("/api", advertisementRoutes);
app.use("/api", serviceRoutes);
app.use("/api", serviceTemplateRoutes);
app.use("/api", shopRoutes);
app.use("/api", userRoutes);
app.use("/api", proLeadRoutes);
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
app.use('/api', notifyRoutes);
app.use('/api', devicesRoutes);
app.use('/api', countryRoutes);
app.use("/api", b2bLeadRoutes);
app.use("/api", fakePost);

// Middleware pour servir les fichiers statiques
app.use('/uploads/images', express.static(path.join(__dirname, '../uploads/images')));

app.use('/uploads/docs', express.static(path.join(__dirname, '../uploads/docs')));

// Créer le serveur HTTP basé sur Express
const server = http.createServer(app);

// === ROOMS POUR LES CONVERSATIONS ===
const rooms: Record<string, Set<WebSocket>> = {};

// Créer le serveur WebSocket
const wss = new WebSocketServer({ server });

// Gérer les connexions WebSocket
wss.on('connection', (ws) => {
  console.log('🧠 Nouvelle connexion WebSocket');

  ws.on('message', async (raw) => {
    console.log(`📩 Message reçu : ${raw}`);
    try {
      const parsed = JSON.parse(raw.toString());
      const { action, topic, message } = parsed;

      if (action === 'subscribe') {
        if (!rooms[topic]) rooms[topic] = new Set();
        rooms[topic].add(ws);
        console.log(`✅ Client abonné à ${topic}`);
        return;
      }

      if (action === 'publish' && topic.endsWith('/new')) {
        const convId = topic.split('/')[1];
        const conv = await ConversationModel.findById(convId);
        if (!conv) return console.warn(`❌ Conv introuvable: ${convId}`);

        const newMsg = {
          sender: message.sender,
          content: message.content,
          messageType: message.messageType || 'text',
          createdAt: new Date(),
          mediaUrl: message.mediaUrl || '',
          clientId: message.clientId || undefined // ✅
        };

        conv.messages.push(newMsg);
        await conv.save();

        // ✅ renvoyer la vraie version sauvegardée
        const savedMsg = conv.messages[conv.messages.length - 1];

        const payload = JSON.stringify({
          topic: `conversation/${convId}`,
          message: savedMsg,
        });

        rooms[`conversation/${convId}`]?.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(payload);
        });

        console.log(`💬 Message diffusé à conversation/${convId}`);
      }
    } catch (error) {
      console.error('❌ Erreur WS:', error);
      ws.send('❌ Erreur lors du traitement du message');
    }
  });

  ws.on('close', () => {
    for (const room in rooms) rooms[room].delete(ws);
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
    await seedDatabase();
    await seedCities();
    await startB2BDripCron();
    await scheduleWeeklyPayouts();
    await startShopStatsCron();
    console.log("Connexion à la base de données réussie");
  })
  .catch((err: any) => {
    console.error("Erreur de connexion à la base de données :", err.message);
    process.exit(1);
  });

// Démarrer le serveur HTTP (et donc WS aussi)
server.listen(port, () => {
  console.log(`✅ Serveur HTTP + WebSocket démarré sur https://izyglam.com`);
});
// 🔥 Démarrer le cron DRIP B2B APRÈS la connexion DB
startB2BDripCron();

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

// ✅ Export rooms pour conversationController
export { rooms, WebSocket };
