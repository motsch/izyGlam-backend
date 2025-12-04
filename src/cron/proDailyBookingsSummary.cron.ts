// src/cron/proDailyBookingsSummary.cron.ts
import cron from "node-cron";
import { logger } from "../utils/logger";
import bookingModel from "../models/booking";
import UserModel from "../models/user";
import { sendEmail } from "../utils/mailer";

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v == null) return def;
  return ["1", "true", "yes", "y", "on"].includes(
    String(v).trim().toLowerCase()
  );
}

function envString(name: string, def?: string): string | undefined {
  const v = process.env[name];
  return v?.trim() || def;
}

/**
 * Envoie l'email récapitulatif quotidien à tous les pros.
 */
async function sendDailyProBookingsSummary(): Promise<void> {
  const now = new Date();

  const TEST_MODE = envBool("B2B_EMAIL_TEST_MODE", false);
  const TEST_RECIPIENT = envString("B2B_EMAIL_TEST_RECIPIENT");

  // Début et fin de la journée (heure serveur)
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  console.log("[PRO DAILY BOOKINGS] Tick démarré...", {
    now,
    startOfDay,
    endOfDay,
    TEST_MODE,
    TEST_RECIPIENT,
  });

  logger.info({
    msg: "[PRO DAILY BOOKINGS] Lancement du job",
    now,
    startOfDay,
    endOfDay,
    testMode: TEST_MODE,
    testRecipient: TEST_RECIPIENT,
  });

  // 1. Récupérer tous les users pro
  const proFilter: any = {
    role: "professionnel",
    email: { $ne: null },
  };

  if (!TEST_MODE) {
    proFilter.active = true;
  }

  const pros = await UserModel.find(proFilter);

  console.log("[PRO DAILY BOOKINGS] Pros trouvés:", pros.length);

  logger.info({
    msg: "[PRO DAILY BOOKINGS] Pros trouvés",
    count: pros.length,
    filter: proFilter,
  });

  if (!pros.length) {
    console.warn("[PRO DAILY BOOKINGS] Aucun pro ne correspond au filtre");
    return;
  }

  for (const pro of pros) {
    try {
      const proId = pro._id.toString();

      // 2. Récupérer les bookings pour ce pro
      const bookingFilter: any = {
        userProId: proId,
      };

      if (!TEST_MODE) {
        bookingFilter.start = { $gte: startOfDay, $lt: endOfDay };
        bookingFilter.status = { $nin: ["deleted", "cancelled", "refused"] };
      }

      const bookings = await bookingModel.find(bookingFilter);

      console.log(
        "[PRO DAILY BOOKINGS] Bookings trouvés pour pro:",
        pro.email,
        "=>",
        bookings.length
      );

      logger.info({
        msg: "[PRO DAILY BOOKINGS] Bookings trouvés pour pro",
        proId,
        email: pro.email,
        bookingsCount: bookings.length,
        bookingFilter,
      });

      if (!bookings.length && !TEST_MODE) {
        logger.info({
          msg: "[PRO DAILY BOOKINGS] Aucun booking pour ce pro aujourd'hui (prod => pas d'email)",
          proId,
          email: pro.email,
        });
        continue;
      }

      const dateLabel = startOfDay.toLocaleDateString("fr-FR");
      let subject = `Vos rendez-vous du ${dateLabel}`;
      if (TEST_MODE) {
        subject = `[TEST] Vos rendez-vous du ${dateLabel}`;
      }

      const rowsHtml =
        bookings.length > 0
          ? bookings
              .map((b) => {
                const startTime = b.start
                  ? new Date(b.start).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                const endTime = b.end
                  ? new Date(b.end).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";

                const statusLabel = (() => {
                  switch (b.status) {
                    case "pending":
                      return "En attente";
                    case "accepted":
                      return "Acceptée";
                    case "refused":
                      return "Refusée";
                    case "cancelled":
                      return "Annulée";
                    case "finished":
                      return "Terminée";
                    case "no-show-client":
                      return "Client absent";
                    case "no-show-pro":
                      return "Pro absent";
                    case "deleted":
                      return "Supprimée";
                    default:
                      return b.status;
                  }
                })();

                return `
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #f3e3f1;">${startTime} - ${endTime}</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #f3e3f1;">${b.productName || ""}</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #f3e3f1;">${b.establishmentName || ""}</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #f3e3f1;">${b.price || ""} €</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #f3e3f1;">${statusLabel}</td>
                  </tr>
                `;
              })
              .join("")
          : `
              <tr>
                <td colspan="5" style="padding:12px 8px; text-align:center; color:#8f6b92;">
                  Aucun rendez-vous trouvé pour ce pro avec le filtre actuel.
                  ${TEST_MODE ? "(MODE TEST)" : ""}
                </td>
              </tr>
            `;

      const html = `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#2b1430; line-height:1.5;">
          <h2 style="font-size:20px; margin-bottom:8px;">Bonjour ${pro.firstname || ""} 👋</h2>
          <p style="margin-top:0; margin-bottom:16px;">
            Voici le récapitulatif de vos rendez-vous pour la journée du <strong>${dateLabel}</strong>.
          </p>

          <table style="border-collapse:collapse; width:100%; max-width:700px; background:#fff7fb; border-radius:16px; overflow:hidden;">
            <thead>
              <tr style="background:#ffe5f3;">
                <th style="text-align:left; padding:8px 6px; font-size:12px;">Horaire</th>
                <th style="text-align:left; padding:8px 6px; font-size:12px;">Prestation</th>
                <th style="text-align:left; padding:8px 6px; font-size:12px;">Lieu</th>
                <th style="text-align:left; padding:8px 6px; font-size:12px;">Prix</th>
                <th style="text-align:left; padding:8px 6px; font-size:12px;">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <p style="margin-top:16px; font-size:12px; color:#8f6b92;">
            Email automatique envoyé par IzyGlam pour vous aider à préparer votre journée 💅
            ${TEST_MODE ? "<br/><strong>Mode test activé : destinataire forcé.</strong>" : ""}
          </p>
        </div>
      `;

      const recipient =
        TEST_MODE && TEST_RECIPIENT ? TEST_RECIPIENT : pro.email;

      console.log(
        "[PRO DAILY BOOKINGS] Envoi email à:",
        recipient,
        "(real:",
        pro.email,
        ")"
      );

      await sendEmail({
        to: recipient,
        subject,
        html,
      });

      logger.info({
        msg: "[PRO DAILY BOOKINGS] Email envoyé",
        proId,
        emailReal: pro.email,
        emailSentTo: recipient,
        testMode: TEST_MODE,
        bookingsCount: bookings.length,
      });
    } catch (error: any) {
      console.error("[PRO DAILY BOOKINGS] Erreur pour un pro:", error);
      logger.error({
        msg: "[PRO DAILY BOOKINGS] Erreur lors du traitement d'un pro",
        proId: (pro as any)?._id?.toString?.(),
        errorName: error?.name,
        errorMessage: error?.message,
        stack: error?.stack,
      });
    }
  }
}

/**
 * Démarre le cron qui envoie chaque jour à 5h00
 * le récapitulatif des bookings de la journée aux pros.
 */
export function startProBookingsSummaryCron(): void {
  const enabled = envBool("PRO_DAILY_BOOKINGS_ENABLED", true);
  const timezone = process.env.CRON_TZ || "Europe/Paris";

  if (!enabled) {
    console.log(
      "[PRO DAILY BOOKINGS] Cron désactivé (PRO_DAILY_BOOKINGS_ENABLED=false)"
    );
    logger.info({
      msg: "[PRO DAILY BOOKINGS] Cron désactivé (PRO_DAILY_BOOKINGS_ENABLED=false)",
    });
    return;
  }

  // 🔥 Pour les tests : toutes les minutes
  const expression = "*/1 * * * *";
  // En prod : const expression = "0 5 * * *";

  cron.schedule(
    expression,
    () => {
      void sendDailyProBookingsSummary();
    },
    {
      timezone,
    }
  );

  console.log("[PRO DAILY BOOKINGS] Cron programmé:", expression, timezone);

  logger.info({
    msg: "[PRO DAILY BOOKINGS] Cron programmé",
    expression,
    timezone,
  });
}
