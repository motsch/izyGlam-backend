const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

const adminProductController = require("../controllers/adminProductController");

// LIST + stats
router.get("/admin/products", authMiddleware, adminProductController.getAllAdmin);
router.get("/admin/products/stats", authMiddleware, adminProductController.getStats);

// DELETE
router.delete("/admin/products/:id", authMiddleware, adminProductController.deleteOne);
router.post("/admin/products/delete-many", authMiddleware, adminProductController.deleteMany);

// PURGE (tout supprimer) => ultra safe via confirm
router.post("/admin/products/purge", authMiddleware, adminProductController.purgeAll);

// BULK UPDATE
router.patch("/admin/products/bulk", authMiddleware, adminProductController.bulkUpdate);

module.exports = router;
