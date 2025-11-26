import B2BLeadModel from "../models/b2bLead";
import * as express from "express";
import { logger } from "../utils/logger";
// src/controllers/b2bLeadController.ts
import { enrichBatchB2BLeads } from "../services/emailEnrichment.service";

// -- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

// Créer un nouveau lead B2B
const createB2BLead = async (req: express.Request, res: express.Response) => {
  try {
    const newLead = new B2BLeadModel(req.body);
    await newLead.save();

    logger.info({
      msg: "createB2BLead success",
      route: "POST /api/b2b-leads",
      method: req.method,
      url: req.originalUrl,
      leadId: newLead?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newLead);
  } catch (error: any) {
    logger.error({
      msg: "createB2BLead failed",
      route: "POST /api/b2b-leads",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    // gestion du cas email déjà utilisé (unique index)
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "Un lead avec cet email existe déjà" });
    }

    res
      .status(500)
      .json({ message: "Impossible de créer le lead B2B pour le moment" });
  }
};

// Récupérer tous les leads B2B (avec filtres simples optionnels)
const getAllB2BLeads = async (req: express.Request, res: express.Response) => {
  try {
    const query: any = {};

    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.postalCode) {
      query.postalCode = req.query.postalCode;
    }
    if (req.query.city) {
      query.city = req.query.city;
    }

    const leads = await B2BLeadModel.find(query).sort({ createdAt: -1 });

    logger.info({
      msg: "getAllB2BLeads success",
      route: "GET /api/b2b-leads",
      method: req.method,
      url: req.originalUrl,
      count: leads.length,
      query: sanitize(req.query),
    });

    res.json(leads);
  } catch (error: any) {
    logger.error({
      msg: "getAllB2BLeads failed",
      route: "GET /api/b2b-leads",
      method: req.method,
      url: req.originalUrl,
      query: sanitize(req.query),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de récupérer les leads B2B pour le moment" });
  }
};

// Récupérer un lead B2B par son ID
const getB2BLeadById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const lead = await B2BLeadModel.findById(id);

    if (lead) {
      logger.info({
        msg: "getB2BLeadById success",
        route: "GET /api/b2b-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.json(lead);
    } else {
      logger.warn({
        msg: "getB2BLeadById not found",
        route: "GET /api/b2b-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.status(404).json({ message: "Lead B2B non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getB2BLeadById failed",
      route: "GET /api/b2b-leads/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de récupérer le lead B2B pour le moment" });
  }
};

// Mettre à jour un lead B2B par son ID
const updateB2BLeadById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const updatedLead = await B2BLeadModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedLead) {
      logger.info({
        msg: "updateB2BLeadById success",
        route: "PUT /api/b2b-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
        body: sanitize(req.body),
      });
      res.json(updatedLead);
    } else {
      logger.warn({
        msg: "updateB2BLeadById not found",
        route: "PUT /api/b2b-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.status(404).json({ message: "Lead B2B non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateB2BLeadById failed",
      route: "PUT /api/b2b-leads/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de mettre à jour le lead B2B pour le moment" });
  }
};

// Supprimer un lead B2B par son ID
const deleteB2BLeadById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const deletedLead = await B2BLeadModel.findByIdAndDelete(id);

    if (deletedLead) {
      logger.info({
        msg: "deleteB2BLeadById success",
        route: "DELETE /api/b2b-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.json({ message: "Lead B2B supprimé avec succès" });
    } else {
      logger.warn({
        msg: "deleteB2BLeadById not found",
        route: "DELETE /api/b2b-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.status(404).json({ message: "Lead B2B non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteB2BLeadById failed",
      route: "DELETE /api/b2b-leads/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de supprimer le lead B2B pour le moment" });
  }
};

const enrichEmailsForLeads = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    await enrichBatchB2BLeads(limit);

    logger.info({
      msg: "enrichEmailsForLeads triggered",
      route: "POST /api/b2b-leads/enrich-emails",
      limit,
      userId: (req as any).user?._id,
    });

    res.json({
      message: "Email enrichment triggered",
      limit,
    });
  } catch (error: any) {
    logger.error({
      msg: "enrichEmailsForLeads failed",
      route: "POST /api/b2b-leads/enrich-emails",
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de lancer l'enrichissement" });
  }
};


module.exports = {
  createB2BLead,
  getAllB2BLeads,
  getB2BLeadById,
  updateB2BLeadById,
  deleteB2BLeadById,
  enrichEmailsForLeads,
};
