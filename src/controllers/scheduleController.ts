import ScheduleModel from "../models/schedule";
import * as express from "express";
import { logger } from "../utils/logger";

// Créer un nouvel emploi du temps (schedule)
const createSchedule = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "schedule.create.request",
      route: "POST /schedule",
      method: req.method,
      url: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
    });

    const newSchedule = new ScheduleModel(req.body);
    await newSchedule.save();

    logger.info({
      msg: "schedule.create.success",
      id: newSchedule?._id?.toString(),
      durationMs: Date.now() - t0,
    });

    res.status(201).json(newSchedule);
  } catch (error: any) {
    logger.error({
      msg: "schedule.create.error",
      route: "POST /schedule",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de créer l'emploi du temps" });
  }
};

// Récupérer tous les emplois du temps
const getAllSchedules = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "schedule.list.request",
      route: "GET /schedule",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
    });

    const schedules = await ScheduleModel.find();

    logger.info({
      msg: "schedule.list.success",
      count: schedules.length,
      durationMs: Date.now() - t0,
    });

    res.json(schedules);
  } catch (error: any) {
    logger.error({
      msg: "schedule.list.error",
      route: "GET /schedule",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer les emplois du temps" });
  }
};

// Récupérer un emploi du temps par son ID
const getScheduleById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "schedule.getById.request",
      route: "GET /schedule/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { id } = req.params;
    const schedule = await ScheduleModel.findById(id);
    if (schedule) {
      logger.info({
        msg: "schedule.getById.success",
        id,
        durationMs: Date.now() - t0,
      });
      res.json(schedule);
    } else {
      logger.warn({
        msg: "schedule.getById.not_found",
        id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Emploi du temps non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "schedule.getById.error",
      route: "GET /schedule/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer l'emploi du temps" });
  }
};

// Mettre à jour un emploi du temps par son ID
const updateScheduleById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "schedule.update.request",
      route: "PUT /schedule/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { id } = req.params;
    const updatedSchedule = await ScheduleModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedSchedule) {
      logger.info({
        msg: "schedule.update.success",
        id,
        durationMs: Date.now() - t0,
      });
      res.json(updatedSchedule);
    } else {
      logger.warn({
        msg: "schedule.update.not_found",
        id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Emploi du temps non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "schedule.update.error",
      route: "PUT /schedule/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de mettre à jour l'emploi du temps" });
  }
};

// Supprimer un emploi du temps par son ID
const deleteScheduleById = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "schedule.delete.request",
      route: "DELETE /schedule/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { id } = req.params;
    const deletedSchedule = await ScheduleModel.findByIdAndDelete(id);

    if (deletedSchedule) {
      logger.info({
        msg: "schedule.delete.success",
        id,
        durationMs: Date.now() - t0,
      });
      res.json({ message: "Emploi du temps supprimé avec succès" });
    } else {
      logger.warn({
        msg: "schedule.delete.not_found",
        id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Emploi du temps non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "schedule.delete.error",
      route: "DELETE /schedule/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de supprimer l'emploi du temps" });
  }
};

// Récupérer tous les emplois du temps pour une boutique spécifique
const getSchedulesByShop = async (req: express.Request, res: express.Response) => {
  const t0 = Date.now();
  try {
    logger.info({
      msg: "schedule.byShop.request",
      route: "GET /schedule/shop/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
    });

    const { id } = req.params;
    const schedules = await ScheduleModel.find({ boutiqueId: id });

    if (schedules.length > 0) {
      logger.info({
        msg: "schedule.byShop.success",
        shopId: id,
        count: schedules.length,
        durationMs: Date.now() - t0,
      });
      res.json(schedules);
    } else {
      logger.warn({
        msg: "schedule.byShop.none",
        shopId: id,
        durationMs: Date.now() - t0,
      });
      res.status(404).json({ message: "Aucun emploi du temps trouvé pour cette boutique" });
    }
  } catch (error: any) {
    logger.error({
      msg: "schedule.byShop.error",
      route: "GET /schedule/shop/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      durationMs: Date.now() - t0,
    });
    res.status(500).json({ message: "Impossible de récupérer les emplois du temps pour cette boutique" });
  }
};

module.exports = {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  updateScheduleById,
  deleteScheduleById,
  getSchedulesByShop,
};
