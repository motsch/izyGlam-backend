import { Router } from "express";
// import { twilioVoiceEntry, twilioVoiceServiceGather } from "../../controllers/twilio.controller";
const createAssistantCheckoutController = require("../controllers/assistant.controller");

const router = Router();

router.post("/checkout", createAssistantCheckoutController.createAssistantCheckout);

export default router;
