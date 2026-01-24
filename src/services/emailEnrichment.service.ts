import axios from "axios";
import { logger } from "../utils/logger";
import B2BLeadModel, { IB2BLead } from "../models/b2bLead";

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

// Petite util pour extraire le domaine à partir d'une URL de site
function extractDomainFromWebsite(website?: string): string | null {
  if (!website) return null;

  try {
    // Ajoute http si manquant pour que URL() fonctionne
    const normalized = website.startsWith("http")
      ? website
      : `https://${website}`;
    const url = new URL(normalized);
    let hostname = url.hostname.toLowerCase();

    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    return hostname;
  } catch (error) {
    logger.warn({
      msg: "extractDomainFromWebsite failed",
      website,
      errorMessage: (error as any)?.message,
    });
    return null;
  }
}

// Heuristique pour choisir le “meilleur” email renvoyé par Hunter
function pickBestEmail(emails: any[]): any | null {
  if (!emails || emails.length === 0) return null;

  // 1. On cherche un email lié aux RH
  const hrLike = emails.find((e: any) => {
    const dep = (e.department || "").toLowerCase();
    const pos = (e.position || "").toLowerCase();
    return (
      dep.includes("human resources") ||
      dep.includes("hr") ||
      pos.includes("rh") ||
      pos.includes("human resources") ||
      pos.includes("hr manager")
    );
  });
  if (hrLike) return hrLike;

  // 2. Sinon un email “personal” si dispo
  const personal = emails.find((e: any) => e.type === "personal");
  if (personal) return personal;

  // 3. Sinon on prend le premier
  return emails[0];
}

// Enrichit UN lead donné (si possible)
export async function enrichLeadEmails(lead: IB2BLead): Promise<void> {
  if (!HUNTER_API_KEY) {
    logger.warn({
      msg: "enrichLeadEmails skipped: missing HUNTER_API_KEY in .env",
      leadId: lead._id?.toString(),
    });
    return;
  }

  if (lead.contactEmail) {
    logger.info({
      msg: "enrichLeadEmails skipped: lead already has contactEmail",
      leadId: lead._id.toString(),
      contactEmail: lead.contactEmail,
    });
    return;
  }

  const domain = extractDomainFromWebsite(lead.website);
  if (!domain) {
    logger.warn({
      msg: "enrichLeadEmails skipped: cannot extract domain from website",
      leadId: lead._id.toString(),
      website: lead.website,
    });
    return;
  }

  try {
    logger.info({
      msg: "enrichLeadEmails calling Hunter",
      leadId: lead._id.toString(),
      domain,
    });

    const response = await axios.get("https://api.hunter.io/v2/domain-search", {
      params: {
        domain,
        api_key: HUNTER_API_KEY,
        // Tu peux affiner ici : department=hr, type=personal, etc.
        // department: "hr",
      },
    });

    const data = response.data?.data;
    const emails: any[] = data?.emails || [];

    if (!emails.length) {
      logger.warn({
        msg: "enrichLeadEmails: no emails found on Hunter",
        leadId: lead._id.toString(),
        domain,
      });
      return;
    }

    const best = pickBestEmail(emails);
    if (!best) {
      logger.warn({
        msg: "enrichLeadEmails: unable to pick best email",
        leadId: lead._id.toString(),
        domain,
      });
      return;
    }

    const primaryEmail = best.value;
    const extraEmails = emails
      .map((e) => e.value)
      .filter((value) => value && value !== primaryEmail);

    const update: any = {
      contactEmail: primaryEmail,
      contactFirstName: best.first_name || lead.contactFirstName,
      contactLastName: best.last_name || lead.contactLastName,
      contactJobTitle: best.position || lead.contactJobTitle,
    };

    if (extraEmails.length) {
      update.extraEmails = extraEmails;
    }

    await B2BLeadModel.findByIdAndUpdate(lead._id, { $set: update });

    logger.info({
      msg: "enrichLeadEmails success",
      leadId: lead._id.toString(),
      primaryEmail,
      extraEmailsCount: extraEmails.length,
    });
  } catch (error: any) {
    logger.error({
      msg: "enrichLeadEmails failed",
      leadId: lead._id?.toString(),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
}

// Enrichit un batch de leads sans email (pour un cron ou un endpoint)
export async function enrichBatchB2BLeads(limit = 20): Promise<void> {
  if (!HUNTER_API_KEY) {
    logger.warn({
      msg: "enrichBatchB2BLeads skipped: missing HUNTER_API_KEY in .env",
    });
    return;
  }

  // On cible les leads créés par l'API (Google Places) avec un site,
  // mais sans contactEmail encore défini.
  const leads = await B2BLeadModel.find({
    contactEmail: { $exists: false },
    website: { $exists: true, $ne: "" },
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  if (!leads.length) {
    logger.info({
      msg: "enrichBatchB2BLeads: no leads to enrich",
    });
    return;
  }

  logger.info({
    msg: "enrichBatchB2BLeads started",
    count: leads.length,
  });

  for (const lead of leads) {
    await enrichLeadEmails(lead as IB2BLead);
  }

  logger.info({
    msg: "enrichBatchB2BLeads finished",
  });
}
