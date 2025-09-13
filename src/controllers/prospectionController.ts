import * as express from "express";
import mongoose from "mongoose";
import ProfessionalModel, { IProfessional } from "../models/professional";
import OutreachTaskModel, { IOutreachTask } from "../models/outreachTask";
import EventModel from "../models/event";

const nowISO = () => new Date().toISOString();

// ---------- LEADS (Professionals) ----------

// Upsert d'un lead "trouvé" (DISCOVERED/FOUND), dédup par source.ref ou site.
export const upsertFoundLead = async (req: express.Request, res: express.Response) => {
  try {
    const rec = req.body as Partial<IProfessional>;

    const ref = rec?.source?.ref;
    const site = rec?.channels?.website?.url?.trim();

    if (!ref && !site) {
      return res.status(400).json({ message: "Besoin de source.ref ou channels.website.url pour dédupliquer" });
    }

    const flt: any = ref ? { "source.ref": ref } : { "channels.website.url": site };
    const base: any = {
      fullName: rec.fullName,
      businessName: rec.businessName,
      language: rec.language,
      categories: rec.categories || [],
      tags: rec.tags || [],
      ownerAgent: rec.ownerAgent || "fetcher-places",
      doNotContact: !!rec.doNotContact,
      score: rec.score ?? 0,
      geo: rec.geo || {},
      channels: rec.channels || {},
      source: rec.source || {},
      status: rec.status || "DISCOVERED",
      updatedAt: nowISO(),
    };

    const update = {
      $set: base,
      $setOnInsert: { createdAt: nowISO() }
    };

    const doc = await ProfessionalModel.findOneAndUpdate(flt, update, { new: true, upsert: true }).lean();
    return res.status(200).json(doc);
  } catch (err: any) {
    // gestion conflit unique: on retente en update simple
    if (err?.code === 11000) {
      try {
        const ref = req.body?.source?.ref;
        const site = req.body?.channels?.website?.url?.trim();
        const flt: any = ref ? { "source.ref": ref } : { "channels.website.url": site };
        const doc = await ProfessionalModel.findOne(flt).lean();
        if (doc) return res.status(200).json(doc);
      } catch {}
    }
    return res.status(500).json({ message: "Impossible d'upsert le lead", error: String(err?.message || err) });
  }
};

// Liste de leads à ENRICHIR (DISCOVERED ou FOUND)
export const listToEnrich = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.max(0, parseInt(String(req.query.limit || "0"), 10) || 0);
    const q: any = { status: { $in: ["DISCOVERED", "FOUND"] } };
    const cur = ProfessionalModel.find(q).limit(limit);
    const docs = await cur.lean();
    return res.json(docs);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur listToEnrich", error: String(err?.message || err) });
  }
};

// Sauvegarder les infos ENRICHIES (status=ENRICHED)
export const saveEnriched = async (req: express.Request, res: express.Response) => {
  try {
    const data = req.body as Partial<IProfessional> & { _id?: string };
    const byId = data?._id && mongoose.isValidObjectId(data._id);

    const payload: any = {
      channels: data.channels || {},
      extras: data.extras || {},
      score: data.score ?? 0,
      status: "ENRICHED",
      enrichedAt: nowISO(),
      updatedAt: nowISO(),
    };

    let flt: any = null;
    if (byId) {
      flt = { _id: new mongoose.Types.ObjectId(data._id as string) };
    } else if (data?.source?.ref) {
      flt = { "source.ref": data.source.ref };
    } else if (data?.channels?.website?.url) {
      flt = { "channels.website.url": data.channels.website.url };
    } else {
      return res.status(400).json({ message: "Besoin de _id, source.ref ou channels.website.url" });
    }

    const doc = await ProfessionalModel.findOneAndUpdate(flt, { $set: payload }, { new: true, upsert: true }).lean();
    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur saveEnriched", error: String(err?.message || err) });
  }
};

// Liste à VÉRIFIER (status=ENRICHED)
export const listToVerify = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.max(0, parseInt(String(req.query.limit || "0"), 10) || 0);
    const docs = await ProfessionalModel.find({ status: "ENRICHED" }).limit(limit).lean();
    return res.json(docs);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur listToVerify", error: String(err?.message || err) });
  }
};

// Marquer VÉRIFIÉ (status=VERIFIED) + appliquer channels validés
export const markVerified = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body as { _id?: string; filter?: any; channels?: any };
    let flt: any = null;

    if (body._id && mongoose.isValidObjectId(body._id)) flt = { _id: new mongoose.Types.ObjectId(body._id) };
    else if (body.filter) flt = body.filter;
    else return res.status(400).json({ message: "Besoin de _id valide ou filter" });

    const payload: any = {
      channels: body.channels || {},
      status: "VERIFIED",
      verifiedAt: nowISO(),
      updatedAt: nowISO(),
    };
    const doc = await ProfessionalModel.findOneAndUpdate(flt, { $set: payload }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: "Lead introuvable" });
    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur markVerified", error: String(err?.message || err) });
  }
};

// Récupération générique / CRUD simple
export const getLead = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const doc = await ProfessionalModel.findById(id).lean();
    if (!doc) return res.status(404).json({ message: "Lead introuvable" });
    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur getLead", error: String(err?.message || err) });
  }
};

export const listLeads = async (_req: express.Request, res: express.Response) => {
  try {
    const docs = await ProfessionalModel.find({}).limit(500).lean();
    return res.json(docs);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur listLeads", error: String(err?.message || err) });
  }
};

// ---------- SÉQUENCE / TÂCHES D’OUTREACH ----------

// Liste des leads prêts pour séquence (status=VERIFIED)
export const listForSequence = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.max(0, parseInt(String(req.query.limit || "0"), 10) || 0);
    const docs = await ProfessionalModel.find({ status: "VERIFIED" }).limit(limit).lean();
    return res.json(docs);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur listForSequence", error: String(err?.message || err) });
  }
};

// Crée des tâches pour une séquence donnée
// body: { professionalId, steps: [{channel, template, wait_days}], seqName }
export const createSequenceTasks = async (req: express.Request, res: express.Response) => {
  try {
    const { professionalId, steps, seqName } = req.body as {
      professionalId: string;
      steps: Array<{ channel: "email" | "whatsapp"; template: string; wait_days: number }>;
      seqName: string;
    };
    if (!professionalId || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ message: "professionalId & steps requis" });
    }
    const pro = await ProfessionalModel.findById(professionalId).lean();
    if (!pro) return res.status(404).json({ message: "Lead introuvable" });

    const now = new Date();
    const tasks: Partial<IOutreachTask>[] = steps.map(st => ({
      professionalId: new mongoose.Types.ObjectId(professionalId),
      status: "QUEUED",
      channel: st.channel,
      template: st.template,
      seqName,
      nextAt: new Date(now.getTime() + st.wait_days * 24 * 3600 * 1000).toISOString(),
      createdAt: nowISO(),
      meta: {}
    }));

    const created = await OutreachTaskModel.insertMany(tasks);
    await ProfessionalModel.updateOne({ _id: professionalId }, {
      $set: {
        status: "QUEUED_FOR_OUTREACH",
        "sequence.name": seqName,
        "sequence.step": 0,
        "sequence.lastTouchAt": null,
        "sequence.nextActionAt": created[0]?.nextAt || nowISO(),
        "sequence.lastChannel": null,
        updatedAt: nowISO()
      }
    });

    return res.status(201).json({ created: created.length });
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur createSequenceTasks", error: String(err?.message || err) });
  }
};

// Récupérer des tâches en file d’attente (pour un sender)
export const listQueuedTasks = async (req: express.Request, res: express.Response) => {
  try {
    const channel = String(req.query.channel || "email") as "email" | "whatsapp";
    const limit = Math.max(0, parseInt(String(req.query.limit || "50"), 10) || 50);
    const now = nowISO();
    const tasks = await OutreachTaskModel.find({
      status: "QUEUED",
      channel,
      nextAt: { $lte: now }
    }).limit(limit).lean();
    return res.json(tasks);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur listQueuedTasks", error: String(err?.message || err) });
  }
};

// Marquer une tâche comme envoyée / erreur / skipped
export const updateTaskStatus = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { status, error } = req.body as { status: "SENT" | "ERROR" | "SKIPPED"; error?: string };
    if (!["SENT", "ERROR", "SKIPPED"].includes(status)) {
      return res.status(400).json({ message: "status invalide" });
    }
    const patch: any = { status, sentAt: status === "SENT" ? nowISO() : undefined, error };
    const doc = await OutreachTaskModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: "Task introuvable" });

    if (status === "SENT") {
      // Journalise l’événement
      await EventModel.create({
        professionalId: doc.professionalId,
        type: doc.channel === "email" ? "EMAIL_SENT" : "WHATSAPP_SENT",
        channel: doc.channel,
        payload: { template: doc.template, dry_run: false },
        at: nowISO()
      });
      // Met à jour le pro
      await ProfessionalModel.updateOne({ _id: doc.professionalId }, {
        $set: {
          status: "OUTREACHED",
          "sequence.lastTouchAt": nowISO(),
          "sequence.lastChannel": doc.channel
        }
      });
    }
    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur updateTaskStatus", error: String(err?.message || err) });
  }
};

// ---------- ÉVÉNEMENTS ----------

export const addEvent = async (req: express.Request, res: express.Response) => {
  try {
    const ev = await EventModel.create({
      professionalId: req.body.professionalId,
      type: req.body.type,
      channel: req.body.channel,
      payload: req.body.payload || {},
      at: req.body.at || nowISO()
    });
    return res.status(201).json(ev);
  } catch (err: any) {
    return res.status(500).json({ message: "Erreur addEvent", error: String(err?.message || err) });
  }
};
