const express = require("express");
const router = express.Router();
const fakePostController = require("../controllers/fakePostController");
const authMiddleware = require("../middlewares/authMiddleware");

// ✅ PUBLIC (toujours en haut, avant /:id)
router.get("/fake-post/random", fakePostController.getRandomFakePost);

// ADMIN CRUD (protégé)
router.post("/fake-post", authMiddleware, fakePostController.createFakePost);
router.get("/fake-post", authMiddleware, fakePostController.getAllFakePosts);
router.get("/fake-post/:id", authMiddleware, fakePostController.getFakePostById);
router.put("/fake-post/:id", authMiddleware, fakePostController.updateFakePostById);
router.delete("/fake-post/:id", authMiddleware, fakePostController.deleteFakePostById);

module.exports = router;
