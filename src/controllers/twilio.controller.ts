import { Request, Response } from "express";
import twilio from "twilio";
import UserModel from "../models/user";
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

function logPrefix(callSid?: string) {
  return callSid ? `[twilio][callSid:${callSid}]` : `[twilio]`;
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

function dumpReq(req: Request) {
  // Twilio envoie en x-www-form-urlencoded. On log les champs pertinents.
  return {
    path: req.path,
    method: req.method,
    callSid: norm((req.body as any)?.CallSid),
    from: norm((req.body as any)?.From),
    to: norm((req.body as any)?.To),
    digits: norm((req.body as any)?.Digits),
    speechResult: norm((req.body as any)?.SpeechResult),
    confidence: (req.body as any)?.Confidence,
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
    console.log(`${logPrefix(callSid)} voice:entry lookup pro by twilioPhoneNumber`, { to });

    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();
    console.log(`${logPrefix(callSid)} voice:entry pro result`, {
      found: !!pro,
      proId: pro?._id,
      assistantProEnabled: pro?.assistantProEnabled,
      assistantShopId: pro?.assistantShopId,
      twilioPhoneNumber: pro?.twilioPhoneNumber,
    });

    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Bonjour. Ce numéro n'est pas disponible pour la prise de rendez-vous.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:entry REJECT`, {
        reason: !pro ? "PRO_NOT_FOUND" : "ASSISTANT_NOT_ENABLED_OR_NO_SHOP",
        to,
        from,
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    console.log(`${logPrefix(callSid)} voice:entry upsert session`, {
      callSid,
      userProId: String(pro._id),
      shopId: pro.assistantShopId,
      fromPhone: from,
      step: "ASK_SERVICE",
    });

    await AssistantSessionModel.findOneAndUpdate(
      { callSid },
      {
        callSid,
        userProId: String(pro._id),
        shopId: pro.assistantShopId,
        fromPhone: from,
        step: "ASK_SERVICE",
      },
      { upsert: true }
    );

    console.log(`${logPrefix(callSid)} voice:entry fetch services`, {
      shopId: pro.assistantShopId,
    });

    const services: any[] = await ServiceModel.find({
      shopId: pro.assistantShopId,
      blocked: { $ne: true },
      $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
    })
      .sort({ createdAt: 1 })
      .limit(9)
      .lean();

    console.log(`${logPrefix(callSid)} voice:entry services found`, {
      count: services.length,
      serviceIds: services.map((s) => String(s._id)),
      serviceNames: services.map((s) => s.name),
    });

    if (!services.length) {
      twiml.say({ language: "fr-FR" }, "Aucune prestation n'est disponible actuellement. Au revoir.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:entry NO_SERVICES`, {
        shopId: pro.assistantShopId,
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    twiml.say({ language: "fr-FR" }, "Bonjour. Choisissez une prestation.");

    const gather = twiml.gather({
      numDigits: 1,
      action: "/twilio/voice/service",
      method: "POST",
      timeout: 7,
    });

    services.forEach((s, idx) => {
      gather.say({ language: "fr-FR" }, `Pour ${s.name}, tapez ${idx + 1}.`);
    });

    twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
    twiml.hangup();

    console.log(`${logPrefix(callSid)} voice:entry OUT`, {
      elapsedMs: nowMs() - t0,
      nextAction: "/twilio/voice/service",
      servicesCount: services.length,
    });

    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error(`${logPrefix(callSid)} voice:entry ERROR`, dumpErr(e));

    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * 🧾 Choix prestation
 */
export const twilioVoiceServiceGather = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const to = norm((req.body as any)?.To);
  const from = norm((req.body as any)?.From);
  const callSid = norm((req.body as any)?.CallSid);
  const digit = norm((req.body as any)?.Digits);

  console.log(`${logPrefix(callSid)} voice:service IN`, safeJson(dumpReq(req)));

  try {
    console.log(`${logPrefix(callSid)} voice:service lookup pro`, { to });
    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();

    console.log(`${logPrefix(callSid)} voice:service pro result`, {
      found: !!pro,
      proId: pro?._id,
      assistantProEnabled: pro?.assistantProEnabled,
      assistantShopId: pro?.assistantShopId,
    });

    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Ce numéro n'est pas disponible.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:service REJECT`, {
        reason: !pro ? "PRO_NOT_FOUND" : "ASSISTANT_NOT_ENABLED_OR_NO_SHOP",
        to,
        from,
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    console.log(`${logPrefix(callSid)} voice:service fetch services`, {
      shopId: pro.assistantShopId,
    });

    const services: any[] = await ServiceModel.find({
      shopId: pro.assistantShopId,
      blocked: { $ne: true },
      $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
    })
      .sort({ createdAt: 1 })
      .limit(9)
      .lean();

    console.log(`${logPrefix(callSid)} voice:service services found`, {
      count: services.length,
      digit,
    });

    const idx = Number(digit) - 1;
    console.log(`${logPrefix(callSid)} voice:service parse digit`, { digit, idx });

    if (!Number.isFinite(idx) || idx < 0 || idx >= services.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Au revoir.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:service INVALID_DIGIT`, {
        digit,
        servicesCount: services.length,
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    const selected = services[idx];
    console.log(`${logPrefix(callSid)} voice:service selected`, {
      selectedId: String(selected._id),
      selectedName: selected.name,
      selectedDuration: selected.duration,
      selectedPrice: selected.price,
      shopId: pro.assistantShopId,
    });

    const tSlots = nowMs();
    const slots = await computeAvailableSlots(pro.assistantShopId, String(selected._id));
    console.log(`${logPrefix(callSid)} voice:service slots computed`, {
      elapsedMs: nowMs() - tSlots,
      totalSlots: slots.length,
      first3: slots.slice(0, 3),
    });

    const top3 = slots.slice(0, 3);

    if (!top3.length) {
      twiml.say({ language: "fr-FR" }, "Aucun créneau disponible prochainement. Au revoir.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:service NO_SLOTS`, {
        shopId: pro.assistantShopId,
        serviceId: String(selected._id),
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    console.log(`${logPrefix(callSid)} voice:service update session`, {
      callSid,
      step: "ASK_SLOT",
      serviceId: String(selected._id),
      proposedSlotsCount: top3.length,
    });

    await AssistantSessionModel.findOneAndUpdate(
      { callSid },
      {
        step: "ASK_SLOT",
        serviceId: String(selected._id),
        proposedSlots: top3,
      },
      { upsert: true }
    );

    twiml.say({ language: "fr-FR" }, "Voici les prochains créneaux disponibles.");

    const gather = twiml.gather({
      numDigits: 1,
      action: "/twilio/voice/slot",
      method: "POST",
      timeout: 7,
    });

    top3.forEach((s, i) => {
      gather.say({ language: "fr-FR" }, `Pour ${saySlotFR(s.date, s.start)}, tapez ${i + 1}.`);
    });

    twiml.say({ language: "fr-FR" }, "Je n'ai pas reçu votre choix. Au revoir.");
    twiml.hangup();

    console.log(`${logPrefix(callSid)} voice:service OUT`, {
      elapsedMs: nowMs() - t0,
      nextAction: "/twilio/voice/slot",
      proposedSlots: top3,
    });

    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error(`${logPrefix(callSid)} voice:service ERROR`, dumpErr(e));

    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};

/**
 * ⏰ Choix créneau + SMS paiement
 */
export const twilioVoiceSlotGather = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();
  const t0 = nowMs();

  const callSid = norm((req.body as any)?.CallSid);
  const from = norm((req.body as any)?.From); // client
  const to = norm((req.body as any)?.To);     // numéro Twilio du pro
  const digit = norm((req.body as any)?.Digits);

  console.log(`${logPrefix(callSid)} voice:slot IN`, safeJson(dumpReq(req)));

  try {
    console.log(`${logPrefix(callSid)} voice:slot load session`, { callSid });

    const session: any = await AssistantSessionModel.findOne({ callSid }).lean();

    console.log(`${logPrefix(callSid)} voice:slot session`, {
      found: !!session,
      step: session?.step,
      shopId: session?.shopId,
      serviceId: session?.serviceId,
      proposedSlotsCount: session?.proposedSlots?.length,
    });

    if (!session || session.step !== "ASK_SLOT" || !session.serviceId || !session.proposedSlots?.length) {
      twiml.say({ language: "fr-FR" }, "Session expirée. Veuillez rappeler.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:slot SESSION_INVALID`, {
        reason: !session ? "NO_SESSION" : "BAD_STEP_OR_MISSING_DATA",
        expectedStep: "ASK_SLOT",
        actualStep: session?.step,
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    const idx = Number(digit) - 1;
    console.log(`${logPrefix(callSid)} voice:slot parse digit`, { digit, idx });

    if (!Number.isFinite(idx) || idx < 0 || idx >= session.proposedSlots.length) {
      twiml.say({ language: "fr-FR" }, "Choix invalide. Au revoir.");
      twiml.hangup();

      console.warn(`${logPrefix(callSid)} voice:slot INVALID_DIGIT`, {
        digit,
        proposedSlotsCount: session.proposedSlots.length,
        elapsedMs: nowMs() - t0,
      });

      return res.type("text/xml").send(twiml.toString());
    }

    const chosen = session.proposedSlots[idx];
    console.log(`${logPrefix(callSid)} voice:slot chosen`, { chosen });

    const tCheckout = nowMs();
    const { checkoutUrl, bookingId } = await createBookingAndCheckout({
      shopId: session.shopId,
      serviceId: session.serviceId,
      fromPhone: from,
      slot: chosen,
    });

    console.log(`${logPrefix(callSid)} voice:slot checkout created`, {
      elapsedMs: nowMs() - tCheckout,
      bookingId,
      checkoutUrlPresent: !!checkoutUrl,
    });

    // ✅ SMS envoyé depuis le numéro Twilio DU PRO
    const tSms = nowMs();
    try {
      const r = await sendSms({
        to: from,
        from: to,
        body: `IzyGlam : pour confirmer et payer votre rendez-vous, cliquez ici : ${checkoutUrl}`,
      });

      console.log(`${logPrefix(callSid)} twilio:sms sent`, {
        elapsedMs: nowMs() - tSms,
        sid: r.sid,
        status: r.status,
        to: from,
        from: to,
      });
    } catch (e: any) {
      console.error(`${logPrefix(callSid)} twilio:sms FAILED`, {
        elapsedMs: nowMs() - tSms,
        to: from,
        from: to,
        ...dumpErr(e),
      });
      throw e;
    }

    console.log(`${logPrefix(callSid)} voice:slot update session DONE`);
    await AssistantSessionModel.updateOne({ callSid }, { step: "DONE" });

    twiml.say({ language: "fr-FR" }, "Parfait. Je vous envoie un SMS pour confirmer et payer.");
    twiml.say({ language: "fr-FR" }, "Au revoir.");
    twiml.hangup();

    console.log(`${logPrefix(callSid)} voice:slot OUT`, {
      elapsedMs: nowMs() - t0,
      bookingId,
    });

    return res.type("text/xml").send(twiml.toString());
  } catch (e: any) {
    console.error(`${logPrefix(callSid)} voice:slot ERROR`, dumpErr(e));

    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};
