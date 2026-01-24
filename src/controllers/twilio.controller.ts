// src/controllers/twilio.controller.ts
import { Request, Response } from "express";
import twilio from "twilio";
import mongoose from "mongoose";

import UserModel from "../models/user";
import ShopModel from "../models/shop";
import ServiceModel from "../models/service";
import ServiceCategoryModel from "../models/serviceCategory";
import AssistantSessionModel from "../models/assistantSession";

import { computeAvailableSlots } from "../services/availability.service";
import { createBookingAndCheckout } from "../services/assistantCheckout.service";
import { sendSms } from "../services/twilio.service";
import bookingModel from "../models/booking";
import SmsSessionModel from "../models/smsSession";
import { refundBookingIfNeeded } from "../services/stripeRefund.service";

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
      ? `https://izyglam.com/shop/${params.shopHandle.trim()}`
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
 * DTMF helpers
 * - # : retour (Twilio envoie souvent Digits="" quand tu appuies sur # seul)
 * - 0 : répéter
 */
function isBackDigit(d: string) {
  return d === "" || d === "#";
}
function isRepeatDigit(d: string) {
  return d === "0";
}
function digitToIndex(d: string) {
  const n = Number(d);
  if (!Number.isFinite(n)) return -1;
  return n - 1;
}

function absoluteUrl(path: string) {
  const base = (process.env.API_BASE_URL || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * =========
 * RENDERERS (menus stables depuis session)
 * =========
 */

async function renderCategoryMenu(twiml: any, session: any) {
  // On reconstruit la liste dans l'ordre exact proposé
  const ids: string[] = session.proposedCategoryIds || [];
  const objIds = ids.filter(mongoose.isValidObjectId).map((id) => new mongoose.Types.ObjectId(id));

  const categories: any[] = await ServiceCategoryModel.find({ _id: { $in: objIds } }).lean();
  const map = new Map(categories.map((c) => [String(c._id), c]));
  const ordered = ids.map((id) => map.get(id)).filter(Boolean);

  twiml.say({ language: "fr-FR" }, "Choisissez une catégorie. Tapez 1 à 9.");
  twiml.say({ language: "fr-FR" }, "Appuyez sur 0 pour répéter.");

  const actionUrl = absoluteUrl("/twilio/voice/category");
  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    finishOnKey: "#",
    action: actionUrl,
    method: "POST",
    timeout: 7,
  });

  ordered.forEach((c: any, idx: number) => {
    gather.say({ language: "fr-FR" }, `Pour ${c.name}, tapez ${idx + 1}.`);
  });

  twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
  twiml.hangup();
}

async function renderServiceMenu(twiml: any, session: any) {
  const ids: string[] = session.proposedServiceIds || [];
  const objIds = ids.filter(mongoose.isValidObjectId).map((id) => new mongoose.Types.ObjectId(id));

  const services: any[] = await ServiceModel.find({ _id: { $in: objIds } }).lean();
  const map = new Map(services.map((s) => [String(s._id), s]));
  const ordered = ids.map((id) => map.get(id)).filter(Boolean);

  twiml.say({ language: "fr-FR" }, "Choisissez une prestation. Tapez 1 à 9.");
  twiml.say({ language: "fr-FR" }, "Appuyez sur # pour revenir en arrière, ou 0 pour répéter.");

  const actionUrl = absoluteUrl("/twilio/voice/service");
  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    finishOnKey: "#",
    action: actionUrl,
    method: "POST",
    timeout: 7,
  });

  ordered.forEach((s: any, idx: number) => {
    gather.say({ language: "fr-FR" }, `Pour ${s.name}, tapez ${idx + 1}.`);
  });

  twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
  twiml.hangup();
}

async function renderSlotMenu(twiml: any, session: any) {
  const top3 = (session.proposedSlots || []).slice(0, 3);

  twiml.say({ language: "fr-FR" }, "Voici les prochains créneaux disponibles.");
  twiml.say({ language: "fr-FR" }, "Appuyez sur # pour revenir en arrière, ou 0 pour répéter.");

  const actionUrl = absoluteUrl("/twilio/voice/slot");
  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    finishOnKey: "#",
    action: actionUrl,
    method: "POST",
    timeout: 7,
  });

  top3.forEach((s: any, i: number) => {
    gather.say({ language: "fr-FR" }, `Pour ${saySlotFR(s.date, s.start)}, tapez ${i + 1}.`);
  });

  twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
  twiml.hangup();
}

/**
 * ===========================
 *           VOICE
 * ===========================
 */

function msSince(t0: number) {
  return Date.now() - t0;
}

function safeStr(v: any, max = 200) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (!s) return "";
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    const s = String(v ?? "");
    return s.length > max ? s.slice(0, max) + "…" : s;
  }
}

function logStep(tag: string, t0: number, data?: any) {
  const payload = data ? { ...data } : undefined;
  console.log(`[twilio][voice:entry][${tag}] +${msSince(t0)}ms`, payload || "");
}

function logErr(tag: string, t0: number, e: any, extra?: any) {
  console.error(`[twilio][voice:entry][${tag}] +${msSince(t0)}ms ERROR`, {
    ...extra,
    message: e?.message,
    name: e?.name,
    code: e?.code,
    status: e?.status,
    moreInfo: e?.moreInfo,
    stack: e?.stack,
  });
}

/**
 * 📞 Entrée appel => ASK_CATEGORY
 */
export const twilioVoiceEntry = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const to = norm((req.body as any)?.To);
  const from = norm((req.body as any)?.From);
  const callSid = norm((req.body as any)?.CallSid);

  console.log("[twilio][voice:entry] IN", {
    callSid,
    to,
    from,
    method: req.method,
    path: (req as any).originalUrl,
    contentType: req.headers["content-type"],
    userAgent: req.headers["user-agent"],
    host: req.headers["host"],
    bodyKeys: Object.keys(req.body || {}),
    // ⚠️ évite de log tout le body en prod, mais là ça t’aide à debugguer :
    bodyPreview: safeStr(req.body, 800),
  });

  try {
    logStep("lookup_pro:start", t0, { to });

    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();

    logStep("lookup_pro:done", t0, {
      found: !!pro,
      proId: pro?._id ? String(pro._id) : null,
      assistantProEnabled: !!pro?.assistantProEnabled,
      assistantShopId: pro?.assistantShopId ? String(pro.assistantShopId) : null,
      twilioPhoneNumber: pro?.twilioPhoneNumber || null,
    });

    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Bonjour. Ce numéro n'est pas disponible pour la prise de rendez-vous.");
      twiml.hangup();

      console.warn("[twilio][voice:entry] REJECT", {
        callSid,
        to,
        from,
        elapsedMs: msSince(t0),
        reason: !pro ? "PRO_NOT_FOUND" : !pro.assistantProEnabled ? "ASSISTANT_DISABLED" : "MISSING_SHOP_ID",
      });

      return res.type("text/xml").send(twiml.toString());
    }

    logStep("load_shop:start", t0, { shopId: String(pro.assistantShopId) });
    const shop: any = await ShopModel.findById(pro.assistantShopId).lean();
    logStep("load_shop:done", t0, {
      found: !!shop,
      shopName: shop?.name || null,
      shopId: shop?._id ? String(shop._id) : String(pro.assistantShopId),
    });

    // 1) services éligibles -> récupérer categoryId
    logStep("eligible_services:start", t0);
    const eligibleServices: any[] = await ServiceModel.find({
      shopId: pro.assistantShopId,
      blocked: { $ne: true },
      categoryId: { $exists: true, $ne: "" },
      $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
    })
      .select({ categoryId: 1 })
      .lean();

    logStep("eligible_services:done", t0, {
      count: eligibleServices.length,
      sample: eligibleServices.slice(0, 5).map((s) => ({
        _id: String(s?._id),
        categoryId: String(s?.categoryId || ""),
      })),
    });

    const rawCatIds = Array.from(new Set(eligibleServices.map((s) => String(s.categoryId)).filter(Boolean)));

    const invalidCatIds = rawCatIds.filter((id) => !mongoose.isValidObjectId(id));
    const validCatObjIds = rawCatIds
      .filter(mongoose.isValidObjectId)
      .map((id) => new mongoose.Types.ObjectId(id));

    logStep("categories:ids", t0, {
      rawCount: rawCatIds.length,
      validCount: validCatObjIds.length,
      invalidCount: invalidCatIds.length,
      invalidSample: invalidCatIds.slice(0, 10),
    });

    logStep("categories:query:start", t0, {
      shopId: String(pro.assistantShopId),
      limit: 9,
    });

    const categories: any[] = await ServiceCategoryModel.find({
      shopId: String(pro.assistantShopId),
      _id: { $in: validCatObjIds },
    })
      .sort({ order: 1, createdAt: 1 })
      .limit(9)
      .lean();

    logStep("categories:query:done", t0, {
      count: categories.length,
      list: categories.map((c) => ({ id: String(c._id), name: c.name })),
    });

    if (!categories.length) {
      twiml.say({ language: "fr-FR" }, "Aucune catégorie n'est disponible actuellement. Au revoir.");
      twiml.hangup();

      console.warn("[twilio][voice:entry] NO_CATEGORIES", {
        callSid,
        to,
        from,
        elapsedMs: msSince(t0),
        rawCatIdsCount: rawCatIds.length,
        validCatIdsCount: validCatObjIds.length,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    // session
    logStep("session:upsert:start", t0);
    await AssistantSessionModel.findOneAndUpdate(
      { callSid },
      {
        callSid,
        userProId: String(pro._id),
        shopId: String(pro.assistantShopId),
        fromPhone: from,
        step: "ASK_CATEGORY",
        proposedCategoryIds: categories.map((c) => String(c._id)),
        proposedServiceIds: [],
        proposedSlots: [],
        categoryId: null,
        serviceId: null,
      },
      { upsert: true }
    );
    logStep("session:upsert:done", t0);

    // twiml
    logStep("twiml:render:start", t0);
    twiml.say({ language: "fr-FR" }, `Bonjour. Je suis Lizy, l'assistante de ${shop?.name || "ce salon"}.`);
    await renderCategoryMenu(twiml, { proposedCategoryIds: categories.map((c) => String(c._id)) });
    logStep("twiml:render:done", t0);

    console.log("[twilio][voice:entry] OUT", {
      callSid,
      elapsedMs: msSince(t0),
    });

    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    logErr("catch", t0, e, { callSid, to, from });

    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();

    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * 📚 Choix catégorie
 */
export const twilioVoiceCategoryGather = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const callSid = norm((req.body as any)?.CallSid);
  const digitRaw = (req.body as any)?.Digits;
  const digit = digitRaw === undefined || digitRaw === null ? "" : String(digitRaw);

  console.log("[twilio][voice:category] IN", { callSid, digit });

  try {
    const session: any = await AssistantSessionModel.findOne({ callSid }).lean();
    if (!session || session.step !== "ASK_CATEGORY" || !session.proposedCategoryIds?.length) {
      twiml.say({ language: "fr-FR" }, "Session expirée. Veuillez rappeler.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    // Au début : # => on répète
    if (isBackDigit(digit) || isRepeatDigit(digit)) {
      await renderCategoryMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    const idx = digitToIndex(digit);
    if (idx < 0 || idx >= session.proposedCategoryIds.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Je répète.");
      await renderCategoryMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    const categoryId = session.proposedCategoryIds[idx];

    // Services de cette catégorie (limit 9)
    const services: any[] = await ServiceModel.find({
      shopId: session.shopId,
      categoryId,
      blocked: { $ne: true },
      $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
    })
      .sort({ createdAt: 1 })
      .limit(9)
      .lean();

    if (!services.length) {
      twiml.say({ language: "fr-FR" }, "Aucune prestation disponible dans cette catégorie. Je répète.");
      await renderCategoryMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    await AssistantSessionModel.updateOne(
      { callSid },
      {
        step: "ASK_SERVICE",
        categoryId,
        proposedServiceIds: services.map((s) => String(s._id)),
        serviceId: null,
        proposedSlots: [],
      }
    );

    // On affiche la liste des services (dans l'ordre proposé)
    await renderServiceMenu(twiml, {
      ...session,
      step: "ASK_SERVICE",
      proposedServiceIds: services.map((s) => String(s._id)),
    });

    console.log("[twilio][voice:category] OUT", { callSid, elapsedMs: nowMs() - t0 });
    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error("[twilio][voice:category] ERROR", dumpErr(e));
    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * 🧾 Choix prestation (voice) => ASK_SLOT
 */
export const twilioVoiceServiceGather = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const callSid = norm((req.body as any)?.CallSid);
  const digitRaw = (req.body as any)?.Digits;
  const digit = digitRaw === undefined || digitRaw === null ? "" : String(digitRaw);

  console.log("[twilio][voice:service] IN", { callSid, digit });

  try {
    const session: any = await AssistantSessionModel.findOne({ callSid }).lean();
    if (!session || session.step !== "ASK_SERVICE" || !session.proposedServiceIds?.length) {
      twiml.say({ language: "fr-FR" }, "Session expirée. Veuillez rappeler.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    // BACK => revenir aux catégories
    if (isBackDigit(digit)) {
      await AssistantSessionModel.updateOne(
        { callSid },
        { step: "ASK_CATEGORY", categoryId: null, serviceId: null, proposedServiceIds: [], proposedSlots: [] }
      );
      const updated = await AssistantSessionModel.findOne({ callSid }).lean();
      await renderCategoryMenu(twiml, updated);
      return res.type("text/xml").send(twiml.toString());
    }

    // REPEAT => répéter services
    if (isRepeatDigit(digit)) {
      await renderServiceMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    const idx = digitToIndex(digit);
    if (idx < 0 || idx >= session.proposedServiceIds.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Je répète.");
      await renderServiceMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    const serviceId = session.proposedServiceIds[idx];
    const selected: any = await ServiceModel.findById(serviceId).lean();

    if (!selected || selected.blocked) {
      twiml.say({ language: "fr-FR" }, "Prestation indisponible. Je répète.");
      await renderServiceMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    const slots = await computeAvailableSlots(String(session.shopId), String(selected._id));
    const top3 = slots.slice(0, 3);

    if (!top3.length) {
      twiml.say({ language: "fr-FR" }, "Aucun créneau disponible prochainement. Appuyez sur # pour revenir en arrière.");
      // On reste sur ASK_SERVICE, l'utilisateur peut revenir
      await renderServiceMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    await AssistantSessionModel.updateOne({ callSid }, { step: "ASK_SLOT", serviceId: String(selected._id), proposedSlots: top3 });

    await renderSlotMenu(twiml, { ...session, step: "ASK_SLOT", serviceId: String(selected._id), proposedSlots: top3 });

    console.log("[twilio][voice:service] OUT", { callSid, elapsedMs: nowMs() - t0 });
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

  const digitRaw = (req.body as any)?.Digits;
  const digit = digitRaw === undefined || digitRaw === null ? "" : String(digitRaw);

  console.log("[twilio][voice:slot] IN", { callSid, from, to, digit });

  try {
    const session: any = await AssistantSessionModel.findOne({ callSid }).lean();
    if (!session || session.step !== "ASK_SLOT" || !session.serviceId || !session.proposedSlots?.length) {
      twiml.say({ language: "fr-FR" }, "Session expirée. Veuillez rappeler.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    // BACK => revenir aux services
    if (isBackDigit(digit)) {
      await AssistantSessionModel.updateOne({ callSid }, { step: "ASK_SERVICE", serviceId: null, proposedSlots: [] });
      const updated = await AssistantSessionModel.findOne({ callSid }).lean();
      await renderServiceMenu(twiml, updated);
      return res.type("text/xml").send(twiml.toString());
    }

    // REPEAT => répéter créneaux
    if (isRepeatDigit(digit)) {
      await renderSlotMenu(twiml, session);
      return res.type("text/xml").send(twiml.toString());
    }

    const idx = digitToIndex(digit);
    if (idx < 0 || idx >= session.proposedSlots.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Je répète.");
      await renderSlotMenu(twiml, session);
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
  res.status(200).send("OK");

  const msgSid = norm((req.body as any)?.MessageSid);
  const to = normalizePhoneE164(norm((req.body as any)?.To));
  const from = normalizePhoneE164(norm((req.body as any)?.From));
  const bodyRaw = norm((req.body as any)?.Body);
  const body = bodyRaw.toUpperCase().trim();

  console.log("[twilio][sms] inbound", { msgSid, to, from, body: bodyRaw });

  const now = new Date();
  const H24_MS = 24 * 60 * 60 * 1000;

  const expiresAt10min = () => new Date(Date.now() + 10 * 60 * 1000);
  const smsKey = (fromPhone: string, toPhone: string) => `${fromPhone}|${toPhone}`;
  const isDigitChoice = (v: string) => /^[1-9]$/.test(v);
  const pickIndex = (v: string) => Number(v) - 1;

  try {
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();

    if (!pro || !pro.assistantShopId) {
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

    const shop: any = await ShopModel.findById(pro.assistantShopId).lean();
    const shopName = shop?.name || "ce salon";
    const shopType = shop?.type || "Salon";

    const shopPhone = shop?.twilioPhoneNumber || pro?.twilioPhoneNumber || to;
    const shopHandle = shop?.handle;
    const shopId = shop?._id ? String(shop._id) : String(pro.assistantShopId);

    const key = smsKey(from, shopPhone);

    // STOP / START
    if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body)) {
      await sendSms({
        to: from,
        from: shopPhone,
        body:
          "Vous ne recevrez plus de SMS de ce numéro.\n" +
          "⚠️ Attention : cela peut aussi bloquer les SMS liés à vos réservations.\n" +
          "Pour réactiver, répondez START.",
      });
      return;
    }
    if (body === "START") {
      await sendSms({
        to: from,
        from: shopPhone,
        body: "✅ C’est noté, vous pouvez à nouveau recevoir des SMS de ce numéro.",
      });
      return;
    }

    // AIDE
    if (body === "AIDE" || body === "HELP") {
      await sendSms({
        to: from,
        from: shopPhone,
        body: "Commandes disponibles :\n" + "• ANNULER : annuler une réservation (si plusieurs, je vous propose 1/2/3)\n",
      });
      return;
    }

    // CHOIX 1/2/3 si SELECT_CANCEL
    if (isDigitChoice(body)) {
      const session: any = await SmsSessionModel.findOne({ key }).lean();

      if (session && session.step === "SELECT_CANCEL" && Array.isArray(session.bookingIds) && session.bookingIds.length) {
        const idx = pickIndex(body);
        if (idx < 0 || idx >= session.bookingIds.length) {
          await sendSms({ to: from, from: shopPhone, body: "Choix invalide. Répondez 1, 2 ou 3." });
          return;
        }

        const selectedBookingId = session.bookingIds[idx];
        const booking: any = await bookingModel.findById(selectedBookingId).lean();

        if (!booking) {
          await SmsSessionModel.deleteOne({ key });
          await sendSms({
            to: from,
            from: shopPhone,
            body: "Je ne retrouve plus cette réservation. Répondez ANNULER pour recommencer.",
          });
          return;
        }

        if (String(booking.shopId) !== String(shopId) || booking.phoneNumber !== from) {
          await SmsSessionModel.deleteOne({ key });
          await sendSms({ to: from, from: shopPhone, body: "Impossible d’annuler cette réservation (sécurité)." });
          return;
        }

        await SmsSessionModel.findOneAndUpdate(
          { key },
          {
            key,
            fromPhone: from,
            toPhone: shopPhone,
            step: "CONFIRM_CANCEL",
            bookingIds: session.bookingIds,
            bookingId: selectedBookingId,
            expiresAt: expiresAt10min(),
          },
          { upsert: true }
        );

        const when = booking?.date || "votre rendez-vous";
        const title = booking?.title || "votre prestation";

        await sendSms({
          to: from,
          from: shopPhone,
          body:
            `⚠️ Confirmation d’annulation\n` + `Prestation : ${title}\n` + `Quand : ${when}\n\n` + `Répondez OUI pour confirmer l’annulation.`,
        });
        return;
      }
    }

    // ANNULER
    if (body === "ANNULER") {
      const bookings: any[] = await bookingModel
        .find({
          shopId: shopId,
          phoneNumber: from,
          status: { $in: ["pending", "accepted"] },
          start: { $gt: now },
        })
        .sort({ start: 1 })
        .limit(3)
        .lean();

      if (!bookings.length) {
        await sendSms({
          to: from,
          from: shopPhone,
          body: "Je ne trouve pas de réservation à annuler pour ce numéro.\nSi besoin, répondez AIDE.",
        });
        return;
      }

      if (bookings.length === 1) {
        const b = bookings[0];
        await SmsSessionModel.findOneAndUpdate(
          { key },
          {
            key,
            fromPhone: from,
            toPhone: shopPhone,
            step: "CONFIRM_CANCEL",
            bookingIds: [String(b._id)],
            bookingId: String(b._id),
            expiresAt: expiresAt10min(),
          },
          { upsert: true }
        );

        await sendSms({
          to: from,
          from: shopPhone,
          body:
            `⚠️ Confirmation d’annulation\n` +
            `Prestation : ${b?.title || "Prestation"}\n` +
            `Quand : ${b?.date || "Date à confirmer"}\n\n` +
            `Répondez OUI pour confirmer l’annulation.`,
        });
        return;
      }

      await SmsSessionModel.findOneAndUpdate(
        { key },
        {
          key,
          fromPhone: from,
          toPhone: shopPhone,
          step: "SELECT_CANCEL",
          bookingIds: bookings.map((b) => String(b._id)),
          bookingId: null,
          expiresAt: expiresAt10min(),
        },
        { upsert: true }
      );

      let msg = "📌 Plusieurs réservations trouvées.\nRépondez avec 1, 2 ou 3 :\n\n";
      bookings.forEach((b, i) => {
        msg += `${i + 1}) ${b?.title || "Prestation"} — ${b?.date || "Date à confirmer"}\n`;
      });

      await sendSms({ to: from, from: shopPhone, body: msg.trim() });
      return;
    }

    // OUI => on applique la règle 24h + refund (si payé)
    if (body === "OUI") {
      const smsSession: any = await SmsSessionModel.findOne({ key }).lean();

      if (!smsSession || smsSession.step !== "CONFIRM_CANCEL" || !smsSession.bookingId) {
        await sendSms({
          to: from,
          from: shopPhone,
          body: "Je n’ai aucune annulation en attente.\nPour annuler un rendez-vous, répondez ANNULER.",
        });
        return;
      }

      const bookingIdToCancel = smsSession.bookingId;

      const booking: any = await bookingModel.findById(bookingIdToCancel).lean();
      if (!booking) {
        await SmsSessionModel.deleteOne({ key });
        await sendSms({
          to: from,
          from: shopPhone,
          body: "Je ne retrouve plus cette réservation. Répondez ANNULER si besoin.",
        });
        return;
      }

      // sécurité
      if (String(booking.shopId) !== String(shopId) || booking.phoneNumber !== from) {
        await SmsSessionModel.deleteOne({ key });
        await sendSms({ to: from, from: shopPhone, body: "Impossible d’annuler cette réservation (sécurité)." });
        return;
      }

      if (!["pending", "accepted"].includes(booking.status)) {
        await SmsSessionModel.deleteOne({ key });
        await sendSms({ to: from, from: shopPhone, body: "Cette réservation ne peut plus être annulée." });
        return;
      }

      const start = new Date(booking.start);
      const diff = start.getTime() - now.getTime();

      // ✅ règle : pas annulable < 24h
      if (!Number.isFinite(diff) || diff < H24_MS) {
        await SmsSessionModel.deleteOne({ key });
        await sendSms({
          to: from,
          from: shopPhone,
          body:
            "⛔️ Annulation impossible à moins de 24h du rendez-vous.\n" +
            "Des frais peuvent s’appliquer selon la politique du salon.\n" +
            "Pour toute demande urgente, contactez directement le salon.",
        });
        return;
      }

      // ✅ SI PAS PAYÉ (webhook en retard / test / paiement non confirmé) => on annule localement SANS refund
      const paymentIntentId = String(booking.paymentIntentId || "").trim();
      if (!paymentIntentId) {
        console.warn("[twilio][sms][cancel] booking_unpaid_skip_refund", {
          bookingId: String(booking._id),
          status: booking.status,
          paymentIntentId: "",
          refundId: String(booking.refundId || ""),
        });

        await bookingModel.updateOne(
          { _id: bookingIdToCancel },
          {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelSource: "sms",
            cancelReason: "customer_sms_unpaid",

            serviceFee: "0",
            commission: "0",
            shopEarnings: "0",
          }
        );

        await SmsSessionModel.deleteOne({ key });

        await sendSms({
          to: from,
          from: shopPhone,
          body:
            "✅ Réservation annulée.\n" +
            "Aucun paiement n’avait été confirmé, donc aucun remboursement n’est nécessaire.\n" +
            "Merci de nous avoir prévenus.",
        });
        return;
      }

      // ✅ SI PAYÉ => refund Stripe idempotent + tracking
      let refundId: string | undefined;
      try {
        const refundRes: any = await refundBookingIfNeeded({ bookingId: String(booking._id) });
        refundId = refundRes?.refundId;

        console.log("[twilio][sms][cancel] refund_result", {
          bookingId: String(booking._id),
          paymentIntentId,
          refunded: !!refundRes?.refunded,
          skipped: !!refundRes?.skipped,
          reason: refundRes?.reason,
          refundId: refundRes?.refundId,
        });
      } catch (e: any) {
        console.error("[twilio][sms][cancel] refund_failed", {
          bookingId: String(booking._id),
          paymentIntentId,
          error: dumpErr(e),
        });

        await SmsSessionModel.deleteOne({ key });
        await sendSms({
          to: from,
          from: shopPhone,
          body:
            "⚠️ Je n’ai pas pu finaliser l’annulation automatiquement (problème remboursement).\n" +
            "Merci de contacter le support ou le salon.",
        });
        return;
      }

      // 2) update booking (cancel + reset finance + refund tracking)
      await bookingModel.updateOne(
        { _id: bookingIdToCancel },
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelSource: "sms",
          cancelReason: "customer_sms",

          // ✅ remise à zéro
          serviceFee: "0",
          commission: "0",
          shopEarnings: "0",

          // refund tracking (si pas déjà)
          refundId: refundId,
          refundedAt: new Date(),
        }
      );

      await SmsSessionModel.deleteOne({ key });

      await sendSms({
        to: from,
        from: shopPhone,
        body:
          "✅ Réservation annulée.\n" +
          "Le remboursement a été lancé et apparaîtra prochainement sur votre compte.\n" +
          "Merci de nous avoir prévenus.",
      });
      return;
    }

    // DEFAULT
    const reply = buildAutoReplySms({
      shopName,
      shopType,
      shopHandle,
      shopId,
      phoneNumber: shopPhone,
    });

    await sendSms({ to: from, from: shopPhone, body: reply });
  } catch (e: any) {
    console.error("[twilio][sms] ERROR", dumpErr(e));
  }
};
