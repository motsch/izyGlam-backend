const serviceController = require("../controllers/serviceController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();
// Route to create a new service
router.post("/service", authMiddleware, serviceController.createService);

// Route to get all services
router.get("/service", authMiddleware, serviceController.getAllServices);

// Route to get a specific service by ID
router.get("/service/:id", authMiddleware, serviceController.getServiceById);

// Route to update a service
router.put("/service/:id", authMiddleware, serviceController.updateServiceById);

// Route to delete a service
router.delete(
  "/service/:id",
  authMiddleware,
  serviceController.deleteServiceById
);

// Route to get all services of a shop
router.get("/shop/:id/services", serviceController.getServicesByShop);

module.exports = router;
