import * as express from "express";
import mongoose from "mongoose";
import { logger } from "../utils/logger";
import UserModel from "../models/user";
import BookingModel from "../models/booking";
import CompanyModel, { CompanyRoleKey, RoleCreditConfig } from "../models/company";
import { createCompanyCheckoutSession, ensureStripeCustomerForCompany, syncSubscriptionQuantityFromCompany } from "../services/companyStripeBilling";

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

function requireAdmin(req: express.Request) {
  const role = (req as any).user?.role;
  if (role !== "admin") {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

function isBillableEmployee(u: any): boolean {
  if (u.active === false) return false;
  if (u.companyContractEnd) {
    const end = new Date(u.companyContractEnd);
    if (end.getTime() < Date.now()) return false;
  }
  return true;
}

/**
 * ✅ Source de vérité : recompute monthlyTotalAmount & nbEmployees
 * - monthlyTotalAmount = somme des companyMonthlyCredit des employés billables (actifs + contrat ok)
 * - nbEmployees = nombre total d’employés liés (ou billables si tu préfères)
 */
async function recomputeCompanyMonthlyTotal(companyId: string) {
  const employees = await UserModel.find({ companyId }).select("active companyMonthlyCredit companyContractEnd").lean();
  const billables = employees.filter(isBillableEmployee);
  const monthlyTotalAmount = billables.reduce((sum: number, e: any) => sum + (Number(e.companyMonthlyCredit) || 0), 0);

  const nbEmployees = employees.length;

  const company = await CompanyModel.findByIdAndUpdate(
    companyId,
    { monthlyTotalAmount, nbEmployees },
    { new: true }
  );

  return company;
}

// ------------------------------------------------------------
// Créer une nouvelle entreprise
// ------------------------------------------------------------
const createCompany = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

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
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de créer l'entreprise" });
  }
};

// ------------------------------------------------------------
// Récupérer toutes les entreprises
// ------------------------------------------------------------
const getAllCompanies = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

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
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de récupérer les entreprises" });
  }
};

// ------------------------------------------------------------
// Récupérer une entreprise par ID
// ------------------------------------------------------------
const getCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

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
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de récupérer l'entreprise" });
  }
};

// ------------------------------------------------------------
// Mettre à jour une entreprise
// ------------------------------------------------------------
const updateCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { id } = req.params;
    const updates = req.body || {};

    // 🔒 Si on tente de modifier le crédit de l'entreprise, vérifier pas < somme credits employés
    if (typeof updates.credit === "number") {
      const employees = await UserModel.find({ companyId: id }).select("credit").lean();
      const totalEmployeesCredit = employees.reduce((sum, e: any) => sum + (Number(e.credit) || 0), 0);

      if (updates.credit < totalEmployeesCredit) {
        return res.status(400).json({
          message:
            "Impossible de diminuer le crédit entreprise en dessous du total alloué aux employés.",
          totalEmployeesCredit,
        });
      }
    }

    const updatedCompany = await CompanyModel.findByIdAndUpdate(id, updates, { new: true });

    if (!updatedCompany) return res.status(404).json({ message: "Entreprise non trouvée" });

    logger.info({
      msg: "updateCompanyById success",
      route: "PUT /api/company/:id",
      method: req.method,
      url: req.originalUrl,
      companyId: id,
      body: sanitize(req.body),
    });

    res.json(updatedCompany);
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
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de mettre à jour l'entreprise" });
  }
};

// ------------------------------------------------------------
// Supprimer une entreprise
// ------------------------------------------------------------
const deleteCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { id } = req.params;
    const deletedCompany = await CompanyModel.findByIdAndDelete(id);

    if (!deletedCompany) return res.status(404).json({ message: "Entreprise non trouvée" });

    logger.info({
      msg: "deleteCompanyById success",
      route: "DELETE /api/company/:id",
      method: req.method,
      url: req.originalUrl,
      companyId: id,
    });

    res.json({ message: "Entreprise supprimée avec succès" });
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
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de supprimer l'entreprise" });
  }
};

// ------------------------------------------------------------
// Récupérer entreprises par secteur
// ------------------------------------------------------------
const getCompaniesByIndustry = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { industry } = req.params;
    const companies = await CompanyModel.find({ industry });

    if (!companies.length) return res.status(404).json({ message: "Aucune entreprise trouvée dans ce secteur" });

    res.json(companies);
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
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de récupérer les entreprises" });
  }
};

// ------------------------------------------------------------
// Récupérer employés d'une entreprise + stats
// ------------------------------------------------------------
const getEmployeesByCompanyId = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { companyId } = req.params;

    const employees = await UserModel.find({ companyId })
      .select("firstname lastname email credit role companyId active companyRole companyMonthlyCredit companyContractEnd createdAt updatedAt lastSeen")
      .lean();

    const employeeIds = employees.map((e: any) => e._id.toString());

    const bookingCounts = await BookingModel.aggregate([
      { $match: { clientId: { $in: employeeIds } } },
      { $group: { _id: "$clientId", totalBookings: { $sum: 1 } } },
    ]);

    const countsMap: Record<string, number> = {};
    bookingCounts.forEach((b: any) => (countsMap[b._id] = b.totalBookings));

    const employeesWithStats = employees.map((e: any) => ({
      ...e,
      totalBookings: countsMap[e._id.toString()] || 0,
    }));

    res.json(employeesWithStats);
  } catch (error: any) {
    logger.error({
      msg: "getEmployeesByCompanyId failed",
      route: "GET /api/company/:companyId/employees",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de récupérer les employés" });
  }
};

// ------------------------------------------------------------
// Récupérer bookings d’un employé
// ------------------------------------------------------------
const getEmployeeBookings = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { employeeId } = req.params;

    const bookings = await BookingModel.find({ clientId: employeeId }).sort({ start: -1 }).lean();
    res.json(bookings);
  } catch (error: any) {
    logger.error({
      msg: "getEmployeeBookings failed",
      route: "GET /api/company/employee/:employeeId/bookings",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de récupérer les bookings" });
  }
};

// ------------------------------------------------------------
// Créer un employé rattaché à une entreprise (B2B)
// ------------------------------------------------------------
const createCompanyEmployee = async (req: express.Request, res: express.Response) => {
  const session = await mongoose.startSession();
  try {
    requireAdmin(req);

    const { companyId } = req.params;
    const {
      firstname,
      lastname,
      email,
      phone,
      sex,
      initialCredit = 0,
      companyRole = "employee",
      companyMonthlyCredit,
      companyContractEnd,
    } = req.body;

    const company = await CompanyModel.findById(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    const existing = await UserModel.findOne({ email });
    if (existing) return res.status(409).json({ message: "Un utilisateur avec cet email existe déjà" });

    const roleKey: CompanyRoleKey = (companyRole as CompanyRoleKey) || "employee";
    const roleConfig: RoleCreditConfig = company.roleCreditConfig || { employee: 0, manager: 0, executive: 0 };

    const defaultMonthly =
      typeof companyMonthlyCredit === "number"
        ? companyMonthlyCredit
        : (roleConfig[roleKey] ?? company.monthlyBaseCreditPerEmployee);

    const creditToAllocate = Math.max(0, Number(initialCredit) || 0);

    if (creditToAllocate > 0 && company.credit < creditToAllocate) {
      return res.status(400).json({
        message: "Crédit entreprise insuffisant pour allouer ce montant à l'employé.",
        companyCredit: company.credit,
        requested: creditToAllocate,
      });
    }

    const defaultPassword = company.defaultPassword || "izyGl@m" + new Date().getFullYear() + "!";

    let createdUser: any;
    let updatedCompany: any;

    await session.withTransaction(async () => {
      const newUser = new UserModel({
        firstname,
        lastname,
        email,
        phone,
        sex,
        password: defaultPassword,
        role: "professionnel", // ✅ employé = pro
        companyId,
        credit: creditToAllocate,
        companyMonthlyCredit: defaultMonthly,
        companyRole: roleKey,
        companyContractEnd: companyContractEnd ? new Date(companyContractEnd) : null,
        active: true,
        conversationId: "",
        abonnement: "free",
        favoriteShops: [],
        proches: [],
        address: [],
        fidelity: {
          stars: 0,
          card_expiration: new Date(),
          rewards_history: [],
        },
        country: "",
        language: "fr",
      });

      createdUser = await newUser.save({ session });

      if (creditToAllocate > 0) {
        company.credit -= creditToAllocate;
      }

      await company.save({ session });

      updatedCompany = await recomputeCompanyMonthlyTotal(companyId);
    });

    // ✅ Sync Stripe si subscription existe (non bloquant)
    try {
      await syncSubscriptionQuantityFromCompany(companyId);
    } catch (e: any) {
      logger.error({ msg: "Stripe sync failed (createCompanyEmployee)", companyId, errorMessage: e?.message });
    }

    res.status(201).json({ employee: createdUser, company: updatedCompany || company });
  } catch (error: any) {
    logger.error({
      msg: "createCompanyEmployee failed",
      route: "POST /api/company/:companyId/employees",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de créer l'employé" });
  } finally {
    session.endSession();
  }
};

// ------------------------------------------------------------
// Mettre à jour le crédit courant d'un employé (solde user.credit)
// en ajustant company.credit en conséquence
// ------------------------------------------------------------
const updateEmployeeCurrentCredit = async (req: express.Request, res: express.Response) => {
  const session = await mongoose.startSession();
  try {
    requireAdmin(req);

    const { companyId, employeeId } = req.params;
    const { newCredit } = req.body as { newCredit: number };

    const company = await CompanyModel.findById(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    const user = await UserModel.findById(employeeId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ message: "Employé introuvable pour cette entreprise" });
    }

    const currentCredit = Number(user.credit) || 0;
    const targetCredit = Math.max(0, Number(newCredit) || 0);
    const diff = targetCredit - currentCredit;

    await session.withTransaction(async () => {
      if (diff > 0) {
        if (company.credit < diff) {
          throw Object.assign(new Error("Crédit entreprise insuffisant pour augmenter le crédit."), { status: 400 });
        }
        company.credit -= diff;
      }
      if (diff < 0) {
        company.credit += Math.abs(diff);
      }

      user.credit = targetCredit;

      await user.save({ session });
      await company.save({ session });
    });

    res.json({ employee: user, company });
  } catch (error: any) {
    logger.error({
      msg: "updateEmployeeCurrentCredit failed",
      route: "PATCH /api/company/:companyId/employees/:employeeId/credit",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorMessage: error?.message,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de mettre à jour le crédit" });
  } finally {
    session.endSession();
  }
};

// ------------------------------------------------------------
// Mettre à jour l'allocation mensuelle (companyMonthlyCredit)
// + recompute monthlyTotalAmount + sync Stripe
// ------------------------------------------------------------
const updateEmployeeMonthlyCredit = async (req: express.Request, res: express.Response) => {
  const session = await mongoose.startSession();
  try {
    requireAdmin(req);

    const { companyId, employeeId } = req.params;
    const { newMonthlyCredit } = req.body as { newMonthlyCredit: number };

    const company = await CompanyModel.findById(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    const user = await UserModel.findById(employeeId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ message: "Employé introuvable pour cette entreprise" });
    }

    const targetMonthly = Math.max(0, Number(newMonthlyCredit) || 0);

    await session.withTransaction(async () => {
      user.companyMonthlyCredit = targetMonthly;
      await user.save({ session });
    });

    const updatedCompany = await recomputeCompanyMonthlyTotal(companyId);

    // ✅ Sync Stripe si subscription existe (non bloquant)
    try {
      await syncSubscriptionQuantityFromCompany(companyId);
    } catch (e: any) {
      logger.error({ msg: "Stripe sync failed (updateEmployeeMonthlyCredit)", companyId, errorMessage: e?.message });
    }

    res.json({ employee: user, company: updatedCompany || company });
  } catch (error: any) {
    logger.error({
      msg: "updateEmployeeMonthlyCredit failed",
      route: "PATCH /api/company/:companyId/employees/:employeeId/monthly-credit",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorMessage: error?.message,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de mettre à jour l'allocation mensuelle" });
  } finally {
    session.endSession();
  }
};

// ------------------------------------------------------------
// Mise à jour du statut d'un employé (active / inactive)
// Désactivation => retour du solde vers l'entreprise + sync Stripe
// ------------------------------------------------------------
const updateEmployeeStatus = async (req: express.Request, res: express.Response) => {
  const session = await mongoose.startSession();
  try {
    requireAdmin(req);

    const { companyId, employeeId } = req.params;
    const { active } = req.body as { active: boolean };

    const company = await CompanyModel.findById(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    const user = await UserModel.findById(employeeId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ message: "Employé introuvable pour cette entreprise" });
    }

    const wasActive = user.active !== false;
    const willBeActive = !!active;

    await session.withTransaction(async () => {
      if (wasActive && !willBeActive) {
        // Désactivation : on rembourse son solde au pot entreprise
        const refund = Number(user.credit) || 0;
        if (refund > 0) {
          company.credit += refund;
          user.credit = 0;
        }
      }

      user.active = willBeActive;

      await user.save({ session });
      await company.save({ session });
    });

    const updatedCompany = await recomputeCompanyMonthlyTotal(companyId);

    // ✅ Sync Stripe si subscription existe (non bloquant)
    try {
      await syncSubscriptionQuantityFromCompany(companyId);
    } catch (e: any) {
      logger.error({ msg: "Stripe sync failed (updateEmployeeStatus)", companyId, errorMessage: e?.message });
    }

    res.json({ employee: user, company: updatedCompany || company });
  } catch (error: any) {
    logger.error({
      msg: "updateEmployeeStatus failed",
      route: "PATCH /api/company/:companyId/employees/:employeeId/status",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorMessage: error?.message,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de mettre à jour le statut" });
  } finally {
    session.endSession();
  }
};

// ------------------------------------------------------------
// Reset des allocations : ici on aligne companyMonthlyCredit sur barème
// (On NE FORCE PAS user.credit => pas d’effacement du restant)
// ------------------------------------------------------------
const resetCompanyAllocations = async (req: express.Request, res: express.Response) => {
  const session = await mongoose.startSession();
  try {
    requireAdmin(req);

    const { companyId } = req.params;

    const company = await CompanyModel.findById(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    const employees = await UserModel.find({ companyId, active: true });

    const roleConfig = company.roleCreditConfig || { employee: 0, manager: 0, executive: 0 };

    await session.withTransaction(async () => {
      for (const u of employees) {
        const roleKey: CompanyRoleKey = (u.companyRole as CompanyRoleKey) || "employee";
        const target = roleConfig[roleKey] ?? company.monthlyBaseCreditPerEmployee;
        u.companyMonthlyCredit = Math.max(0, Number(target) || 0);
        await u.save({ session });
      }
    });

    const updatedCompany = await recomputeCompanyMonthlyTotal(companyId);

    // ✅ Sync Stripe
    try {
      await syncSubscriptionQuantityFromCompany(companyId);
    } catch (e: any) {
      logger.error({ msg: "Stripe sync failed (resetCompanyAllocations)", companyId, errorMessage: e?.message });
    }

    res.json({ company: updatedCompany || company, employees });
  } catch (error: any) {
    logger.error({
      msg: "resetCompanyAllocations failed",
      route: "POST /api/company/:companyId/reset-allocations",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de réinitialiser les allocations" });
  } finally {
    session.endSession();
  }
};

// ============================================================
// ✅ STRIPE BILLING ENDPOINTS
// ============================================================

/**
 * Crée une Checkout Session Stripe (subscription)
 * - price: 1€ / mois
 * - quantity: company.monthlyTotalAmount (en €)
 */
const createCompanyBillingCheckout = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { companyId } = req.params;

    const company = await CompanyModel.findById(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    // On recalcul avant checkout (source de vérité)
    const refreshed = await recomputeCompanyMonthlyTotal(companyId);
    const companyToUse = refreshed || company;

    // Pas de montant => on bloque checkout (sinon quantity=0)
    if ((companyToUse.monthlyTotalAmount || 0) <= 0) {
      return res.status(400).json({ message: "Montant mensuel total = 0. Ajoute au moins un employé actif avec un crédit mensuel > 0." });
    }

    await ensureStripeCustomerForCompany(companyId);

    const session = await createCompanyCheckoutSession(companyId);

    return res.json({ url: session.url });
  } catch (error: any) {
    logger.error({
      msg: "createCompanyBillingCheckout failed",
      route: "POST /api/company/:companyId/billing/checkout",
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de créer la session Stripe" });
  }
};

/**
 * Force une synchro Stripe (quantity = monthlyTotalAmount)
 * utile si tu veux un bouton “Recalculer abonnement”
 */
const syncCompanySubscription = async (req: express.Request, res: express.Response) => {
  try {
    requireAdmin(req);

    const { companyId } = req.params;

    const company = await recomputeCompanyMonthlyTotal(companyId);
    if (!company) return res.status(404).json({ message: "Entreprise introuvable" });

    await syncSubscriptionQuantityFromCompany(companyId);

    res.json({ ok: true, company });
  } catch (error: any) {
    logger.error({
      msg: "syncCompanySubscription failed",
      route: "POST /api/company/:companyId/billing/sync",
      params: req.params,
      errorMessage: error?.message,
    });
    res.status(error?.status || 500).json({ message: error?.message || "Impossible de synchroniser Stripe" });
  }
};

module.exports = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompanyById,
  createCompanyEmployee,
  updateEmployeeStatus,
  resetCompanyAllocations,
  deleteCompanyById,
  updateEmployeeMonthlyCredit,
  updateEmployeeCurrentCredit,
  getCompaniesByIndustry,
  getEmployeesByCompanyId,
  getEmployeeBookings,

  // ✅ Stripe endpoints
  createCompanyBillingCheckout,
  syncCompanySubscription,
};
