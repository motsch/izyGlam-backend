import { Router } from "express";
import {
  twilioVoiceEntry,
  twilioVoiceServiceGather,
  twilioVoiceSlotGather,
} from "../controllers/twilio.controller";

const router = Router();

/**
 * Twilio Voice Webhooks (POST x-www-form-urlencoded)
 * Base path: /twilio
 *
 * Full URLs:
 *  - POST /twilio/voice
 *  - POST /twilio/voice/service
 *  - POST /twilio/voice/slot
 */
router.post("/voice", twilioVoiceEntry);
router.post("/voice/service", twilioVoiceServiceGather);
router.post("/voice/slot", twilioVoiceSlotGather);

export default router;
