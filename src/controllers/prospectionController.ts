import * as express from "express";
import mongoose from "mongoose";
import { logger } from "../utils/logger";
import ProfessionalModel, { IProfessional } from "../models/professional";
import OutreachTaskModel, { IOutreachTask } from "../models/outreachTask";
import EventModel from "../models/event";

const nowISO = () => new Date().toISOString();

// ---------- LEADS (Professionals) ----------

// Upsert d'un lead "trouvé" (DISCOVERED/FOUND), dédup par source.ref ou site.
export const upsertFoundLead = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.upsertFoundLead.request",
      route: "POST /prospection/lead/upsert-found",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

    const rec = req.body as Partial<IProfessional>;
    const ref = rec?.source?.ref;
    const site = rec?.channels?.website?.url?.trim();

    if (!ref && !site) {
      logger.warn({
        msg: "prospection.upsertFoundLead.bad_request",
        reason: "missing ref or website",
      });
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

    logger.info({
      msg: "prospection.upsertFoundLead.success",
      id: doc?._id?.toString(),
      dedupKey: ref || site,
      durationMs: Date.now() - t0,
    });

    return res.status(200).json(doc);
  } catch (err: any) {
    if (err?.code === 11000) {
      try {
        const ref = req.body?.source?.ref;
        const site = req.body?.channels?.website?.url?.trim();
        const flt: any = ref ? { "source.ref": ref } : { "channels.website.url": site };
        const doc = await ProfessionalModel.findOne(flt).lean();

        logger.warn({
          msg: "prospection.upsertFoundLead.duplicate_recovered",
          dedupKey: ref || site,
        });

        if (doc) return res.status(200).json(doc);
      } catch (inner: any) {
        logger.error({
          msg: "prospection.upsertFoundLead.duplicate_recovery_failed",
          errorName: inner?.name,
          errorMessage: inner?.message,
          stack: inner?.stack,
        });
      }
    }

    logger.error({
      msg: "prospection.upsertFoundLead.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Impossible d'upsert le lead", error: String(err?.message || err) });
  }
};

// Liste de leads à ENRICHIR (DISCOVERED ou FOUND)
export const listToEnrich = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.listToEnrich.request",
      route: "GET /prospection/leads/to-enrich",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
    });

    const limit = Math.max(0, parseInt(String(req.query.limit || "0"), 10) || 0);
    const q: any = { status: { $in: ["DISCOVERED", "FOUND"] } };
    const cur = ProfessionalModel.find(q).limit(limit);
    const docs = await cur.lean();

    logger.info({
      msg: "prospection.listToEnrich.success",
      count: docs.length,
      durationMs: Date.now() - t0,
    });

    return res.json(docs);
  } catch (err: any) {
    logger.error({
      msg: "prospection.listToEnrich.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur listToEnrich", error: String(err?.message || err) });
  }
};

// Sauvegarder les infos ENRICHIES (status=ENRICHED)
export const saveEnriched = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.saveEnriched.request",
      route: "POST /prospection/lead/save-enriched",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

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
      logger.warn({
        msg: "prospection.saveEnriched.bad_request",
        reason: "missing _id/ref/website",
      });
      return res.status(400).json({ message: "Besoin de _id, source.ref ou channels.website.url" });
    }

    const doc = await ProfessionalModel.findOneAndUpdate(flt, { $set: payload }, { new: true, upsert: true }).lean();

    logger.info({
      msg: "prospection.saveEnriched.success",
      id: doc?._id?.toString(),
      durationMs: Date.now() - t0,
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "prospection.saveEnriched.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur saveEnriched", error: String(err?.message || err) });
  }
};

// Liste à VÉRIFIER (status=ENRICHED)
export const listToVerify = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.listToVerify.request",
      route: "GET /prospection/leads/to-verify",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
    });

    const limit = Math.max(0, parseInt(String(req.query.limit || "0"), 10) || 0);
    const docs = await ProfessionalModel.find({ status: "ENRICHED" }).limit(limit).lean();

    logger.info({
      msg: "prospection.listToVerify.success",
      count: docs.length,
      durationMs: Date.now() - t0,
    });

    return res.json(docs);
  } catch (err: any) {
    logger.error({
      msg: "prospection.listToVerify.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur listToVerify", error: String(err?.message || err) });
  }
};

// Marquer VÉRIFIÉ (status=VERIFIED) + appliquer channels validés
export const markVerified = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.markVerified.request",
      route: "POST /prospection/lead/mark-verified",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

    const body = req.body as { _id?: string; filter?: any; channels?: any };
    let flt: any = null;

    if (body._id && mongoose.isValidObjectId(body._id)) flt = { _id: new mongoose.Types.ObjectId(body._id) };
    else if (body.filter) flt = body.filter;
    else {
      logger.warn({
        msg: "prospection.markVerified.bad_request",
        reason: "missing _id or filter",
      });
      return res.status(400).json({ message: "Besoin de _id valide ou filter" });
    }

    const payload: any = {
      channels: body.channels || {},
      status: "VERIFIED",
      verifiedAt: nowISO(),
      updatedAt: nowISO(),
    };
    const doc = await ProfessionalModel.findOneAndUpdate(flt, { $set: payload }, { new: true }).lean();
    if (!doc) {
      logger.warn({
        msg: "prospection.markVerified.not_found",
      });
      return res.status(404).json({ message: "Lead introuvable" });
    }

    logger.info({
      msg: "prospection.markVerified.success",
      id: doc?._id?.toString(),
      durationMs: Date.now() - t0,
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "prospection.markVerified.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur markVerified", error: String(err?.message || err) });
  }
};

// Récupération générique / CRUD simple
export const getLead = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.getLead.request",
      route: "GET /prospection/leads/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { id } = req.params;
    const doc = await ProfessionalModel.findById(id).lean();
    if (!doc) {
      logger.warn({
        msg: "prospection.getLead.not_found",
        id,
      });
      return res.status(404).json({ message: "Lead introuvable" });
    }

    logger.info({
      msg: "prospection.getLead.success",
      id,
      durationMs: Date.now() - t0,
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "prospection.getLead.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur getLead", error: String(err?.message || err) });
  }
};

export const listLeads = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.listLeads.request",
      route: "GET /prospection/leads",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
    });

    const docs = await ProfessionalModel.find({}).limit(500).lean();

    logger.info({
      msg: "prospection.listLeads.success",
      count: docs.length,
      durationMs: Date.now() - t0,
    });

    return res.json(docs);
  } catch (err: any) {
    logger.error({
      msg: "prospection.listLeads.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur listLeads", error: String(err?.message || err) });
  }
};

// ---------- SÉQUENCE / TÂCHES D’OUTREACH ----------

// Liste des leads prêts pour séquence (status=VERIFIED)
export const listForSequence = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.listForSequence.request",
      route: "GET /prospection/leads/for-sequence",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
    });

    const limit = Math.max(0, parseInt(String(req.query.limit || "0"), 10) || 0);
    const docs = await ProfessionalModel.find({ status: "VERIFIED" }).limit(limit).lean();

    logger.info({
      msg: "prospection.listForSequence.success",
      count: docs.length,
      durationMs: Date.now() - t0,
    });

    return res.json(docs);
  } catch (err: any) {
    logger.error({
      msg: "prospection.listForSequence.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur listForSequence", error: String(err?.message || err) });
  }
};

// Crée des tâches pour une séquence donnée
// body: { professionalId, steps: [{channel, template, wait_days}], seqName }
export const createSequenceTasks = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.createSequenceTasks.request",
      route: "POST /prospection/tasks/sequence",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { professionalId, steps, seqName } = req.body as {
      professionalId: string;
      steps: Array<{ channel: "email" | "whatsapp"; template: string; wait_days: number }>;
      seqName: string;
    };
    if (!professionalId || !Array.isArray(steps) || steps.length === 0) {
      logger.warn({
        msg: "prospection.createSequenceTasks.bad_request",
        reason: "missing professionalId or steps",
      });
      return res.status(400).json({ message: "professionalId & steps requis" });
    }
    const pro = await ProfessionalModel.findById(professionalId).lean();
    if (!pro) {
      logger.warn({
        msg: "prospection.createSequenceTasks.lead_not_found",
        professionalId,
      });
      return res.status(404).json({ message: "Lead introuvable" });
    }

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

    logger.info({
      msg: "prospection.createSequenceTasks.success",
      professionalId,
      seqName,
      createdCount: created.length,
      durationMs: Date.now() - t0,
    });

    return res.status(201).json({ created: created.length });
  } catch (err: any) {
    logger.error({
      msg: "prospection.createSequenceTasks.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur createSequenceTasks", error: String(err?.message || err) });
  }
};

// Récupérer des tâches en file d’attente (pour un sender)
export const listQueuedTasks = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.listQueuedTasks.request",
      route: "GET /prospection/tasks/queued",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
    });

    const channel = String(req.query.channel || "email") as "email" | "whatsapp";
    const limit = Math.max(0, parseInt(String(req.query.limit || "50"), 10) || 50);
    const now = nowISO();
    const tasks = await OutreachTaskModel.find({
      status: "QUEUED",
      channel,
      nextAt: { $lte: now }
    }).limit(limit).lean();

    logger.info({
      msg: "prospection.listQueuedTasks.success",
      count: tasks.length,
      channel,
      durationMs: Date.now() - t0,
    });

    return res.json(tasks);
  } catch (err: any) {
    logger.error({
      msg: "prospection.listQueuedTasks.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur listQueuedTasks", error: String(err?.message || err) });
  }
};

// Marquer une tâche comme envoyée / erreur / skipped
export const updateTaskStatus = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.updateTaskStatus.request",
      route: "POST /prospection/tasks/:id/status",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { id } = req.params;
    const { status, error } = req.body as { status: "SENT" | "ERROR" | "SKIPPED"; error?: string };
    if (!["SENT", "ERROR", "SKIPPED"].includes(status)) {
      logger.warn({
        msg: "prospection.updateTaskStatus.bad_request",
        reason: "invalid status",
        got: status,
      });
      return res.status(400).json({ message: "status invalide" });
    }
    const patch: any = { status, sentAt: status === "SENT" ? nowISO() : undefined, error };
    const doc = await OutreachTaskModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!doc) {
      logger.warn({
        msg: "prospection.updateTaskStatus.not_found",
        id,
      });
      return res.status(404).json({ message: "Task introuvable" });
    }

    if (status === "SENT") {
      await EventModel.create({
        professionalId: doc.professionalId,
        type: doc.channel === "email" ? "EMAIL_SENT" : "WHATSAPP_SENT",
        channel: doc.channel,
        payload: { template: doc.template, dry_run: false },
        at: nowISO()
      });
      await ProfessionalModel.updateOne({ _id: doc.professionalId }, {
        $set: {
          status: "OUTREACHED",
          "sequence.lastTouchAt": nowISO(),
          "sequence.lastChannel": doc.channel
        }
      });
    }

    logger.info({
      msg: "prospection.updateTaskStatus.success",
      id,
      newStatus: status,
      durationMs: Date.now() - t0,
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "prospection.updateTaskStatus.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur updateTaskStatus", error: String(err?.message || err) });
  }
};

// ---------- ÉVÉNEMENTS ----------

export const addEvent = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "prospection.addEvent.request",
      route: "POST /prospection/event",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

    const ev = await EventModel.create({
      professionalId: req.body.professionalId,
      type: req.body.type,
      channel: req.body.channel,
      payload: req.body.payload || {},
      at: req.body.at || nowISO()
    });

    logger.info({
      msg: "prospection.addEvent.success",
      id: ev?._id?.toString(),
      durationMs: Date.now() - t0,
    });

    return res.status(201).json(ev);
  } catch (err: any) {
    logger.error({
      msg: "prospection.addEvent.error",
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
      durationMs: Date.now() - t0,
    });
    return res.status(500).json({ message: "Erreur addEvent", error: String(err?.message || err) });
  }
};
