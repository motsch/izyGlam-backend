const serviceTemplateController = require("../controllers/serviceTemplateController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// Route to create a new serviceTemplate
router.post("/serviceTemplate", authMiddleware, serviceTemplateController.createServiceTemplate);

// Route to get all serviceTemplates
router.get("/serviceTemplate", authMiddleware, serviceTemplateController.getAllServiceTemplates);

// Route to get a specific serviceTemplate by ID
router.get("/serviceTemplate/:id", authMiddleware, serviceTemplateController.getServiceTemplateById);

// Route to update a serviceTemplate
router.put("/serviceTemplate/:id", authMiddleware, serviceTemplateController.updateServiceTemplateById); // Correction ici

// Route to delete a serviceTemplate
router.delete("/serviceTemplate/:id", authMiddleware, serviceTemplateController.deleteServiceTemplateById);

// Route to get all serviceTemplates of a shop
router.get("/shop/:type/serviceTemplates", serviceTemplateController.getServiceTemplatesByCategory);

router.get("/serviceTemplateUniqueByType", serviceTemplateController.getUniqueServiceTemplatesByType);

module.exports = router;
