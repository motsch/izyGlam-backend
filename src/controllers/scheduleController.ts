import ScheduleModel from "../models/schedule"; // Assurez-vous d'avoir importé votre modèle Schedule
import * as express from "express";

// Créer un nouvel emploi du temps (schedule)
const createSchedule = async (req: express.Request, res: express.Response) => {
  try {
    const newSchedule = new ScheduleModel(req.body);
    await newSchedule.save();
    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer l'emploi du temps" });
  }
};

// Récupérer tous les emplois du temps
const getAllSchedules = async (req: express.Request, res: express.Response) => {
  try {
    const schedules = await ScheduleModel.find();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les emplois du temps" });
  }
};

// Récupérer un emploi du temps par son ID
const getScheduleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const schedule = await ScheduleModel.findById(id);
    if (schedule) {
      res.json(schedule);
    } else {
      res.status(404).json({ message: "Emploi du temps non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer l'emploi du temps" });
  }
};

// Mettre à jour un emploi du temps par son ID
const updateScheduleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedSchedule = await ScheduleModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedSchedule) {
      res.json(updatedSchedule);
    } else {
      res.status(404).json({ message: "Emploi du temps non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour l'emploi du temps" });
  }
};

// Supprimer un emploi du temps par son ID
const deleteScheduleById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedSchedule = await ScheduleModel.findByIdAndDelete(id);
    if (deletedSchedule) {
      res.json({ message: "Emploi du temps supprimé avec succès" });
    } else {
      res.status(404).json({ message: "Emploi du temps non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer l'emploi du temps" });
  }
};

// Récupérer tous les emplois du temps pour une boutique spécifique
const getSchedulesByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const schedules = await ScheduleModel.find({ boutiqueId: id });
    if (schedules.length > 0) {
      res.json(schedules);
    } else {
      res.status(404).json({ message: "Aucun emploi du temps trouvé pour cette boutique" });
    }
  } catch (error) {
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
