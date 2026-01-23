import Twilio from "twilio";
import UserModel from "../models/user";
import { logger } from "../utils/logger";

const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

function buildSmsWebhookUrl() {
  const base = (process.env.API_BASE_URL || "").replace(/\/$/, "");
  const path = process.env.TWILIO_SMS_WEBHOOK_PATH || "/twilio/inbound-sms";
  return `${base}${path}`;
}

export async function provisionTwilioNumberForUser(userId: string) {
  // 1) reload user (idempotence)
  const user: any = await UserModel.findById(userId).select({ twilioPhoneNumber: 1, firstname: 1, lastname: 1 }).lean();
  if (!user) throw new Error("User not found");

  // ✅ Si déjà un numéro => on ne rachète pas
  if (user.twilioPhoneNumber) {
    logger.info({ msg: "twilio.provision.skip_already_has_number", userId, twilioPhoneNumber: user.twilioPhoneNumber });
    return { phoneNumber: user.twilioPhoneNumber, created: false };
  }

  const country = (process.env.TWILIO_DEFAULT_COUNTRY || "FR").toUpperCase();
  const smsUrl = buildSmsWebhookUrl();

  // 2) chercher un numéro disponible (FR)
  const available = await client.availablePhoneNumbers(country).local.list({
    smsEnabled: true,
    // si tu veux aussi voice, ajoute voiceEnabled: true
    limit: 1,
  });

  if (!available?.length) {
    throw new Error(`No available Twilio numbers for country=${country}`);
  }

  const chosen = available[0].phoneNumber;

  // 3) acheter le numéro
  const friendlyPrefix = process.env.TWILIO_NUMBER_FRIENDLY_PREFIX || "IzyGlam";
  const friendlyName = `${friendlyPrefix} - ${user.firstname || ""} ${user.lastname || ""}`.trim();

  const incoming = await client.incomingPhoneNumbers.create({
    phoneNumber: chosen,
    friendlyName,
    smsUrl,          // ✅ webhook inbound SMS
    smsMethod: "POST",
  });

  // 4) sauvegarder en DB
  await UserModel.updateOne(
    { _id: userId, twilioPhoneNumber: { $exists: false } }, // petite sécurité
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
