const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

const feedController = require("../controllers/feed.controller");

// LIST + GET
router.get("/feed", feedController.listFeed);
router.get("/feed/:id", feedController.getFeedPostById);

// interactions (auth)
router.post("/feed/:id/view", authMiddleware, feedController.viewPost);

router.post("/feed/:id/like", authMiddleware, feedController.likePost);
router.delete("/feed/:id/like", authMiddleware, feedController.unlikePost);

router.post("/feed/:id/save", authMiddleware, feedController.savePost);
router.delete("/feed/:id/save", authMiddleware, feedController.unsavePost);

router.post("/feed/:id/cta/book", authMiddleware, feedController.ctaBook);

// follow pro
router.post("/feed/pro/:proId/follow", authMiddleware, feedController.followPro);
router.delete("/feed/pro/:proId/follow", authMiddleware, feedController.unfollowPro);

module.exports = router;
