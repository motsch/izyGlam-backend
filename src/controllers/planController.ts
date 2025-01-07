import PlanModel from "../models/plan";
import * as express from "express";

// Créer un nouveau plan
export const createPlan = async (req: express.Request, res: express.Response) => {
  try {
    const newPlan = new PlanModel(req.body);
    await newPlan.save();
    res.status(201).json(newPlan);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer le plan tarifaire" });
  }
};

// Récupérer tous les plans
export const getAllPlans = async (req: express.Request, res: express.Response) => {
  try {
    const plans = await PlanModel.find();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les plans tarifaires" });
  }
};

// Récupérer un plan par son ID
export const getPlanById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const plan = await PlanModel.findById(id);
    if (plan) {
      res.json(plan);
    } else {
      res.status(404).json({ message: "Plan tarifaire non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le plan tarifaire" });
  }
};

// Mettre à jour un plan par son ID
export const updatePlanById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedPlan = await PlanModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedPlan) {
      res.json(updatedPlan);
    } else {
      res.status(404).json({ message: "Plan tarifaire non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour le plan tarifaire" });
  }
};

// Supprimer un plan par son ID
export const deletePlanById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedPlan = await PlanModel.findByIdAndDelete(id);
    if (deletedPlan) {
      res.json({ message: "Plan tarifaire supprimé avec succès" });
    } else {
      res.status(404).json({ message: "Plan tarifaire non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer le plan tarifaire" });
  }
};
