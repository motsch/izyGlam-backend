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

/**
 * 📞 Entrée appel
 */
export const twilioVoiceEntry = async (req: Request, res: Response) => {
  const twiml = new VoiceResponse();

  try {
    const to = norm(req.body.To);       // numéro Twilio du pro
    const from = norm(req.body.From);   // numéro client
    const callSid = norm(req.body.CallSid);

    const pro: any = await UserModel.findOne({ twilioPhoneNumber: to }).lean();
    if (!pro || !pro.assistantProEnabled || !pro.assistantShopId) {
      twiml.say({ language: "fr-FR" }, "Bonjour. Ce numéro n'est pas disponible pour la prise de rendez-vous.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

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

    return res.type("text/xml").send(twiml.toString());
  } catch {
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

  try {
    const to = norm(req.body.To);
    const callSid = norm(req.body.CallSid);
    const digit = norm(req.body.Digits);

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
    const slots = await computeAvailableSlots(pro.assistantShopId, String(selected._id));
    const top3 = slots.slice(0, 3);

    if (!top3.length) {
      twiml.say({ language: "fr-FR" }, "Aucun créneau disponible prochainement. Au revoir.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

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

    return res.type("text/xml").send(twiml.toString());
  } catch {
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

  try {
    const callSid = norm(req.body.CallSid);
    const from = norm(req.body.From); // client
    const to = norm(req.body.To);     // numéro Twilio du pro
    const digit = norm(req.body.Digits);

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

    const { checkoutUrl } = await createBookingAndCheckout({
      shopId: session.shopId,
      serviceId: session.serviceId,
      fromPhone: from,
      slot: chosen,
    });

    // ✅ SMS envoyé depuis le numéro Twilio DU PRO
    await sendSms({
      to: from,
      from: to,
      body: `IzyGlam : pour confirmer et payer votre rendez-vous, cliquez ici : ${checkoutUrl}`,
    });

    await AssistantSessionModel.updateOne({ callSid }, { step: "DONE" });

    twiml.say({ language: "fr-FR" }, "Parfait. Je vous envoie un SMS pour confirmer et payer.");
    twiml.say({ language: "fr-FR" }, "Au revoir.");
    twiml.hangup();

    return res.type("text/xml").send(twiml.toString());
  } catch {
    twiml.say({ language: "fr-FR" }, "Une erreur est survenue. Au revoir.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }
};
