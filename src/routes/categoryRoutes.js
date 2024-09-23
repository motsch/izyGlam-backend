const categoryController = require("../controllers/categoryController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// Route to create a new category
router.post("/category", authMiddleware, categoryController.createCategory);

// Route to retrieve all categories
router.get("/category", categoryController.getAllCategories);

// Route to retrieve a specific category by ID
router.get("/category/:id", categoryController.getCategoryById);

// Route to update a category
router.put("/category/:id", authMiddleware, categoryController.updateCategoryById);

// Route to delete a category
router.delete("/category/:id", authMiddleware, categoryController.deleteCategoryById);

module.exports = router;
