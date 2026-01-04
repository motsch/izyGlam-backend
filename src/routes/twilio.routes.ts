import { Router } from "express";
const twillioController = require("../controllers/twilio.controller");

const router = Router();

router.post("/voice", twillioController.twilioVoiceEntry);
router.post("/voice/service", twillioController.twilioVoiceServiceGather);
router.post("/voice/slot", twillioController.twilioVoiceSlotGather);

export default router;
