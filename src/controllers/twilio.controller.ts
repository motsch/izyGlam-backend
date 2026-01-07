// src/controllers/twilio.controller.ts
import { Request, Response } from "express";
import twilio from "twilio";
import Stripe from "stripe";

import UserModel from "../models/user";
import ShopModel from "../models/shop";
import ServiceModel from "../models/service";
import bookingModel from "../models/booking";

import AssistantSessionModel from "../models/assistantSession";
import AssistantSmsSessionModel from "../models/assistantSmsSession";
import SmsOptOutModel from "../models/smsOptOut";

import { computeAvailableSlots } from "../services/availability.service";
import { createBookingAndCheckout } from "../services/assistantCheckout.service";
import { sendSms } from "../services/twilio.service";

const VoiceResponse = twilio.twiml.VoiceResponse;

// Stripe client (simple et local)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

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

function logPrefix(callSid?: string) {
  return callSid ? `[twilio][callSid:${callSid}]` : `[twilio]`;
}

function dumpReq(req: Request) {
  return {
    path: req.path,
    method: req.method,
    callSid: norm((req.body as any)?.CallSid),
    from: norm((req.body as any)?.From),
    to: norm((req.body as any)?.To),
    digits: norm((req.body as any)?.Digits),
    speechResult: norm((req.body as any)?.SpeechResult),
    confidence: (req.body as any)?.Confidence,
    messageSid: norm((req.body as any)?.MessageSid),
    body: norm((req.body as any)?.Body),
  };
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

// mini normalize E.164 (FR) — V1
function normalizePhoneE164(raw: string) {
  const v = norm(raw).replace(/\s+/g, "");
  if (v.startsWith("+")) return v;
  if (/^0\d{9}$/.test(v)) return "+33" + v.slice(1);
  return v;
}

type Keyword = "" | "STOP" | "START" | "ANNULER" | "REPORTER";

function parseKeyword(body: string): Keyword {
  const t = norm(body).toUpperCase();

  // STOP keywords (Twilio standard)
  if (
    t === "STOP" ||
    t === "STOPALL" ||
    t === "UNSUBSCRIBE" ||
    t === "CANCEL" ||
    t === "END" ||
    t === "QUIT"
  )
    return "STOP";

  // START keyword (Twilio standard)
  if (t === "START") return "START";

  // FR keywords
  if (t.includes("ANNUL")) return "ANNULER";
  if (t.includes("REPORT") || t.includes("DECALE") || t.includes("DÉCALE") || t.includes("CHANGE"))
    return "REPORTER";

  return "";
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

function formatServicesList(services: any[]) {
  const lines = services.map((s, idx) => `${idx + 1}) ${s.name} (${s.duration}min - ${s.price}€)`);
  return lines.join("\n");
}

function formatSlotsList(slots: any[]) {
  const lines = slots.map((s, idx) => `${idx + 1}) ${saySlotFR(s.date, s.start)}`);
  return lines.join("\n");
}

function helpFooter(shopName?: string) {
  const s = shopName ? ` (${shopName})` : "";
  return `\n\nAide${s} :\n- REPORTER : changer de créneau\n- ANNULER : annuler\n- STOP : ne plus recevoir de SMS\n- START : réactiver`;
}

function extractDigit(body: string, min: number, max: number): number | null {
  const m = body.match(/\d+/g);
  if (!m) return null;
  for (const token of m) {
    const n = Number(token);
    if (Number.isFinite(n) && n >= min && n <= max) return n;
  }
  return null;
}

/**
 * URLs pour Twilio (VOICE Gather)
 * - En prod: API_BASE_URL=https://api.izyglam.com (par ex.)
 * - En local: tu peux laisser vide => actions relatives (mais Twilio doit pouvoir atteindre l'URL)
 */
function getApiBaseUrl() {
  const base = (process.env.API_BASE_URL || "").trim().replace(/\/$/, "");
  return base;
}

function buildTwilioAction(path: string) {
  const base = getApiBaseUrl();
  if (!base) return path; // fallback (utile si tu testes via un proxy type ngrok)
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Helpers DB
 */
async function getShopServices(shopId: string) {
  const services: any[] = await ServiceModel.find({
    shopId,
    blocked: { $ne: true },
    $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
  })
    .sort({ createdAt: 1 })
    .limit(9)
    .lean();

  console.log("[twilio:sms] services fetched", { shopId, count: services.length });
  return services;
}

async function safeSendSms(params: { to: string; from: string; body: string; shopName?: string }) {
  const fullBody = `${params.body}${helpFooter(params.shopName)}`;

  try {
    const r: any = await sendSms({ to: params.to, from: params.from, body: fullBody });
    console.log("[twilio:sms] sent", { sid: r?.sid, status: r?.status, to: params.to, from: params.from });
    return r;
  } catch (e: any) {
    console.error("[twilio:sms] send failed", {
      message: e?.message,
      code: e?.code,
      status: e?.status,
      moreInfo: e?.moreInfo,
      to: params.to,
      from: params.from,
    });
    throw e;
  }
}

/**
 * ✅ Refund idempotent
 */
async function refundBookingIfNeeded(booking: any) {
  if (!booking?.paymentIntentId) {
    console.log("[assistant:refund] no paymentIntentId => skip");
    return { refunded: false, reason: "NO_PAYMENT_INTENT" };
  }
  if (booking.refundId) {
    console.log("[assistant:refund] already refunded => skip", { refundId: booking.refundId });
    return { refunded: false, reason: "ALREADY_REFUNDED", refundId: booking.refundId };
  }

  // ✅ check PI status
  const pi = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
  console.log("[assistant:refund] paymentIntent status", { id: pi.id, status: pi.status });

  if (pi.status !== "succeeded") {
    return { refunded: false, reason: "NOT_PAID_YET", paymentIntentStatus: pi.status };
  }

  const refund = await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
  console.log("[assistant:refund] refund created", { refundId: refund.id, status: refund.status });

  await bookingModel.updateOne({ _id: booking._id }, { $set: { refundId: refund.id, refundedAt: new Date() } });

  return { refunded: true, refundId: refund.id };
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

  console.log(`${logPrefix(callSid)} voice:entry IN`, safeJson(dumpReq(req)));

  try {
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();

    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Bonjour. Ce numéro n'est pas disponible pour la prise de rendez-vous.");
      twiml.hangup();
      console.warn(`${logPrefix(callSid)} voice:entry REJECT`, { to, from, elapsedMs: nowMs() - t0 });
      return res.type("text/xml").send(twiml.toString());
    }

    const shop: any = await ShopModel.findById(pro.assistantShopId).lean();
    const shopName = shop?.name;

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
      `Bonjour. Je suis Lizy, l'assistante de ${shopName || "ce salon"}. Choisissez une prestation.`
    );

    // ✅ ABSOLU si API_BASE_URL, sinon relatif
    const actionUrl = buildTwilioAction("/twilio/voice/service");

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

    console.log(`${logPrefix(callSid)} voice:entry OUT`, { elapsedMs: nowMs() - t0, actionUrl });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error(`${logPrefix(callSid)} voice:entry ERROR`, dumpErr(e));
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

  console.log(`${logPrefix(callSid)} voice:service IN`, safeJson(dumpReq(req)));

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

    // ✅ ABSOLU si API_BASE_URL, sinon relatif
    const actionUrl = buildTwilioAction("/twilio/voice/slot");

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

    console.log(`${logPrefix(callSid)} voice:service OUT`, { elapsedMs: nowMs() - t0, actionUrl });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error(`${logPrefix(callSid)} voice:service ERROR`, dumpErr(e));
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
  const from = norm((req.body as any)?.From);
  const to = norm((req.body as any)?.To);
  const digit = norm((req.body as any)?.Digits);

  console.log(`${logPrefix(callSid)} voice:slot IN`, safeJson(dumpReq(req)));

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
    } as any);

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

    console.log(`${logPrefix(callSid)} voice:slot OUT`, { elapsedMs: nowMs() - t0, bookingId });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error(`${logPrefix(callSid)} voice:slot ERROR`, dumpErr(e));
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
 * ✅ On ajoute ASK_ADDRESS juste avant de générer le checkout
 * Objectif : booking.address obligatoire
 */
export const twilioSmsInbound = async (req: Request, res: Response) => {
  // Twilio veut un 200 rapide
  res.status(200).send("OK");

  const toRaw = norm((req.body as any)?.To);
  const fromRaw = norm((req.body as any)?.From);
  const bodyRaw = norm((req.body as any)?.Body);
  const msgSid = norm((req.body as any)?.MessageSid);

  const to = normalizePhoneE164(toRaw);
  const from = normalizePhoneE164(fromRaw);
  const body = bodyRaw;

  console.log("[twilio:sms] inbound", { msgSid, toRaw, fromRaw, to, from, body });

  try {
    // pro via twilio number
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();
    console.log("[twilio:sms] pro lookup", {
      to,
      proFound: !!pro,
      proId: pro?._id,
      assistantProEnabled: pro?.assistantProEnabled,
      assistantShopId: pro?.assistantShopId,
    });

    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      await safeSendSms({
        to: from,
        from: to,
        shopName: undefined,
        body: "Bonjour 🙂 Ce numéro n'est pas encore disponible pour la prise de rendez-vous.",
      });
      return;
    }

    const shopId = String(pro.assistantShopId);
    const userProId = String(pro._id);

    const shop: any = await ShopModel.findById(shopId).lean();
    const shopName = shop?.name;

    const kw = parseKeyword(body);
    console.log("[twilio:sms] keyword", { kw, body });

    /**
     * ✅ STOP / START (opt-out)
     */
    if (kw === "STOP") {
      await SmsOptOutModel.updateOne(
        { phone: from, shopId },
        { $set: { phone: from, shopId, reason: "STOP" } },
        { upsert: true }
      );

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body: "OK ✅ Vous ne recevrez plus de SMS pour ce salon. (Répondez START pour reprendre)",
      });
      return;
    }

    const optOut = await SmsOptOutModel.findOne({ phone: from, shopId }).lean();
    if (optOut) {
      if (kw === "START") {
        await SmsOptOutModel.deleteOne({ phone: from, shopId });
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "C'est reparti ✅ Envoyez n'importe quel message pour réserver 🙂",
        });
      } else {
        console.log("[twilio:sms] ignored because opt-out", { from, shopId, body });
      }
      return;
    }

    // Session upsert
    const session = await AssistantSmsSessionModel.findOneAndUpdate(
      { shopId, fromPhone: from },
      {
        $setOnInsert: {
          shopId,
          userProId,
          toNumber: to,
          fromPhone: from,
          step: "IDLE",
          attempts: 0,
        },
        $set: { lastInboundBody: body, lastInboundAt: new Date() },
        $inc: { attempts: 1 },
      },
      { new: true, upsert: true }
    ).lean();

    console.log("[twilio:sms] session loaded", {
      id: session?._id,
      step: session?.step,
      serviceId: session?.serviceId,
      proposedSlotsCount: session?.proposedSlots?.length || 0,
      bookingId: session?.bookingId,
      attempts: session?.attempts,
    });

    // ✅ TS-safe step handling (évite ton erreur "no overlap")
    const step = String((session as any)?.step);

    /**
     * ✅ REPORTER : sans repasser par le début
     */
    if (kw === "REPORTER") {
      if (session.serviceId) {
        const slots = await computeAvailableSlots(shopId, String(session.serviceId));
        const top3 = slots.slice(0, 3);

        if (!top3.length) {
          await safeSendSms({
            to: from,
            from: to,
            shopName,
            body: "Désolé, aucun créneau disponible prochainement. Réessayez plus tard.",
          });
          return;
        }

        await AssistantSmsSessionModel.updateOne({ _id: session._id }, { $set: { step: "ASK_SLOT", proposedSlots: top3 } });

        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: `OK ✅ Voici d'autres créneaux :\n${formatSlotsList(top3)}\n\nRépondez 1, 2 ou 3.`,
        });
        return;
      }

      const services = await getShopServices(shopId);

      await AssistantSmsSessionModel.updateOne(
        { _id: session._id },
        { $set: { step: "ASK_SERVICE", serviceId: null, proposedSlots: [] } }
      );

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body: `OK 🙂 Choisissez une prestation :\n${formatServicesList(services)}\n\nRépondez avec un numéro.`,
      });
      return;
    }

    /**
     * ✅ ANNULER : annule vraiment + refund si payé (idempotent)
     */
    if (kw === "ANNULER") {
      if (!session.bookingId) {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Je ne retrouve pas de réservation récente à annuler via SMS. Si besoin, contactez le professionnel 🙂",
        });
        return;
      }

      const booking: any = await bookingModel.findById(session.bookingId);
      if (!booking) {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Je ne retrouve pas cette réservation. Envoyez un message pour recommencer 🙂",
        });
        return;
      }

      // ✅ déjà annulé
      if (booking.status === "cancelled") {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "✅ Réservation déjà annulée.",
        });
        await AssistantSmsSessionModel.updateOne({ _id: session._id }, { $set: { step: "DONE" } });
        return;
      }

      // On annule côté DB
      await bookingModel.updateOne({ _id: booking._id }, { $set: { status: "cancelled" } });

      // refund si paymentIntent succeeded (idempotent via refundId)
      let refundInfo: any = { refunded: false };
      try {
        refundInfo = await refundBookingIfNeeded(booking);
      } catch (e: any) {
        console.error("[assistant:refund] failed", dumpErr(e));
        // on ne bloque pas l'annulation si erreur Stripe
      }

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body: refundInfo.refunded ? "✅ Réservation annulée. Le remboursement est en cours." : "✅ Réservation annulée.",
      });

      await AssistantSmsSessionModel.updateOne({ _id: session._id }, { $set: { step: "DONE" } });
      return;
    }

    /**
     * FLOW TOLÉRANT
     * - IDLE : n'importe quel message démarre
     * - ASK_SERVICE : chiffre dans le texte accepté
     * - ASK_SLOT : chiffre dans le texte accepté
     * + ASK_ADDRESS : adresse obligatoire avant checkout
     */

    // IDLE
    if (step === "IDLE") {
      const services = await getShopServices(shopId);
      if (!services.length) {
        await safeSendSms({ to: from, from: to, shopName, body: "Aucune prestation disponible actuellement." });
        return;
      }

      await AssistantSmsSessionModel.updateOne(
        { _id: session._id },
        { $set: { step: "ASK_SERVICE", serviceId: null, proposedSlots: [] } }
      );

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body: `Bonjour 👋 Je suis Lizy, l'assistante de ${shopName || "ce salon"}.\nChoisissez une prestation :\n${formatServicesList(
          services
        )}\n\nRépondez avec un numéro (ex: "1").`,
      });
      return;
    }

    // ASK_SERVICE
    if (step === "ASK_SERVICE") {
      const services = await getShopServices(shopId);
      if (!services.length) {
        await safeSendSms({ to: from, from: to, shopName, body: "Aucune prestation disponible actuellement." });
        return;
      }

      const n = extractDigit(body, 1, Math.min(9, services.length));
      if (!n) {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: `Dites-moi le numéro de la prestation 🙂\n${formatServicesList(services)}\n\nEx: "1"`,
        });
        return;
      }

      const selected = services[n - 1];

      const slots = await computeAvailableSlots(shopId, String(selected._id));
      const top3 = slots.slice(0, 3);

      if (!top3.length) {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Désolé, aucun créneau disponible prochainement. Essayez une autre prestation.",
        });
        return;
      }

      await AssistantSmsSessionModel.updateOne(
        { _id: session._id },
        { $set: { step: "ASK_SLOT", serviceId: String(selected._id), proposedSlots: top3 } }
      );

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body: `Parfait ✅ Voici les prochains créneaux :\n${formatSlotsList(top3)}\n\nRépondez 1, 2 ou 3.`,
      });
      return;
    }

    // ASK_SLOT
    if (step === "ASK_SLOT") {
      const proposed = session.proposedSlots || [];
      if (!proposed.length || !session.serviceId) {
        await AssistantSmsSessionModel.updateOne({ _id: session._id }, { $set: { step: "IDLE", serviceId: null, proposedSlots: [] } });

        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Session expirée 🙂 Envoyez n'importe quel message pour recommencer.",
        });
        return;
      }

      const n = extractDigit(body, 1, Math.min(3, proposed.length));
      if (!n) {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: `Choisissez un créneau (1, 2 ou 3) :\n${formatSlotsList(proposed)}\n\nEx: "2"`,
        });
        return;
      }

      const chosen = proposed[n - 1];

      // ✅ On demande l'adresse avant paiement
      await AssistantSmsSessionModel.updateOne(
        { _id: session._id },
        { $set: { step: "ASK_ADDRESS", proposedSlots: [chosen] } } // chosen stocké en index 0
      );

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body:
          `Super ✅ Pour finaliser, j'ai besoin de votre adresse complète.\n` +
          `Ex: 12 rue de Paris, 75001 Paris\n\nRépondez avec votre adresse.`,
      });
      return;
    }

    // ASK_ADDRESS
    if (step === "ASK_ADDRESS") {
      const addr = norm(body);
      if (addr.length < 8) {
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Je n'ai pas bien reçu l'adresse 😅 Répondez avec une adresse complète (rue + code postal + ville).",
        });
        return;
      }

      const chosen = (session.proposedSlots && session.proposedSlots[0]) || null;
      if (!chosen || !session.serviceId) {
        await AssistantSmsSessionModel.updateOne({ _id: session._id }, { $set: { step: "IDLE", serviceId: null, proposedSlots: [] } });

        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Session expirée 🙂 Envoyez n'importe quel message pour recommencer.",
        });
        return;
      }

      // booking + checkout (✅ adresse client injectée)
      try {
        const r = await createBookingAndCheckout({
          shopId,
          serviceId: session.serviceId,
          fromPhone: from,
          slot: chosen,
          clientAddress: addr, // ✅ nécessite la modif du service (je te la fais juste après)
        } as any);

        await AssistantSmsSessionModel.updateOne(
          { _id: session._id },
          { $set: { step: "WAIT_PAYMENT", bookingId: r.bookingId, lastCheckoutUrl: r.checkoutUrl } }
        );

        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: `✅ Merci ! Pour confirmer et payer votre rendez-vous :\n${r.checkoutUrl}\n\nVous recevrez la confirmation après paiement.`,
        });
        return;
      } catch (e: any) {
        console.error("[twilio:sms] createBookingAndCheckout failed", dumpErr(e));
        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: "Oups 🙂 Ce créneau vient d'être pris. Répondez REPORTER pour choisir un autre créneau.",
        });
        return;
      }
    }

    // WAIT_PAYMENT
    if (step === "WAIT_PAYMENT") {
      // si le client envoie 1/2/3 ici => on interprète comme "changer de créneau"
      const n = extractDigit(body, 1, 3);
      if (n && session.serviceId) {
        const slots = await computeAvailableSlots(shopId, String(session.serviceId));
        const top3 = slots.slice(0, 3);

        if (!top3.length) {
          await safeSendSms({
            to: from,
            from: to,
            shopName,
            body: "Je n'ai pas d'autres créneaux pour le moment 😕 Réessayez plus tard ou contactez le professionnel.",
          });
          return;
        }

        await AssistantSmsSessionModel.updateOne({ _id: session._id }, { $set: { step: "ASK_SLOT", proposedSlots: top3 } });

        await safeSendSms({
          to: from,
          from: to,
          shopName,
          body: `OK ✅ Pour changer, choisissez un créneau :\n${formatSlotsList(top3)}\n\nRépondez 1, 2 ou 3.`,
        });
        return;
      }

      await safeSendSms({
        to: from,
        from: to,
        shopName,
        body:
          `Je vous ai envoyé le lien de paiement 🙂\n` +
          `Pour changer de créneau, répondez REPORTER.\n` +
          `Sinon cliquez ici :\n${session.lastCheckoutUrl || ""}`,
      });
      return;
    }

    // DONE (fallback)
    await safeSendSms({
      to: from,
      from: to,
      shopName,
      body: "Je peux vous aider à réserver 🙂 Envoyez n'importe quel message pour recommencer.",
    });
  } catch (e: any) {
    console.error("[twilio:sms] fatal error", dumpErr(e));
    try {
      await safeSendSms({
        to: normalizePhoneE164(norm((req.body as any)?.From)),
        from: normalizePhoneE164(norm((req.body as any)?.To)),
        shopName: undefined,
        body: "Une erreur est survenue 😕 Réessayez dans un instant.",
      });
    } catch {}
  }
};
