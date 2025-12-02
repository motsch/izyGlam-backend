// src/services/b2bEmail.service.ts
import { logger } from "../utils/logger";
import {
  B2B_EMAIL_TEST_MODE,
  B2B_EMAIL_TEST_RECIPIENT,
} from "../config/b2bEmail";
import { sendEmail as sendRawEmail } from "../utils/mailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Wrapper B2B autour du mailer générique.
 * Gère :
 *  - le mode test (B2B_EMAIL_TEST_MODE)
 *  - la redirection vers B2B_EMAIL_TEST_RECIPIENT
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const isTestMode = B2B_EMAIL_TEST_MODE;
  const testRecipient = B2B_EMAIL_TEST_RECIPIENT;

  const originalTo = options.to;
  let effectiveTo = originalTo;
  let subject = options.subject;

  if (isTestMode && testRecipient) {
    // En mode test, on envoie TOUT vers l’email de test
    effectiveTo = testRecipient;
    subject = `[TEST pour ${originalTo}] ${subject}`;
  }

  logger.info({
    msg: "[B2B] sendEmail called",
    testMode: isTestMode,
    testRecipient: testRecipient || null,
    effectiveTo,
    originalTo,
    subject,
  });

  await sendRawEmail({
    to: effectiveTo,
    subject,
    html: options.html,
  });
}
