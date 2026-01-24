const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

const proFeedController = require("../controllers/proFeed.controller");

router.post("/pro/feed/posts", authMiddleware, proFeedController.createPost);
router.patch("/pro/feed/posts/:id", authMiddleware, proFeedController.updatePost);
router.post("/pro/feed/posts/:id/publish", authMiddleware, proFeedController.publishPost);
router.delete("/pro/feed/posts/:id", authMiddleware, proFeedController.deletePost);

module.exports = router;
