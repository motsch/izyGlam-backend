import * as express from "express";
import ProLeadModel from "../models/proLead";
import { logger } from "../utils/logger";

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

// Créer un nouveau lead prestataire
const createProLead = async (req: express.Request, res: express.Response) => {
  try {
    const newLead = new ProLeadModel(req.body);
    await newLead.save();

    logger.info({
      msg: "createProLead success",
      route: "POST /api/pro-leads",
      method: req.method,
      url: req.originalUrl,
      leadId: newLead?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newLead);
  } catch (error: any) {
    logger.error({
      msg: "createProLead failed",
      route: "POST /api/pro-leads",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de créer le lead prestataire" });
  }
};

// Récupérer tous les leads (avec quelques filtres optionnels)
const getAllProLeads = async (req: express.Request, res: express.Response) => {
  try {
    const { status, postalCode, search } = req.query as {
      status?: string;
      postalCode?: string;
      search?: string;
    };

    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (postalCode) {
      filter.postalCode = postalCode;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { name: regex },
        { city: regex },
        { postalCode: regex },
        { website: regex },
        { contactEmail: regex },
        { contactPhone: regex },
        { categoryName: regex },
      ];
    }

    const leads = await ProLeadModel.find(filter).sort({ createdAt: -1 });

    logger.info({
      msg: "getAllProLeads success",
      route: "GET /api/pro-leads",
      method: req.method,
      url: req.originalUrl,
      count: leads.length,
      filter: sanitize(filter),
    });

    res.json(leads);
  } catch (error: any) {
    logger.error({
      msg: "getAllProLeads failed",
      route: "GET /api/pro-leads",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de récupérer les leads prestataires" });
  }
};

// Récupérer un lead par son ID
const getProLeadById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const lead = await ProLeadModel.findById(id);

    if (lead) {
      logger.info({
        msg: "getProLeadById success",
        route: "GET /api/pro-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.json(lead);
    } else {
      logger.warn({
        msg: "getProLeadById not found",
        route: "GET /api/pro-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.status(404).json({ message: "Lead prestataire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getProLeadById failed",
      route: "GET /api/pro-leads/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de récupérer le lead prestataire" });
  }
};

// Mettre à jour un lead par son ID
const updateProLeadById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const updatedLead = await ProLeadModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedLead) {
      logger.info({
        msg: "updateProLeadById success",
        route: "PUT /api/pro-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
        body: sanitize(req.body),
      });
      res.json(updatedLead);
    } else {
      logger.warn({
        msg: "updateProLeadById not found",
        route: "PUT /api/pro-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.status(404).json({ message: "Lead prestataire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateProLeadById failed",
      route: "PUT /api/pro-leads/:id",
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
      .json({ message: "Impossible de mettre à jour le lead prestataire" });
  }
};

// Supprimer un lead par son ID
const deleteProLeadById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const deletedLead = await ProLeadModel.findByIdAndDelete(id);

    if (deletedLead) {
      logger.info({
        msg: "deleteProLeadById success",
        route: "DELETE /api/pro-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.json({ message: "Lead prestataire supprimé avec succès" });
    } else {
      logger.warn({
        msg: "deleteProLeadById not found",
        route: "DELETE /api/pro-leads/:id",
        method: req.method,
        url: req.originalUrl,
        leadId: id,
      });
      res.status(404).json({ message: "Lead prestataire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteProLeadById failed",
      route: "DELETE /api/pro-leads/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de supprimer le lead prestataire" });
  }
};

module.exports = {
  createProLead,
  getAllProLeads,
  getProLeadById,
  updateProLeadById,
  deleteProLeadById,
};
