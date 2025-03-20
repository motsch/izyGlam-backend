const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour créer une nouvelle transaction
router.post("/transaction", authMiddleware, transactionController.createTransaction);

// Route pour récupérer toutes les transactions
router.get("/transaction", authMiddleware, transactionController.getAllTransactions);

// Route pour récupérer une transaction par son ID
router.get("/transaction/:id", authMiddleware, transactionController.getTransactionById);

// Route pour mettre à jour une transaction par son ID
router.put("/transaction/:id", authMiddleware, transactionController.updateTransactionById);

// Route pour supprimer une transaction par son ID
router.delete("/transaction/:id", authMiddleware, transactionController.deleteTransactionById);

module.exports = router;
