const shopController = require("../controllers/shopController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

const multer = require('multer'); // Importer Multer pour gérer les fichiers

// Configurer Multer pour stocker les images dans le dossier "uploads/images/gallery"
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/images/gallery'); // Dossier de stockage
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // Nom unique pour chaque fichier
    }
  });

const upload = multer({ storage: storage });

// Route to create a new shop
router.post("/shop", authMiddleware, shopController.createShop);

// Route to retrieve all shops
router.post("/shop-description", authMiddleware, shopController.getIzyGlamDescription);
// Route to retrieve all shops
router.get("/shop", shopController.getAllShops);

// Nouvelle route pour récupérer les shops à proximité
// Exemple d'appel : /shop/nearby?lat=48.8566&lon=2.3522
router.get("/shop/nearby", shopController.getShopsNearby);

// Nouvelle route pour récupérer les shops en fonction des codes postaux
// Exemple d'appel : /shop/delivery?codes=75001,75002
router.get("/shop/delivery", shopController.getShopsByPostalCodes);

// Route to retrieve a specific shop by ID
router.get("/shop/:id", shopController.getShopById);

// Route to update a shop
router.put("/shop/:id", authMiddleware, shopController.updateShopById);

// Route to delete a shop
router.delete("/shop/:id", authMiddleware, shopController.deleteShopById);

// Route pour récupérer les services d'une boutique
router.get('/shop/:id/services', shopController.getServicesByShop);

// Route to retrieve all shops by userId
router.get('/shops/user/:userId', shopController.getShopsByUserId);

// Route to upload images to a shop's gallery
router.post('/shop-gallery/:id/gallery/upload', authMiddleware, upload.array('gallery', 10), shopController.uploadGalleryImages);

// Route to get all gallery images for a shop
router.get('/shop-gallery/:id/gallery', shopController.getGalleryImages);


// Route to get all gallery images for a shop
router.post('/shops-by-ids', shopController.getShopsByIds);

// get number of shops on the platform
router.get("/shops-count-all", authMiddleware, shopController.getShopsAllCount);

// Route to add a review to a shop
router.patch('/shop-add-review/:id', shopController.addShopReview);

// Stats
router.put("/shop-stats/:id/impression", authMiddleware, shopController.incrementImpression);

router.put("/shop-stats/:id/display-time", authMiddleware, shopController.updateShopDisplayTime);

// ✅ Ajouter cette route dans le routeur :
router.put("/shop-stats/bulk-update", authMiddleware, shopController.bulkUpdateShopStats);

router.get('/shops-search', shopController.searchShopsWithServices);

module.exports = router;
