// src/utils/mailer.ts
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type SMTPPool from "nodemailer/lib/smtp-pool";

/* ----------------------------------------------------------
   Helpers ENV
---------------------------------------------------------- */
function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v == null) return def;
  return ["1", "true", "yes", "y", "on"].includes(String(v).trim().toLowerCase());
}
function envInt(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

/* ----------------------------------------------------------
   Transporter singleton
---------------------------------------------------------- */
let cachedTransporter: nodemailer.Transporter | null = null;

function buildTransport(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST || "ssl0.ovh.net";
  const port = envInt("SMTP_PORT", host.includes("ovh") ? 465 : 587);
  const secure = envBool("SMTP_SECURE", port === 465); // true => 465 (SSL), false => 587 (STARTTLS)
  const pool = envBool("SMTP_POOL", process.env.NODE_ENV === "production");

  const authUser = process.env.SMTP_USER!;
  const authPass = process.env.SMTP_PASS!;
  if (!authUser || !authPass) {
    // on fail tôt : mieux que des 535 au runtime
    throw new Error("[MAILER] Missing SMTP_USER/SMTP_PASS in environment");
  }

  const commonTLS = {
    // laisse true en prod ; ne passe à false que si tu sais pourquoi (cert self-signed en dev)
    rejectUnauthorized: envBool("SMTP_TLS_REJECT_UNAUTH", true),
  };
  const logger = envBool("SMTP_LOGGER", false);

  if (pool) {
    // ---- Transport POOL (perf prod) ----
    const maxConnections = envInt("SMTP_MAX_CONNECTIONS", 5);
    const maxMessages = envInt("SMTP_MAX_MESSAGES", 100);

    const options: SMTPPool.Options = {
      pool: true,
      host,
      port,
      secure,
      auth: { user: authUser, pass: authPass },
      maxConnections,
      maxMessages,
      tls: commonTLS,
      logger,
    };
    return nodemailer.createTransport(options);
  }

  // ---- Transport SMTP “classique” ----
  const options: SMTPTransport.Options = {
    host,
    port,
    secure,
    auth: { user: authUser, pass: authPass },
    tls: commonTLS,
    logger,
  };
  return nodemailer.createTransport(options);
}

function getTransport(): nodemailer.Transporter {
  if (!cachedTransporter) cachedTransporter = buildTransport();
  return cachedTransporter;
}

/** Compat avec ton code existant (controllers) */
export function makeTransport(): nodemailer.Transporter {
  return getTransport();
}

/** Vérifie la connexion SMTP au démarrage (recommandé) */
export async function verifySmtp(): Promise<void> {
  await getTransport().verify();
}

/** Fermer proprement (tests/CLI) */
export function closeTransport(): void {
  if (cachedTransporter && "close" in cachedTransporter) {
    (cachedTransporter as any).close?.();
  }
  cachedTransporter = null;
}

/* ----------------------------------------------------------
   Envoi d’email
---------------------------------------------------------- */
type Attachment = {
  filename: string;
  path?: string;
  content?: Buffer | string;
  cid?: string;        // pour <img src="cid:logo">
  contentType?: string;
};

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
}) {
  const t = getTransport();
  const from =
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER ? `IzyGlam <${process.env.SMTP_USER}>` : "IzyGlam <no-reply@localhost>");

  return t.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    attachments: opts.attachments,
    headers: opts.headers,
  });
}
