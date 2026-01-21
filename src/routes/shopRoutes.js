const shopController = require("../controllers/shopController");
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

const multer = require("multer");
const path = require("path");

// ----------------------------
// Multer - Gallery images
// ----------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/images/gallery");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ----------------------------
// Multer - Shop main images
// ----------------------------
const storageShop = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/images/shops");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const uploadShopImage = multer({ storage: storageShop });

// ----------------------------
// Multer - Verification docs
// ----------------------------
const storageDocs = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/docs");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});
const uploadVerificationDocs = multer({ storage: storageDocs });

// ========================================
// CREATE / UPDATE / GET
// ========================================

// Create shop
router.post("/shop", authMiddleware, shopController.createShop);

// Get all shops (public)
router.get("/shop", shopController.getAllShops);

// Get all shops admin
router.get("/shop-admin", shopController.getAllShopsAdmin);

// Get by id
router.get("/shop/:id", shopController.getShopById);

// Update
router.put("/shop/:id", authMiddleware, shopController.updateShopById);

// Delete
router.delete("/shop/:id", authMiddleware, shopController.deleteShopById);

// Services of a shop
router.get("/shop/:id/services", shopController.getServicesByShop);

// Shops by userId
router.get("/shops/user/:userId", shopController.getShopsByUserId);

// Shops by boss
router.get("/shops-by-boss", authMiddleware, shopController.getShopsByBoss);

// ========================================
// AI / Description / Image
// ========================================
router.post("/product-description", authMiddleware, shopController.getIzyGlamProductDescription);
router.post("/shop-description", authMiddleware, shopController.getIzyGlamDescription);
router.post("/prestation-image", authMiddleware, shopController.uploadServiceImageAI);

router.post("/shop-image/process", authMiddleware, shopController.processShopImage);

// ========================================
// Verification docs
// ========================================

// ⚠️ cette route était bizarre (/:id/verification-docs) et sans auth.
// Je te la laisse, mais c’est risqué. Idéalement à supprimer.
// Si tu en as besoin : mets authMiddleware et préfixe /shop
router.post(
  "/shop/:id/verification-docs",
  authMiddleware,
  uploadVerificationDocs.fields([
    { name: "identityDoc", maxCount: 1 },
    { name: "insuranceDoc", maxCount: 1 },
    { name: "kbisDoc", maxCount: 1 },
  ]),
  shopController.uploadVerificationDocs
);

// Get verification status
router.get("/shop/:id/verification", authMiddleware, shopController.getShopVerificationStatus);

// Admin validate doc
router.post("/shop/validate-document", authMiddleware, shopController.validateVerificationDoc);

// ========================================
// Gallery images
// ========================================
router.post(
  "/shop-gallery/:id/gallery/upload",
  authMiddleware,
  upload.array("gallery", 10),
  shopController.uploadGalleryImages
);
router.get("/shop-gallery/:id/gallery", shopController.getGalleryImages);

// ========================================
// Stats
// ========================================
router.get("/shops-count-all", authMiddleware, shopController.getShopsAllCount);

router.put("/shop-stats/:id/impression", authMiddleware, shopController.incrementImpression);
router.put("/shop-stats/:id/display-time", authMiddleware, shopController.updateShopDisplayTime);
router.put("/shop-stats/bulk-update", authMiddleware, shopController.bulkUpdateShopStats);

// ========================================
// Mode SALON / DOMICILE (✅ NEW CLEAN ROUTE)
// ========================================

// ✅ NEW : endpoint propre (mode obligatoire)
router.get(
  "/shop-search/by-postal-codes-with-categories",
  shopController.getShopsByPostalCodesWithCategories
);

// ✅ LEGACY : si tu veux garder l’ancien comportement,
// tu peux laisser /shop/deliveryAll => liste brute
router.get("/shop/deliveryAll", shopController.getShopsByPostalCodes);

// ⚠️ IMPORTANT : ne laisse plus /shop/delivery pointer vers la version "mode obligatoire"
// car ton front legacy l'appelle sans mode.
// => soit tu supprimes /shop/delivery,
// => soit tu le fais pointer vers une version qui met un mode par défaut.
//
// Ici je fais un choix "safe" : /shop/delivery devient alias du nouveau,
// mais avec default mode=DOMICILE si absent (à implémenter dans le controller).
router.get("/shop/delivery", shopController.getShopsByPostalCodesWithCategories);

// ========================================
// Search
// ========================================
router.get("/shops-search", shopController.searchShopsWithServices);

// ========================================
// Moderation / block
// ========================================
router.post("/shop/:id/block", authMiddleware, shopController.blockShopAndRefundBookings);

// ========================================
// Handle
// ========================================
router.post("/shop-handle/suggest", shopController.suggestHandle);
router.get("/shop-handle/available", shopController.isHandleAvailable);
router.get("/shop-handle/:handle", shopController.getShopByHandle);

module.exports = router;
