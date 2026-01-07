// src/controllers/twilio.controller.ts
import { Request, Response } from "express";
import twilio from "twilio";

import UserModel from "../models/user";
import ShopModel from "../models/shop";
import ServiceModel from "../models/service";
import AssistantSessionModel from "../models/assistantSession";

import { computeAvailableSlots } from "../services/availability.service";
import { createBookingAndCheckout } from "../services/assistantCheckout.service";
import { sendSms } from "../services/twilio.service";

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Utils
 */
function norm(v?: string) {
  return (v || "").trim();
}

function nowMs() {
  return Date.now();
}

function safeJson(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[unserializable]";
  }
}

function dumpErr(e: any) {
  return {
    message: e?.message,
    name: e?.name,
    code: e?.code,
    status: e?.status,
    moreInfo: e?.moreInfo,
    stack: e?.stack,
  };
}

function saySlotFR(date: string, start: string) {
  const d = new Date(`${date}T${start}:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function normalizePhoneE164(raw: string) {
  const v = norm(raw).replace(/\s+/g, "");
  if (v.startsWith("+")) return v;
  if (/^0\d{9}$/.test(v)) return "+33" + v.slice(1);
  return v;
}

function buildAutoReplySms(params: {
  shopName?: string;
  shopType?: string;
  shopHandle?: string;
  shopId?: string;
  phoneNumber?: string;
}) {
  const shopName = params.shopName || "ce salon";
  const shopType = (params.shopType || "Salon").trim();
  const displayName = `${shopType} ${shopName}`.trim();

  const phone = params.phoneNumber || "le numéro du salon";
  const url =
    params.shopHandle && params.shopHandle.trim().length > 0
      ? `https://izyglam.com/@${params.shopHandle.trim()}`
      : params.shopId
        ? `https://izyglam.com/shop/${params.shopId}`
        : "https://izyglam.com";

  return (
    `Bonjour 👋\n` +
    `Vous êtes bien sur le numéro de réservation du salon ${displayName}.\n\n` +
    `✅ Pour réserver :\n` +
    `• Par téléphone : ${phone}\n` +
    `• En ligne : ${url}\n\n` +
    `Merci d’avoir pris le temps de nous contacter.\n` +
    `Cordialement,\n` +
    `L’équipe ${shopName} 💖`
  );
}

/**
 * ===========================
 *           VOICE
 * ===========================
 */

/**
 * 📞 Entrée appel
 */
export const twilioVoiceEntry = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const to = norm((req.body as any)?.To);
  const from = norm((req.body as any)?.From);
  const callSid = norm((req.body as any)?.CallSid);

  console.log("[twilio][voice:entry] IN", { callSid, to, from, bodyKeys: Object.keys(req.body || {}) });

  try {
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();

    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Bonjour. Ce numéro n'est pas disponible pour la prise de rendez-vous.");
      twiml.hangup();
      console.warn("[twilio][voice:entry] REJECT", { callSid, to, from, elapsedMs: nowMs() - t0 });
      return res.type("text/xml").send(twiml.toString());
    }

    const shop: any = await ShopModel.findById(pro.assistantShopId).lean();

    await AssistantSessionModel.findOneAndUpdate(
      { callSid },
      {
        callSid,
        userProId: String(pro._id),
        shopId: String(pro.assistantShopId),
        fromPhone: from,
        step: "ASK_SERVICE",
      },
      { upsert: true }
    );

    const services: any[] = await ServiceModel.find({
      shopId: pro.assistantShopId,
      blocked: { $ne: true },
      $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
    })
      .sort({ createdAt: 1 })
      .limit(9)
      .lean();

    if (!services.length) {
      twiml.say({ language: "fr-FR" }, "Aucune prestation n'est disponible actuellement. Au revoir.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    twiml.say(
      { language: "fr-FR" },
      `Bonjour. Je suis Lizy, l'assistante de ${shop?.name || "ce salon"}. Choisissez une prestation.`
    );

    // ✅ ABSOLU (Twilio préfère éviter les actions relatives selon config)
    const actionUrl = `${process.env.API_BASE_URL}/twilio/voice/service`;

    const gather = twiml.gather({
      numDigits: 1,
      action: actionUrl,
      method: "POST",
      timeout: 7,
    });

    services.forEach((s, idx) => {
      gather.say({ language: "fr-FR" }, `Pour ${s.name}, tapez ${idx + 1}.`);
    });

    twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
    twiml.hangup();

    console.log("[twilio][voice:entry] OUT", { callSid, elapsedMs: nowMs() - t0, actionUrl });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error("[twilio][voice:entry] ERROR", dumpErr(e));
    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * 🧾 Choix prestation (voice)
 */
export const twilioVoiceServiceGather = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const to = norm((req.body as any)?.To);
  const callSid = norm((req.body as any)?.CallSid);
  const digit = norm((req.body as any)?.Digits);

  console.log("[twilio][voice:service] IN", { callSid, to, digit });

  try {
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();
    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Ce numéro n'est pas disponible.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    const services: any[] = await ServiceModel.find({
      shopId: pro.assistantShopId,
      blocked: { $ne: true },
      $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
    })
      .sort({ createdAt: 1 })
      .limit(9)
      .lean();

    const idx = Number(digit) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= services.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Au revoir.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    const selected = services[idx];
    const slots = await computeAvailableSlots(String(pro.assistantShopId), String(selected._id));
    const top3 = slots.slice(0, 3);

    if (!top3.length) {
      twiml.say({ language: "fr-FR" }, "Aucun créneau disponible prochainement. Au revoir.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    await AssistantSessionModel.findOneAndUpdate(
      { callSid },
      { step: "ASK_SLOT", serviceId: String(selected._id), proposedSlots: top3 },
      { upsert: true }
    );

    twiml.say({ language: "fr-FR" }, "Voici les prochains créneaux disponibles.");

    const actionUrl = `${process.env.API_BASE_URL}/twilio/voice/slot`;

    const gather = twiml.gather({
      numDigits: 1,
      action: actionUrl,
      method: "POST",
      timeout: 7,
    });

    top3.forEach((s, i) => {
      gather.say({ language: "fr-FR" }, `Pour ${saySlotFR(s.date, s.start)}, tapez ${i + 1}.`);
    });

    twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
    twiml.hangup();

    console.log("[twilio][voice:service] OUT", { callSid, elapsedMs: nowMs() - t0, actionUrl });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error("[twilio][voice:service] ERROR", dumpErr(e));
    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * ⏰ Choix créneau + SMS paiement (voice)
 */
export const twilioVoiceSlotGather = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const callSid = norm((req.body as any)?.CallSid);
  const from = normalizePhoneE164(norm((req.body as any)?.From));
  const to = normalizePhoneE164(norm((req.body as any)?.To));
  const digit = norm((req.body as any)?.Digits);

  console.log("[twilio][voice:slot] IN", { callSid, from, to, digit });

  try {
    const session: any = await AssistantSessionModel.findOne({ callSid }).lean();
    if (!session || session.step !== "ASK_SLOT" || !session.serviceId || !session.proposedSlots?.length) {
      twiml.say({ language: "fr-FR" }, "Session expirée. Veuillez rappeler.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    const idx = Number(digit) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= session.proposedSlots.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Au revoir.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    const chosen = session.proposedSlots[idx];

    const { checkoutUrl, bookingId } = await createBookingAndCheckout({
      shopId: session.shopId,
      serviceId: session.serviceId,
      fromPhone: from,
      slot: chosen,
    });

    await sendSms({
      to: from,
      from: to,
      body: `IzyGlam : pour confirmer et payer votre rendez-vous, cliquez ici : ${checkoutUrl}`,
    });

    await AssistantSessionModel.updateOne({ callSid }, { step: "DONE" });

    twiml.say(
      { language: "fr-FR" },
      "Parfait. Je vous envoie un SMS pour confirmer et payer. Vous le recevrez dans les deux prochaines minutes. Au revoir."
    );
    twiml.hangup();

    console.log("[twilio][voice:slot] OUT", { callSid, elapsedMs: nowMs() - t0, bookingId });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error("[twilio][voice:slot] ERROR", dumpErr(e));
    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * ===========================
 *            SMS
 * ===========================
 *
 * ✅ Simplifié : peu importe le SMS reçu => auto-réponse “pro”
 * POST /twilio/sms
 */
export const twilioSmsInbound = async (req: Request, res: Response) => {
  // Twilio veut un 200 très rapide
  res.status(200).send("OK");

  const msgSid = norm((req.body as any)?.MessageSid);
  const to = normalizePhoneE164(norm((req.body as any)?.To));   // numéro Twilio (du pro)
  const from = normalizePhoneE164(norm((req.body as any)?.From)); // client
  const body = norm((req.body as any)?.Body);

  console.log("[twilio][sms] inbound", { msgSid, to, from, body });

  try {
    // 1) trouver le pro via le numéro Twilio
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();

    if (!pro || !pro.assistantShopId) {
      console.warn("[twilio][sms] pro/shop not found", { msgSid, to, from, proFound: !!pro });
      // on envoie quand même un fallback neutre
      await sendSms({
        to: from,
        from: to,
        body:
          "Bonjour 👋\n" +
          "Merci pour votre message.\n" +
          "Pour réserver, rendez-vous sur https://izyglam.com\n\n" +
          "Cordialement,\nIzyGlam",
      });
      return;
    }

    // 2) charger shop
    const shop: any = await ShopModel.findById(pro.assistantShopId).lean();

    const shopName = shop?.name || "ce salon";
    const shopType = shop?.type || "Salon";

    // si le Shop n'a pas le numéro, on fallback sur le pro / le To
    const shopPhone = shop?.twilioPhoneNumber || pro?.twilioPhoneNumber || to;

    // handle si dispo, sinon fallback shop/<id>
    const shopHandle = shop?.handle;
    const shopId = shop?._id ? String(shop._id) : String(pro.assistantShopId);

    const reply = buildAutoReplySms({
      shopName,
      shopType,
      shopHandle,
      shopId,
      phoneNumber: shopPhone,
    });

    console.log("[twilio][sms] replying", {
      msgSid,
      toClient: from,
      fromNumber: shopPhone,
      shopId,
      shopHandle: shopHandle || null,
    });

    await sendSms({
      to: from,
      from: shopPhone, // ✅ on renvoie depuis le numéro du salon
      body: reply,
    });

    console.log("[twilio][sms] replied OK", { msgSid });
  } catch (e: any) {
    console.error("[twilio][sms] ERROR", dumpErr(e));
  }
};
