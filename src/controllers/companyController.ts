import CompanyModel from "../models/company";
import * as express from "express";

// Créer une nouvelle entreprise
const createCompany = async (req: express.Request, res: express.Response) => {
  try {
    const newCompany = new CompanyModel(req.body);
    await newCompany.save();
    res.status(201).json(newCompany);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer l'entreprise" });
  }
};

// Récupérer toutes les entreprises
const getAllCompanies = async (req: express.Request, res: express.Response) => {
  try {
    const companies = await CompanyModel.find();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les entreprises" });
  }
};

// Récupérer une entreprise par son ID
const getCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const company = await CompanyModel.findById(id);
    if (company) {
      res.json(company);
    } else {
      res.status(404).json({ message: "Entreprise non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer l'entreprise" });
  }
};

// Mettre à jour une entreprise par son ID
const updateCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedCompany = await CompanyModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedCompany) {
      res.json(updatedCompany);
    } else {
      res.status(404).json({ message: "Entreprise non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour l'entreprise" });
  }
};

// Supprimer une entreprise par son ID
const deleteCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedCompany = await CompanyModel.findByIdAndDelete(id);
    if (deletedCompany) {
      res.json({ message: "Entreprise supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Entreprise non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer l'entreprise" });
  }
};

// Récupérer toutes les entreprises d'un secteur d'activité spécifique
const getCompaniesByIndustry = async (req: express.Request, res: express.Response) => {
  try {
    const { industry } = req.params;
    const companies = await CompanyModel.find({ industry: industry });
    if (companies.length > 0) {
      res.json(companies);
    } else {
      res.status(404).json({ message: "Aucune entreprise trouvée dans ce secteur d'activité" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les entreprises pour ce secteur d'activité" });
  }
};

module.exports = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompanyById,
  deleteCompanyById,
  getCompaniesByIndustry,
};
