import cron from "node-cron";
import { logger } from "../utils/logger";
import { importProLeadsFromGooglePlaces } from "../services/proLeadImport.service";

// Planification : tous les jours à 04:00 du matin
// "0 4 * * *" => minute heure jourDuMois mois jourDeLaSemaine
cron.schedule("0 4 * * *", async () => { // cron.schedule("*/2 * * * *", async () => {  // 
  logger.info({
    msg: "Cron job started: importProLeadsFromGooglePlaces",
    schedule: "0 4 * * *",
  });

  try {
    await importProLeadsFromGooglePlaces();
    logger.info({
      msg: "Cron job finished: importProLeadsFromGooglePlaces",
    });
  } catch (error: any) {
    logger.error({
      msg: "Cron job failed: importProLeadsFromGooglePlaces",
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
});
