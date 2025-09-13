const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

// IMPORTANT: vos controllers sont en TypeScript → import depuis le build JS
// Adaptez le chemin si votre build transpile vers ./dist/leware");
const prospection = require("../controllers/prospectionController");

// ------- Leads -------
router.post("/prospection/lead/upsert-found", authMiddleware, prospection.upsertFoundLead);
router.get("/prospection/leads/to-enrich", authMiddleware, prospection.listToEnrich);
router.post("/prospection/lead/save-enriched", authMiddleware, prospection.saveEnriched);
router.get("/prospection/leads/to-verify", authMiddleware, prospection.listToVerify);
router.post("/prospection/lead/mark-verified", authMiddleware, prospection.markVerified);
router.get("/prospection/leads", authMiddleware, prospection.listLeads);
router.get("/prospection/leads/:id", authMiddleware, prospection.getLead);

// ------- Séquence / Tâches -------
router.get("/prospection/leads/for-sequence", authMiddleware, prospection.listForSequence);
router.post("/prospection/tasks/sequence", authMiddleware, prospection.createSequenceTasks);
router.get("/prospection/tasks/queued", authMiddleware, prospection.listQueuedTasks);
router.post("/prospection/tasks/:id/status", authMiddleware, prospection.updateTaskStatus);

// ------- Événements -------
router.post("/prospection/event", authMiddleware, prospection.addEvent);

module.exports = router;
