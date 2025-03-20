const express = require("express");
const router = express.Router();
const kpiController = require("../controllers/kpiController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour récupérer les KPIs d'un prestataire
// On attend l'id du prestataire en paramètre, et la période en query (jour, semaine, mois)
router.get("/kpi/:userProId", authMiddleware, kpiController.getKpi);

module.exports = router;
