const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require('path');
// Import du seeder
import fs from 'fs';
import { seedDatabase } from "./seeder";
import CityModel from "./models/city";
import http from 'http';
import { WebSocketServer } from 'ws';
// Charger les variables d'environnement
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
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
// Middleware pour servir les fichiers statiques dans le dossier 'uploads'
app.use('/uploads/images', express.static(path.join(__dirname, '../uploads/images')));

// Créer le serveur HTTP basé sur Express
const server = http.createServer(app);

// Créer le serveur WebSocket
const wss = new WebSocketServer({ server });

// Gérer les connexions WebSocket
wss.on('connection', (ws) => {
  console.log('🧠 Nouvelle connexion WebSocket');

  ws.on('message', (message) => {
    console.log(`📩 Message reçu : ${message}`);

    // Tu peux envoyer une réponse
    ws.send(`Echo : ${message}`);
  });

  ws.send('👋 Bienvenue sur le WebSocket Server !');
});

// Connexion à la base de données
mongoose
  .connect(
    // "mongodb://0.0.0.0:27017/izyGlam",
    // process.env.BDDPRIVATE,
    // "mongodb://mongo:IaHkRHRswXpmXOViZjZIJlUFrEOuqpqO@autorack.proxy.rlwy.net:44196/izyglam?authSource=admin&retryWrites=true&w=majority",
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
