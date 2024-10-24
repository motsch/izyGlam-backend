const serviceController = require("../controllers/serviceController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

const multer = require("multer"); // Importer Multer pour gérer les fichiers

// Configurer Multer pour stocker les images dans le dossier "uploads/images/gallery"
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/images/articles"); // Dossier de stockage
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Nom unique pour chaque fichier
  },
});

const upload = multer({ storage: storage });

// Route to create a new service
router.post("/service", authMiddleware, serviceController.createService);

// Route to create multiple services
router.post(
  "/services/multiple",
  authMiddleware,
  serviceController.createMultipleServices
);

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

// Route to upload images to a service's gallery
router.post(
  "/service-gallery/:id/gallery/upload",
  authMiddleware,
  upload.single("gallery"),
  serviceController.uploadGalleryImages
);

// Route to get all gallery images for a service
router.get("/service-gallery/:id/gallery", serviceController.getGalleryImages);

// Route to delete all services by shop ID
router.delete(
  "/service-delete-all-by-shop/:shopId",
  authMiddleware,
  serviceController.deleteAllServicesByShop
);

module.exports = router;
