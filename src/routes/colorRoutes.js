const express = require("express");
const router = express.Router();
const colorController = require("../controllers/colorController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route to create a new color
router.post("/color", authMiddleware, colorController.createColor);

// Route to retrieve all colors
router.get("/color", colorController.getAllColors);

// Route to retrieve a specific color by ID
router.get("/color/:id", colorController.getColorById);

// Route to update a color by ID
router.put("/color/:id", authMiddleware, colorController.updateColorById);

// Route to delete a color by ID
router.delete("/color/:id", authMiddleware, colorController.deleteColorById);

module.exports = router;
