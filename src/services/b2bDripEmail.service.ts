// src/services/b2bDripEmail.service.ts
import B2BLeadModel, { IB2BLead } from "../models/b2bLead";
import { logger } from "../utils/logger";
import { sendEmail } from "./b2bEmail.service";

interface DripEmailContent {
  subject: string;
  html: string;
}

// Délais entre les emails (en jours) AVANT l'envoi de CETTE étape
// Tu peux ajuster à ta guise.
const DRIP_DELAYS_DAYS: Record<number, number> = {
  1: 0,  // email 1 : dès que possible
  2: 3,  // email 2 : 3 jours après le 1
  3: 7,  // email 3 : 7 jours après le 2
  4: 14, // email 4 : 14 jours après le 3
  5: 30, // email 5 : 30 jours après le 4
};

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Construit le contenu de l'email pour une étape donnée.
 */
function buildDripEmail(step: number, lead: IB2BLead): DripEmailContent {
  const company = lead.companyName || "votre entreprise";
  const firstName =
    lead.contactFirstName ||
    (lead.contactLastName ? `M./Mme ${lead.contactLastName}` : "Bonjour");

  switch (step) {
    case 1:
      return {
        subject: `Bien-être au travail pour ${company}`,
        html: `
          <p>Bonjour ${firstName},</p>
          <p>
            Je me permets de vous contacter car nous aidons des entreprises comme ${company}
            à mettre en place des prestations bien-être pour leurs équipes (massages, soins, etc.).
          </p>
          <p>
            Seriez-vous disponible pour en discuter rapidement ?
          </p>
          <p>Belle journée,<br/>L'équipe IzyGlam</p>
        `,
      };
    case 2:
      return {
        subject: `Toujours d'actualité pour ${company} ?`,
        html: `
          <p>Re-bonjour ${firstName},</p>
          <p>
            Je me permets de revenir vers vous concernant le bien-être au travail chez ${company}.
          </p>
          <p>
            Nous pouvons démarrer par un test sur une petite équipe, sans engagement.
          </p>
          <p>Qu'en pensez-vous ?</p>
          <p>Bien à vous,<br/>L'équipe IzyGlam</p>
        `,
      };
    case 3:
      return {
        subject: `Exemples concrets de mise en place`,
        html: `
          <p>Bonjour ${firstName},</p>
          <p>
            Quelques exemples de ce que nous avons mis en place dans d'autres entreprises :
          </p>
          <ul>
            <li>Massages assis mensuels</li>
            <li>Journées bien-être ponctuelles</li>
            <li>Programmes sur mesure pour les équipes RH / Office management</li>
          </ul>
          <p>
            Si vous le souhaitez, je peux vous partager un exemple de programme adapté à ${company}.
          </p>
          <p>Bonne journée,<br/>L'équipe IzyGlam</p>
        `,
      };
    case 4:
      return {
        subject: `Proposition personnalisée pour ${company}`,
        html: `
          <p>Bonjour ${firstName},</p>
          <p>
            Je peux vous préparer une proposition personnalisée pour ${company} 
            avec 2 ou 3 scénarios possibles (test, déploiement progressif, etc.).
          </p>
          <p>
            Avez-vous 15 minutes cette semaine ou la semaine prochaine pour en discuter ?
          </p>
          <p>Bien à vous,<br/>L'équipe IzyGlam</p>
        `,
      };
    case 5:
      return {
        subject: `Dernier message de ma part 🙂`,
        html: `
          <p>Bonjour ${firstName},</p>
          <p>
            C'est mon dernier message concernant le sujet du bien-être au travail chez ${company}.
          </p>
          <p>
            Si ce n'est pas le bon moment, aucun souci.
            Je reste à votre disposition si le sujet revient sur la table plus tard.
          </p>
          <p>Très belle journée,<br/>L'équipe IzyGlam</p>
        `,
      };
    default:
      throw new Error("Étape de drip invalide (doit être entre 1 et 5).");
  }
}

/**
 * Détermine le prochain email à envoyer pour un lead.
 * On respecte l’ordre 1 -> 5.
 */
function computeNextStep(lead: IB2BLead): number | null {
  if (!lead.email1Sent) return 1;
  if (!lead.email2Sent) return 2;
  if (!lead.email3Sent) return 3;
  if (!lead.email4Sent) return 4;
  if (!lead.email5Sent) return 5;
  return null; // tous envoyés
}

/**
 * Envoi d'un email X à un lead (utilisé par manuel + auto)
 */
export async function sendDripEmailForLead(
  leadId: string,
  step: number
): Promise<IB2BLead> {
  if (step < 1 || step > 5) {
    throw new Error("step doit être entre 1 et 5");
  }

  const lead = await B2BLeadModel.findById(leadId);

  if (!lead) {
    throw new Error("Lead introuvable");
  }

  if (!lead.contactEmail) {
    throw new Error("Ce lead n'a pas d'email de contact");
  }

  const alreadySentFlag = (lead as any)[`email${step}Sent`];
  if (alreadySentFlag) {
    throw new Error(`L'email ${step} a déjà été envoyé à ce lead.`);
  }

  const { subject, html } = buildDripEmail(step, lead);

  await sendEmail({
    to: lead.contactEmail,
    subject,
    html,
  });

  const now = new Date();

  // Mise à jour de l'état
  lead.dripStep = step;
  (lead as any)[`email${step}Sent`] = true;
  (lead as any)[`email${step}SentAt`] = now;
  lead.lastContactAt = now;

  if (lead.status === "new") {
    lead.status = "in_drip";
  }

  // Préparation de la prochaine action
  const nextStep = step + 1;
  if (nextStep <= 5) {
    const delayDays = DRIP_DELAYS_DAYS[nextStep] ?? 3;
    lead.nextActionAt = new Date(now.getTime() + daysToMs(delayDays));
  } else {
    lead.nextActionAt = undefined as any;
  }

  await lead.save();

  logger.info({
    msg: "sendDripEmailForLead success",
    leadId: lead._id.toString(),
    step,
    email: lead.contactEmail,
    nextActionAt: lead.nextActionAt,
  });

  return lead;
}

/**
 * Job automatique : envoie les prochains emails pour les leads éligibles.
 *
 * ❗ Version corrigée :
 *  - Démarre à l'email 1 pour les leads qui n'ont encore rien reçu
 *  - Utilise nextActionAt SI défini, sinon considère que c'est "tout de suite"
 */
export async function processDripQueue(limit = 50): Promise<{
  fetched: number;
  processed: number;
  sent: number;
  errors: number;
}> {
  const now = new Date();

  // On récupère les leads :
  // - status new ou in_drip
  // - avec un email
  // - qui ont soit nextActionAt <= now, soit pas de nextActionAt (début de séquence)
  const leads = await B2BLeadModel.find({
    status: { $in: ["new", "in_drip"] },
    contactEmail: { $ne: null },
    $or: [
      { nextActionAt: { $exists: false } },
      { nextActionAt: null },
      { nextActionAt: { $lte: now } },
    ],
  })
    .sort({ nextActionAt: 1, createdAt: 1 })
    .limit(limit);

  let processed = 0;
  let sent = 0;
  let errors = 0;

  for (const lead of leads) {
    processed++;

    const nextStep = computeNextStep(lead);
    if (!nextStep) {
      // Tous les emails 1->5 sont déjà envoyés
      continue;
    }

    // Sécurité : si nextActionAt est défini et > now, on skip (même si $or a passé le filtre)
    if (lead.nextActionAt && lead.nextActionAt.getTime() > now.getTime()) {
      continue;
    }

    try {
      await sendDripEmailForLead(lead._id.toString(), nextStep);
      sent++;
    } catch (err: any) {
      errors++;
      logger.error({
        msg: "processDripQueue: error while sending drip email",
        leadId: lead._id.toString(),
        step: nextStep,
        errorName: err?.name,
        errorMessage: err?.message,
        stack: err?.stack,
      });
    }
  }

  const result = {
    fetched: leads.length,
    processed,
    sent,
    errors,
  };

  logger.info({
    msg: "processDripQueue completed",
    ...result,
  });

  return result;
}
