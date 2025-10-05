import PlanModel from "../models/plan";
import * as express from "express";
import { logger } from "../utils/logger";

// Créer un nouveau plan
export const createPlan = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "plans.create.request",
      route: "POST /api/plans",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

    const newPlan = new PlanModel(req.body);
    await newPlan.save();

    logger.info({
      msg: "plans.create.success",
      route: "POST /api/plans",
      method: req.method,
      url: req.originalUrl,
      planId: newPlan?._id?.toString(),
      durationMs: Date.now() - t0,
    });

    res.status(201).json(newPlan);
  } catch (error: any) {
    logger.error({
      msg: "plans.create.error",
      route: "POST /api/plans",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de créer le plan tarifaire" });
  }
};

// Récupérer tous les plans
export const getAllPlans = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "plans.list.request",
      route: "GET /api/plans",
      method: req.method,
      url: req.originalUrl,
      queryKeys: Object.keys(req.query || {}),
    });

    const plans = await PlanModel.find();

    logger.info({
      msg: "plans.list.success",
      route: "GET /api/plans",
      method: req.method,
      url: req.originalUrl,
      count: plans.length,
      durationMs: Date.now() - t0,
    });

    res.json(plans);
  } catch (error: any) {
    logger.error({
      msg: "plans.list.error",
      route: "GET /api/plans",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer les plans tarifaires" });
  }
};

// Récupérer un plan par son ID
export const getPlanById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    const { id } = req.params;

    logger.info({
      msg: "plans.get.request",
      route: "GET /api/plans/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const plan = await PlanModel.findById(id);
    if (plan) {
      logger.info({
        msg: "plans.get.success",
        route: "GET /api/plans/:id",
        method: req.method,
        url: req.originalUrl,
        planId: id,
        durationMs: Date.now() - t0,
      });
      res.json(plan);
    } else {
      logger.warn({
        msg: "plans.get.not_found",
        route: "GET /api/plans/:id",
        method: req.method,
        url: req.originalUrl,
        planId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Plan tarifaire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "plans.get.error",
      route: "GET /api/plans/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer le plan tarifaire" });
  }
};

// Mettre à jour un plan par son ID
export const updatePlanById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    const { id } = req.params;

    logger.info({
      msg: "plans.update.request",
      route: "PUT /api/plans/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });

    const updatedPlan = await PlanModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (updatedPlan) {
      logger.info({
        msg: "plans.update.success",
        route: "PUT /api/plans/:id",
        method: req.method,
        url: req.originalUrl,
        planId: id,
        durationMs: Date.now() - t0,
      });
      res.json(updatedPlan);
    } else {
      logger.warn({
        msg: "plans.update.not_found",
        route: "PUT /api/plans/:id",
        method: req.method,
        url: req.originalUrl,
        planId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Plan tarifaire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "plans.update.error",
      route: "PUT /api/plans/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de mettre à jour le plan tarifaire" });
  }
};

// Supprimer un plan par son ID
export const deletePlanById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    const { id } = req.params;

    logger.info({
      msg: "plans.delete.request",
      route: "DELETE /api/plans/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const deletedPlan = await PlanModel.findByIdAndDelete(id);
    if (deletedPlan) {
      logger.info({
        msg: "plans.delete.success",
        route: "DELETE /api/plans/:id",
        method: req.method,
        url: req.originalUrl,
        planId: id,
        durationMs: Date.now() - t0,
      });
      res.json({ message: "Plan tarifaire supprimé avec succès" });
    } else {
      logger.warn({
        msg: "plans.delete.not_found",
        route: "DELETE /api/plans/:id",
        method: req.method,
        url: req.originalUrl,
        planId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Plan tarifaire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "plans.delete.error",
      route: "DELETE /api/plans/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de supprimer le plan tarifaire" });
  }
};
