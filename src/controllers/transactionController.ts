import { Request, Response } from "express";
import TransactionModel from "../models/transaction";

/**
 * Créer une transaction.
 * On peut fournir en option un idBooking pour tracer l'origine
 * et idUser pour préciser le client concerné.
 */
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { userProId, idUser, type, amount, description, status, idBooking } = req.body;
    // Préparation de l'objet transaction
    const transactionData: any = {
      userProId,
      type,
      amount,
      description,
      status,
      date: new Date()
    };
    if (idBooking) transactionData.idBooking = idBooking;
    if (idUser) transactionData.idUser = idUser;

    const newTransaction = new TransactionModel(transactionData);
    await newTransaction.save();
    return res.status(201).json(newTransaction);
  } catch (error) {
    console.error("Erreur lors de la création de la transaction :", error);
    return res.status(500).json({ message: "Erreur lors de la création de la transaction", error });
  }
};

/**
 * Récupérer toutes les transactions.
 * Possibilité de filtrer par :
 * - userProId : l'id du prestataire
 * - idUser    : l'id du client
 * - idBooking : l'id du booking
 */
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const { userProId, idUser, idBooking } = req.query;
    let filter: any = {};
    if (userProId) {
      filter.userProId = String(userProId);
    }
    if (idUser) {
      filter.idUser = String(idUser);
    }
    if (idBooking) {
      filter.idBooking = String(idBooking);
    }
    const transactions = await TransactionModel.find(filter);
    return res.json(transactions);
  } catch (error) {
    console.error("Erreur lors de la récupération des transactions :", error);
    return res.status(500).json({ message: "Erreur lors de la récupération des transactions", error });
  }
};

/**
 * Récupérer une transaction par son ID.
 */
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await TransactionModel.findById(id);
    if (transaction) {
      return res.json(transaction);
    } else {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de la transaction :", error);
    return res.status(500).json({ message: "Erreur lors de la récupération de la transaction", error });
  }
};

/**
 * Mettre à jour une transaction par son ID.
 */
export const updateTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedTransaction = await TransactionModel.findByIdAndUpdate(id, req.body, { new: true });
    if (updatedTransaction) {
      return res.json(updatedTransaction);
    } else {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la transaction :", error);
    return res.status(500).json({ message: "Erreur lors de la mise à jour de la transaction", error });
  }
};

/**
 * Supprimer une transaction par son ID.
 */
export const deleteTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedTransaction = await TransactionModel.findByIdAndDelete(id);
    if (deletedTransaction) {
      return res.json({ message: "Transaction supprimée avec succès" });
    } else {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
  } catch (error) {
    console.error("Erreur lors de la suppression de la transaction :", error);
    return res.status(500).json({ message: "Erreur lors de la suppression de la transaction", error });
  }
};

export default {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransactionById,
  deleteTransactionById,
};
