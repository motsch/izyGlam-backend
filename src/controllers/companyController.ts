import CompanyModel from "../models/company";
import * as express from "express";
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

// Créer une nouvelle entreprise
const createCompany = async (req: express.Request, res: express.Response) => {
  try {
    const newCompany = new CompanyModel(req.body);
    await newCompany.save();

    logger.info({
      msg: "createCompany success",
      route: "POST /api/company",
      method: req.method,
      url: req.originalUrl,
      companyId: newCompany?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newCompany);
  } catch (error: any) {
    logger.error({
      msg: "createCompany failed",
      route: "POST /api/company",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer l'entreprise" });
  }
};

// Récupérer toutes les entreprises
const getAllCompanies = async (req: express.Request, res: express.Response) => {
  try {
    const companies = await CompanyModel.find();

    logger.info({
      msg: "getAllCompanies success",
      route: "GET /api/company",
      method: req.method,
      url: req.originalUrl,
      count: companies.length,
    });

    res.json(companies);
  } catch (error: any) {
    logger.error({
      msg: "getAllCompanies failed",
      route: "GET /api/company",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les entreprises" });
  }
};

// Récupérer une entreprise par son ID
const getCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const company = await CompanyModel.findById(id);

    if (company) {
      logger.info({
        msg: "getCompanyById success",
        route: "GET /api/company/:id",
        method: req.method,
        url: req.originalUrl,
        companyId: id,
      });
      res.json(company);
    } else {
      logger.warn({
        msg: "getCompanyById not found",
        route: "GET /api/company/:id",
        method: req.method,
        url: req.originalUrl,
        companyId: id,
      });
      res.status(404).json({ message: "Entreprise non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getCompanyById failed",
      route: "GET /api/company/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer l'entreprise" });
  }
};

// Mettre à jour une entreprise par son ID
const updateCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedCompany = await CompanyModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedCompany) {
      logger.info({
        msg: "updateCompanyById success",
        route: "PUT /api/company/:id",
        method: req.method,
        url: req.originalUrl,
        companyId: id,
        body: sanitize(req.body),
      });
      res.json(updatedCompany);
    } else {
      logger.warn({
        msg: "updateCompanyById not found",
        route: "PUT /api/company/:id",
        method: req.method,
        url: req.originalUrl,
        companyId: id,
      });
      res.status(404).json({ message: "Entreprise non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateCompanyById failed",
      route: "PUT /api/company/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour l'entreprise" });
  }
};

// Supprimer une entreprise par son ID
const deleteCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedCompany = await CompanyModel.findByIdAndDelete(id);

    if (deletedCompany) {
      logger.info({
        msg: "deleteCompanyById success",
        route: "DELETE /api/company/:id",
        method: req.method,
        url: req.originalUrl,
        companyId: id,
      });
      res.json({ message: "Entreprise supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteCompanyById not found",
        route: "DELETE /api/company/:id",
        method: req.method,
        url: req.originalUrl,
        companyId: id,
      });
      res.status(404).json({ message: "Entreprise non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteCompanyById failed",
      route: "DELETE /api/company/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer l'entreprise" });
  }
};

// Récupérer toutes les entreprises d'un secteur d'activité spécifique
const getCompaniesByIndustry = async (req: express.Request, res: express.Response) => {
  try {
    const { industry } = req.params;
    const companies = await CompanyModel.find({ industry });

    if (companies.length > 0) {
      logger.info({
        msg: "getCompaniesByIndustry success",
        route: "GET /api/companies/industry/:industry",
        method: req.method,
        url: req.originalUrl,
        industry,
        count: companies.length,
      });
      res.json(companies);
    } else {
      logger.warn({
        msg: "getCompaniesByIndustry not found",
        route: "GET /api/companies/industry/:industry",
        method: req.method,
        url: req.originalUrl,
        industry,
      });
      res.status(404).json({ message: "Aucune entreprise trouvée dans ce secteur d'activité" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getCompaniesByIndustry failed",
      route: "GET /api/companies/industry/:industry",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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
