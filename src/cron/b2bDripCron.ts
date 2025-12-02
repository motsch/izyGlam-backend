// src/cron/b2bDripCron.ts
import { logger } from "../utils/logger";
import { processDripQueue } from "../services/b2bDripEmail.service";

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v == null) return def;
  return ["1", "true", "yes", "y", "on"].includes(
    String(v).trim().toLowerCase()
  );
}

function envInt(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

/**
 * Démarre le cron DRIP B2B (si activé dans l'ENV).
 * - Lit les variables d'env AU MOMENT de l'appel
 *   (important si dotenv est chargé dans index.ts)
 */
export function startB2BDripCron(): void {
  // DEBUG : afficher les valeurs brutes de l'ENV
  console.log("[B2B DRIP] ENV RAW:", {
    B2B_DRIP_AUTO_ENABLED: process.env.B2B_DRIP_AUTO_ENABLED,
    B2B_DRIP_AUTO_INTERVAL_MINUTES:
      process.env.B2B_DRIP_AUTO_INTERVAL_MINUTES,
    B2B_DRIP_AUTO_LIMIT: process.env.B2B_DRIP_AUTO_LIMIT,
  });

  const AUTO_ENABLED = envBool("B2B_DRIP_AUTO_ENABLED", false);
  const INTERVAL_MINUTES = envInt("B2B_DRIP_AUTO_INTERVAL_MINUTES", 30);
  const LIMIT = envInt("B2B_DRIP_AUTO_LIMIT", 100);

  if (!AUTO_ENABLED) {
    console.log(
      "[B2B DRIP] Cron désactivé (B2B_DRIP_AUTO_ENABLED=false ou non défini)"
    );
    logger.info({
      msg: "[B2B DRIP] Cron désactivé (B2B_DRIP_AUTO_ENABLED=false)",
    });
    return;
  }

  const intervalMs = INTERVAL_MINUTES * 60 * 10;

  console.log(
    `[B2B DRIP] Cron démarré - interval=${INTERVAL_MINUTES} min, limit=${LIMIT}`
  );
  logger.info({
    msg: "[B2B DRIP] Cron démarré",
    intervalMinutes: INTERVAL_MINUTES,
    limit: LIMIT,
  });

  const tick = async () => {
    console.log("[B2B DRIP] Tick démarré...");
    try {
      const stats = await processDripQueue(LIMIT);
      console.log("[B2B DRIP] Tick terminé:", stats);
      logger.info({
        msg: "[B2B DRIP] Cron tick terminé",
        stats,
      });
    } catch (error: any) {
      console.error("[B2B DRIP] Tick erreur:", error);
      logger.error({
        msg: "[B2B DRIP] Cron tick erreur",
        errorName: error?.name,
        errorMessage: error?.message,
        stack: error?.stack,
      });
    }
  };

  // Premier passage immédiatement
  tick().catch((err) => {
    console.error("[B2B DRIP] First tick erreur:", err);
  });

  // Puis toutes les X minutes
  setInterval(() => {
    void tick();
  }, intervalMs);
}
