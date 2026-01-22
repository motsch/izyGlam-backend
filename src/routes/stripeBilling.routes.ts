import { Router } from "express";
import { createPremiumCheckoutSession } from "../controllers/stripeBilling.controller";
// import ton middleware auth ici
// import { authMiddleware } from "../middlewares/auth";

const router = Router();

// ⚠️ Route JSON normale (PAS raw)
router.post("/premium/checkout-session", /* authMiddleware, */ createPremiumCheckoutSession);

export default router;
