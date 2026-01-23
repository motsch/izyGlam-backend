// src/services/twilioProvision.service.ts
import Twilio from "twilio";
import UserModel from "../models/user";
import { logger } from "../utils/logger";

const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

function buildSmsWebhookUrl() {
  const base = (process.env.API_BASE_URL || "").replace(/\/$/, "");
  const path = process.env.TWILIO_SMS_WEBHOOK_PATH || "/twilio/inbound-sms";
  return `${base}${path}`;
}

/**
 * ✅ Provision (buy + attach) a Twilio number for a user (idempotent).
 */
export async function provisionTwilioNumberForUser(userId: string) {
  // 1) reload user (idempotence)
  const user: any = await UserModel.findById(userId).select({ twilioPhoneNumber: 1, firstname: 1, lastname: 1 }).lean();
  if (!user) throw new Error("User not found");

  // ✅ If already has number => do nothing
  if (user.twilioPhoneNumber) {
    logger.info({ msg: "twilio.provision.skip_already_has_number", userId, twilioPhoneNumber: user.twilioPhoneNumber });
    return { phoneNumber: user.twilioPhoneNumber, created: false };
  }

  const country = (process.env.TWILIO_DEFAULT_COUNTRY || "FR").toUpperCase();
  const smsUrl = buildSmsWebhookUrl();

  // 2) find available number
  const available = await client.availablePhoneNumbers(country).local.list({
    smsEnabled: true,
    // voiceEnabled: true, // (optional) if you want voice too
    limit: 1,
  });

  if (!available?.length) {
    throw new Error(`No available Twilio numbers for country=${country}`);
  }

  const chosen = available[0].phoneNumber;

  // 3) buy number
  const friendlyPrefix = process.env.TWILIO_NUMBER_FRIENDLY_PREFIX || "IzyGlam";
  const friendlyName = `${friendlyPrefix} - ${user.firstname || ""} ${user.lastname || ""}`.trim();

  const incoming = await client.incomingPhoneNumbers.create({
    phoneNumber: chosen,
    friendlyName,
    smsUrl, // ✅ inbound SMS webhook
    smsMethod: "POST",
  });

  // 4) save in DB (idempotence guard)
  await UserModel.updateOne(
    { _id: userId, $or: [{ twilioPhoneNumber: { $exists: false } }, { twilioPhoneNumber: null }, { twilioPhoneNumber: "" }] },
    { $set: { twilioPhoneNumber: incoming.phoneNumber } }
  );

  logger.info({
    msg: "twilio.provision.success",
    userId,
    twilioPhoneNumber: incoming.phoneNumber,
    incomingSid: incoming.sid,
    smsUrl,
  });

  return { phoneNumber: incoming.phoneNumber, created: true };
}

/**
 * ✅ Release a Twilio number (IncomingPhoneNumbers) by its E.164 phone number.
 * - Safe / idempotent: if not found => no error thrown.
 */
export async function releaseTwilioNumber(phoneNumberE164: string) {
  const phoneNumber = String(phoneNumberE164 || "").trim();
  if (!phoneNumber) return { released: false, reason: "empty_phoneNumber" };

  try {
    // Find incoming number by phoneNumber
    const list = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 20 });

    if (!list?.length) {
      logger.info({ msg: "twilio.release.not_found", phoneNumber });
      return { released: false, reason: "not_found" };
    }

    // There should be only one, but just in case:
    for (const n of list) {
      await client.incomingPhoneNumbers(n.sid).remove();
      logger.info({ msg: "twilio.release.removed", phoneNumber: n.phoneNumber, sid: n.sid });
    }

    return { released: true };
  } catch (e: any) {
    logger.error({
      msg: "twilio.release.failed",
      phoneNumber,
      errorMessage: e?.message,
      code: e?.code,
      status: e?.status,
      moreInfo: e?.moreInfo,
      stack: e?.stack,
    });
    throw e;
  }
}

/**
 * ✅ Deprovision user: release Twilio number + clean DB fields.
 * - Safe / idempotent.
 */
export async function deprovisionTwilioNumberForUser(userId: string) {
  const user: any = await UserModel.findById(userId).select({ twilioPhoneNumber: 1 }).lean();
  if (!user) return { done: false, reason: "user_not_found" };

  const twilioPhoneNumber = String(user.twilioPhoneNumber || "").trim();

  // Release Twilio number if exists
  if (twilioPhoneNumber) {
    await releaseTwilioNumber(twilioPhoneNumber);
  }

  // Clean DB: remove number + disable assistant fields (safe)
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        twilioPhoneNumber: null,
        assistantProEnabled: false,
        assistantShopId: null,
      },
    }
  );

  logger.info({
    msg: "twilio.deprovision.success",
    userId,
    twilioPhoneNumber: twilioPhoneNumber || null,
  });

  return { done: true, releasedNumber: !!twilioPhoneNumber };
}
