const express = require("express");
const router = express.Router();

// ⚠️ adapte le chemin selon ton projet
const bookingCategoryController = require("../controllers/serviceCategoryController");

// ⚠️ adapte ton middleware d'auth
// Exemple: const authMiddleware = require("../middlewares/authMiddleware");
// router.use(authMiddleware);

/**
 * CRUD
 */
router.post("/bookingCategory", bookingCategoryController.createBookingCategory);
router.get("/bookingCategory", bookingCategoryController.getBookingCategories);
router.get("/bookingCategory/:id", bookingCategoryController.getBookingCategoryById);
router.put("/bookingCategory/:id", bookingCategoryController.updateBookingCategory);
router.delete("/bookingCategory/:id", bookingCategoryController.deleteBookingCategory);
router.get("/bookingCategory-by-shopId/:id", bookingCategoryController.getBookingCategoriesByShopId);

/**
 * Reorder (UI)
 */
router.patch("/reorder", bookingCategoryController.reorderBookingCategories);

module.exports = router;
