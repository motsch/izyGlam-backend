import * as express from "express";
import { logger } from "../utils/logger";
import UserModel from "../models/user";
import BookingModel from "../models/booking";
import CompanyModel, { CompanyRoleKey, RoleCreditConfig } from "../models/company";

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

// ------------------------------------------------------------
// Créer une nouvelle entreprise
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Récupérer toutes les entreprises
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Récupérer une entreprise par ID
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Mettre à jour une entreprise
// ------------------------------------------------------------
const updateCompanyById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    // 🔒 Si on tente de modifier le crédit de l'entreprise, on vérifie que
    // le nouveau crédit n'est pas inférieur à la somme des crédits employés.
    if (typeof updates.credit === "number") {
      const employees = await UserModel.find({ companyId: id }).select("credit").lean();
      const totalEmployeesCredit = employees.reduce(
        (sum, e: any) => sum + (Number(e.credit) || 0),
        0
      );

      if (updates.credit < totalEmployeesCredit) {
        return res.status(400).json({
          message:
            "Impossible de diminuer le crédit entreprise en dessous du total alloué aux employés.",
          totalEmployeesCredit,
        });
      }
    }
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

// ------------------------------------------------------------
// Supprimer une entreprise
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Récupérer entreprises par secteur
// ------------------------------------------------------------
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
      res.status(404).json({ message: "Aucune entreprise trouvée dans ce secteur" });
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
    res.status(500).json({ message: "Impossible de récupérer les entreprises" });
  }
};

// ------------------------------------------------------------
// Récupérer employés d'une entreprise
// ------------------------------------------------------------

// Récupérer tous les employés d'une entreprise + nombre de bookings
const getEmployeesByCompanyId = async (req: express.Request, res: express.Response) => {
  try {
    const { companyId } = req.params;

    // 1) On récupère les employés de la company
    const employees = await UserModel.find({ companyId })
      .select(
        "firstname lastname email credit role companyId active createdAt updatedAt lastSeen"
      )
      .lean();

    // 2) On récupère le nombre de bookings par employé en une seule agg
    const employeeIds = employees.map((e: any) => e._id.toString());

    const bookingCounts = await BookingModel.aggregate([
      { $match: { clientId: { $in: employeeIds } } },
      {
        $group: {
          _id: "$clientId",
          totalBookings: { $sum: 1 },
        },
      },
    ]);

    const countsMap: Record<string, number> = {};
    bookingCounts.forEach((b: any) => {
      countsMap[b._id] = b.totalBookings;
    });

    const employeesWithStats = employees.map((e: any) => ({
      ...e,
      totalBookings: countsMap[e._id.toString()] || 0,
    }));

    logger.info({
      msg: "getEmployeesByCompanyId success",
      route: "GET /api/company/:companyId/employees",
      method: req.method,
      url: req.originalUrl,
      companyId,
      count: employeesWithStats.length,
    });

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
    res.status(500).json({
      message: "Impossible de récupérer les employés de cette entreprise",
    });
  }
};

// ------------------------------------------------------------
// Récupérer bookings d’un employé
// ------------------------------------------------------------
const getEmployeeBookings = async (req: express.Request, res: express.Response) => {
  try {
    const { employeeId } = req.params;

    const bookings = await BookingModel.find({ clientId: employeeId })
      .sort({ start: -1 })
      .lean();

    logger.info({
      msg: "getEmployeeBookings success",
      route: "GET /api/company/employee/:employeeId/bookings",
      method: req.method,
      url: req.originalUrl,
      employeeId,
      count: bookings.length,
    });

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

    res
      .status(500)
      .json({ message: "Impossible de récupérer les bookings de cet employé" });
  }
};



// ------------------------------------------------------------
// Créer un employé rattaché à une entreprise (B2B)
// ------------------------------------------------------------
const createCompanyEmployee = async (req: express.Request, res: express.Response) => {
  try {
    const { companyId } = req.params;
    const {
      firstname,
      lastname,
      email,
      phone,
      sex,
      initialCredit = 0,
      companyRole = "employee",
      companyMonthlyCredit,   // optionnel, sinon calculé via role
      companyContractEnd,     // optionnel
    } = req.body;

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Entreprise introuvable" });
    }

    // Vérifie qu'on n'a pas déjà un user avec cet email
    const existing = await UserModel.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Un utilisateur avec cet email existe déjà" });
    }

    // -------------------------------
    // Détermine l'allocation mensuelle
    // -------------------------------
    const roleKey: CompanyRoleKey =
      (companyRole as CompanyRoleKey) || "employee";

    const roleConfig: RoleCreditConfig = company.roleCreditConfig || {
      employee: 0,
      manager: 0,
      executive: 0,
    };

    const defaultMonthly =
      typeof companyMonthlyCredit === "number"
        ? companyMonthlyCredit
        : (roleConfig[roleKey] ?? company.monthlyBaseCreditPerEmployee);

    // Montant à allouer à la création
    const creditToAllocate = Math.max(0, Number(initialCredit) || 0);

    // Vérification du solde entreprise
    if (creditToAllocate > 0 && company.credit < creditToAllocate) {
      return res.status(400).json({
        message:
          "Crédit entreprise insuffisant pour allouer ce montant à l'employé.",
        companyCredit: company.credit,
        requested: creditToAllocate,
      });
    }

    // Mot de passe par défaut
    const defaultPassword =
      company.defaultPassword || "izyGl@m" + new Date().getFullYear() + "!";

    const newUser = new UserModel({
      firstname,
      lastname,
      email,
      phone,
      sex,
      password: defaultPassword,
      role: "user", // tu peux changer en "entreprise" si besoin
      companyId: companyId,
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

    await newUser.save();

    // Mise à jour company: solde + nbEmployees + monthlyTotalAmount
    if (creditToAllocate > 0) {
      company.credit -= creditToAllocate;
    }
    company.nbEmployees = company.nbEmployees + 1;
    company.monthlyTotalAmount =
      Number(company.monthlyTotalAmount || 0) + Number(defaultMonthly || 0);
    await company.save();

    logger.info({
      msg: "createCompanyEmployee success",
      route: "POST /api/company/:companyId/employees",
      companyId,
      userId: newUser._id?.toString(),
    });

    res.status(201).json({
      employee: newUser,
      company,
    });
  } catch (error: any) {
    logger.error({
      msg: "createCompanyEmployee failed",
      route: "POST /api/company/:companyId/employees",
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
      .json({ message: "Impossible de créer l'employé pour cette entreprise" });
  }
};


// ------------------------------------------------------------
// Mettre à jour le crédit courant d'un employé (solde user.credit)
// en ajustant company.credit en conséquence
// ------------------------------------------------------------
const updateEmployeeCurrentCredit = async (req: express.Request, res: express.Response) => {
  try {
    const { companyId, employeeId } = req.params;
    const { newCredit } = req.body as { newCredit: number };

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Entreprise introuvable" });
    }

    const user = await UserModel.findById(employeeId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ message: "Employé introuvable pour cette entreprise" });
    }

    const currentCredit = Number(user.credit) || 0;
    const targetCredit = Math.max(0, Number(newCredit) || 0);
    const diff = targetCredit - currentCredit;

    // Si on augmente le crédit de l'employé => on prélève sur l'entreprise
    if (diff > 0) {
      if (company.credit < diff) {
        return res.status(400).json({
          message:
            "Crédit entreprise insuffisant pour augmenter le crédit de cet employé.",
          companyCredit: company.credit,
          requestedIncrease: diff,
        });
      }
      company.credit -= diff;
    }

    // Si on baisse le crédit de l'employé => on rembourse l'entreprise
    if (diff < 0) {
      company.credit += Math.abs(diff);
    }

    user.credit = targetCredit;
    await user.save();
    await company.save();

    logger.info({
      msg: "updateEmployeeCurrentCredit success",
      route: "PATCH /api/company/:companyId/employees/:employeeId/credit",
      companyId,
      employeeId,
      diff,
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
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res
      .status(500)
      .json({ message: "Impossible de mettre à jour le crédit de l'employé" });
  }
};

// ------------------------------------------------------------
// Mettre à jour l'allocation mensuelle (companyMonthlyCredit)
// et ajuster monthlyTotalAmount pour l'entreprise
// ------------------------------------------------------------
const updateEmployeeMonthlyCredit = async (req: express.Request, res: express.Response) => {
  try {
    const { companyId, employeeId } = req.params;
    const { newMonthlyCredit } = req.body as { newMonthlyCredit: number };

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Entreprise introuvable" });
    }

    const user = await UserModel.findById(employeeId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ message: "Employé introuvable pour cette entreprise" });
    }

    const currentMonthly = Number(user.companyMonthlyCredit) || 0;
    const targetMonthly = Math.max(0, Number(newMonthlyCredit) || 0);
    const diff = targetMonthly - currentMonthly;

    user.companyMonthlyCredit = targetMonthly;
    company.monthlyTotalAmount =
      Number(company.monthlyTotalAmount || 0) + Number(diff || 0);

    await user.save();
    await company.save();

    logger.info({
      msg: "updateEmployeeMonthlyCredit success",
      route: "PATCH /api/company/:companyId/employees/:employeeId/monthly-credit",
      companyId,
      employeeId,
      diff,
    });

    res.json({ employee: user, company });
  } catch (error: any) {
    logger.error({
      msg: "updateEmployeeMonthlyCredit failed",
      route: "PATCH /api/company/:companyId/employees/:employeeId/monthly-credit",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: "Impossible de mettre à jour l'allocation mensuelle de l'employé",
    });
  }
};

// ------------------------------------------------------------
// Mise à jour du statut d'un employé (active / inactive)
// Désactivation => retour du crédit + retrait du montant mensuel
// ------------------------------------------------------------
const updateEmployeeStatus = async (req: express.Request, res: express.Response) => {
  try {
    const { companyId, employeeId } = req.params;
    const { active } = req.body as { active: boolean };

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Entreprise introuvable" });
    }

    const user = await UserModel.findById(employeeId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ message: "Employé introuvable pour cette entreprise" });
    }

    const wasActive = !!user.active;
    const willBeActive = !!active;

    if (!wasActive && willBeActive) {
      // Réactivation : il ne récupère pas de crédit magique,
      // mais on le réintègre dans monthlyTotalAmount
      company.monthlyTotalAmount =
        Number(company.monthlyTotalAmount || 0) +
        Number(user.companyMonthlyCredit || 0);
    }

    if (wasActive && !willBeActive) {
      // Désactivation : on rembourse son solde à l'entreprise
      const refund = Number(user.credit) || 0;
      if (refund > 0) {
        company.credit += refund;
        user.credit = 0;
      }
      // et on le retire du mois Stripe
      company.monthlyTotalAmount =
        Number(company.monthlyTotalAmount || 0) -
        Number(user.companyMonthlyCredit || 0);
    }

    user.active = willBeActive;

    await user.save();
    await company.save();

    logger.info({
      msg: "updateEmployeeStatus success",
      route: "PATCH /api/company/:companyId/employees/:employeeId/status",
      companyId,
      employeeId,
      active: willBeActive,
    });

    res.json({ employee: user, company });
  } catch (error: any) {
    logger.error({
      msg: "updateEmployeeStatus failed",
      route: "PATCH /api/company/:companyId/employees/:employeeId/status",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: "Impossible de mettre à jour le statut de l'employé",
    });
  }
};

// ------------------------------------------------------------
// Reset des crédits de tous les employés sur la base du barème
// de l'entreprise (roleCreditConfig / monthlyBaseCreditPerEmployee)
// Sans dépasser le solde entreprise
// ------------------------------------------------------------
const resetCompanyAllocations = async (req: express.Request, res: express.Response) => {
  try {
    const { companyId } = req.params;

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Entreprise introuvable" });
    }

    const employees = await UserModel.find({ companyId, active: true });

    // Montant total souhaité
    let totalNeeded = 0;
    const targetByUser = new Map<string, number>();

    const roleConfig = company.roleCreditConfig || {
      employee: 0,
      manager: 0,
      executive: 0,
    };

    employees.forEach((u) => {
      const roleKey: CompanyRoleKey =
        (u.companyRole as CompanyRoleKey) || "employee";

      const target =
        roleConfig[roleKey] ?? company.monthlyBaseCreditPerEmployee;

      targetByUser.set(u._id.toString(), target);
      totalNeeded += target;
    });

    if (totalNeeded > company.credit) {
      return res.status(400).json({
        message:
          "Crédit entreprise insuffisant pour appliquer le reset à tous les employés.",
        companyCredit: company.credit,
        totalNeeded,
      });
    }

    // On remet tous les crédits à 0, puis on alloue
    for (const u of employees) {
      const current = Number(u.credit) || 0;
      if (current > 0) {
        company.credit += current; // on rembourse d'abord tout
      }

      const target = targetByUser.get(u._id.toString()) || 0;
      u.credit = target;
      u.companyMonthlyCredit = target;
      company.credit -= target;

      await u.save();
    }

    company.monthlyTotalAmount = totalNeeded;
    await company.save();

    logger.info({
      msg: "resetCompanyAllocations success",
      route: "POST /api/company/:companyId/reset-allocations",
      companyId,
      employeesCount: employees.length,
      totalAllocated: totalNeeded,
    });

    res.json({ company, employees });
  } catch (error: any) {
    logger.error({
      msg: "resetCompanyAllocations failed",
      route: "POST /api/company/:companyId/reset-allocations",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: "Impossible de réinitialiser les allocations de l'entreprise",
    });
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
  getEmployeeBookings, // 👈 ajouté
};
