import { Request, Response } from "express";
import CategoryModel from "../models/category";

// Créer une nouvelle catégorie
const createCategory = async (req: Request, res: Response) => {
  try {
    const newCategory = new CategoryModel(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la catégorie" });
  }
};

// Récupérer toutes les catégories
const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await CategoryModel.find();
    // console.log(categories);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les catégories" });
  }
};

// Récupérer une catégorie par son ID
const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await CategoryModel.findById(id);
    if (category) {
      res.json(category);
    } else {
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la catégorie" });
  }
};

// Mettre à jour une catégorie par son ID
const updateCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedCategory = await CategoryModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedCategory) {
      res.json(updatedCategory);
    } else {
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la catégorie" });
  }
};

// Supprimer une catégorie par son ID
const deleteCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCategory = await CategoryModel.findByIdAndDelete(id);
    if (deletedCategory) {
      res.json({ message: "Catégorie supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Catégorie non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la catégorie" });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
};
