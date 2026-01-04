import { Router } from "express";
const stripeWebhookController = require("../controllers/stripeWebhook.controller");

const router = Router();

router.post("/webhook", stripeWebhookController.stripeWebhook);

export default router;
