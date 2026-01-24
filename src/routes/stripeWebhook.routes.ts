import { Router } from "express";
import express from "express";
import { stripeWebhook } from "../controllers/stripeWebhook.controller";

const router = Router();

// ✅ IMPORTANT : Stripe a besoin du RAW body (Buffer)
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
