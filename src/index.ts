const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

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
  .then(() => {
    console.log("Connexion à la base de données réussie");
  })
  .catch((err: any) => {
    console.error("Erreur de connexion à la base de données :", err.message);
    process.exit(1);
  });

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

// Utilisation des routes OpenAI dans l'application
app.use("/api", bookingRoutes);
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

// Middleware pour servir les fichiers statiques dans le dossier 'uploads'
app.use('/uploads/images', express.static(path.join(__dirname, '../uploads/images')));

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
