const express = require("express");
const router = express.Router();

// ⚠️ adapte le chemin selon ton projet
const serviceCategoryController = require("../controllers/serviceCategoryController");

// ⚠️ adapte ton middleware d'auth
// Exemple: const authMiddleware = require("../middlewares/authMiddleware");
// router.use(authMiddleware);

/**
 * CRUD
 */
router.post("/bookingCategory", serviceCategoryController.createBookingCategory);
router.get("/bookingCategory", serviceCategoryController.getBookingCategories);
router.get("/bookingCategory/:id", serviceCategoryController.getBookingCategoryById);
router.put("/bookingCategory/:id", serviceCategoryController.updateBookingCategory);
router.delete("/bookingCategory/:id", serviceCategoryController.deleteBookingCategory);
router.get("/bookingCategory-by-shopId/:id", serviceCategoryController.getBookingCategoriesByShopId);

/**
 * Reorder (UI)
 */
router.patch("/reorder", serviceCategoryController.reorderBookingCategories);

module.exports = router;
