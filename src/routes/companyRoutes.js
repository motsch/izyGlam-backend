const companyController = require("../controllers/companyController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// Route to create a new company
router.post("/company", authMiddleware, companyController.createCompany);

// Route to get all companies
router.get("/company", authMiddleware, companyController.getAllCompanies);

// Route to get a specific company by ID
router.get("/company/:id", authMiddleware, companyController.getCompanyById);

// Route to update a company
router.put("/company/:id", authMiddleware, companyController.updateCompanyById);

// Route to delete a company
router.delete("/company/:id", authMiddleware, companyController.deleteCompanyById);

// Route to get all companies by industry
router.get(
  "/companies/industry/:industry",
  authMiddleware,
  companyController.getCompaniesByIndustry
);

// Route to get all employees of a company
router.get(
  "/company/:companyId/employees",
  authMiddleware,
  companyController.getEmployeesByCompanyId
);

// Route to get all bookings of an employee
router.get(
  "/company/employee/:employeeId/bookings",
  authMiddleware,
  companyController.getEmployeeBookings
);



// --- B2B: gestion des employés & crédits ---

// Créer un employé pour une company (B2B)
router.post(
  "/company/:companyId/employees",
  authMiddleware,
  companyController.createCompanyEmployee
);

// Mettre à jour le crédit courant d'un employé (solde)
router.patch(
  "/company/:companyId/employees/:employeeId/credit",
  authMiddleware,
  companyController.updateEmployeeCurrentCredit
);

// Mettre à jour l'allocation mensuelle d'un employé (cible)
router.patch(
  "/company/:companyId/employees/:employeeId/monthly-credit",
  authMiddleware,
  companyController.updateEmployeeMonthlyCredit
);

// Activer / désactiver un employé (désactivation => retour du crédit sur l'entreprise)
router.patch(
  "/company/:companyId/employees/:employeeId/status",
  authMiddleware,
  companyController.updateEmployeeStatus
);

// Reset global des allocations (optionnel, pour plus tard)
router.post(
  "/company/:companyId/reset-allocations",
  authMiddleware,
  companyController.resetCompanyAllocations
);





module.exports = router;
