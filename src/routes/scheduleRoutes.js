const scheduleController = require("../controllers/scheduleController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// Route pour créer un nouvel emploi du temps (schedule)
router.post("/schedule", authMiddleware, scheduleController.createSchedule);

// Route pour récupérer tous les emplois du temps
router.get("/schedule", scheduleController.getAllSchedules);

// Route pour récupérer un emploi du temps spécifique par ID
router.get("/schedule/:id", scheduleController.getScheduleById);

// Route pour mettre à jour un emploi du temps spécifique
router.put("/schedule/:id", authMiddleware, scheduleController.updateScheduleById);

// Route pour supprimer un emploi du temps spécifique
router.delete("/schedule/:id", authMiddleware, scheduleController.deleteScheduleById);

// Route pour récupérer tous les emplois du temps pour une boutique spécifique
router.get("/schedule/shop/:id", scheduleController.getSchedulesByShop);

module.exports = router;
