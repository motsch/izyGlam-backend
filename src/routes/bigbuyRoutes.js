const express = require("express");
const router = express.Router();

const bigbuyController = require("../controllers/bigbuyController");
const authMiddleware = require("../middlewares/authMiddleware");

router.post("/admin/bigbuy/import", authMiddleware, bigbuyController.importCatalog);

// ✅ NEW
router.post("/admin/bigbuy/sync-stock", authMiddleware, bigbuyController.syncStock);
router.post("/admin/bigbuy/sync-prices", authMiddleware, bigbuyController.syncPrices);
router.post("/admin/bigbuy/sync-products-information", authMiddleware, bigbuyController.syncProductsInformation);

module.exports = router;
