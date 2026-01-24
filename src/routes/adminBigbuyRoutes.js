const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
// idéalement : un middleware admin
const adminBigbuyController = require("../controllers/adminBigbuyController");

router.get("/admin/bigbuy/status", authMiddleware, adminBigbuyController.getStatus);
router.post("/admin/bigbuy/bootstrap", authMiddleware, adminBigbuyController.startBootstrap);
router.post("/admin/bigbuy/sync", authMiddleware, adminBigbuyController.startSync);

module.exports = router;
