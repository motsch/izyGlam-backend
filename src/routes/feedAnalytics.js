const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

const feedAnalyticsController = require("../controllers/feedAnalytics.controller");

router.get("/pro/feed/stats", authMiddleware, feedAnalyticsController.getProFeedStats);

module.exports = router;
