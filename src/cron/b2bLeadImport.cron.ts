import cron from "node-cron";
import { logger } from "../utils/logger";
import { importB2BLeadsFromGooglePlaces } from "../services/b2bLeadImport.service";

// Planification : tous les jours à 03:00 du matin
// "0 3 * * *" => minute heure jourDuMois mois jourDeLaSemaine
cron.schedule("0 3 * * *", async () => {  //cron.schedule("*/2 * * * *", async () => {//
  logger.info({
    msg: "Cron job started: importB2BLeadsFromGooglePlaces",
    schedule: "0 3 * * *",
  });

  try {
    await importB2BLeadsFromGooglePlaces();
    logger.info({
      msg: "Cron job finished: importB2BLeadsFromGooglePlaces",
    });
  } catch (error: any) {
    logger.error({
      msg: "Cron job failed: importB2BLeadsFromGooglePlaces",
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
});
