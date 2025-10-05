import { Request, Response } from "express";
import TransactionModel from "../models/transaction";
import { logger } from "../utils/logger";

/**
 * Créer une transaction.
 * On peut fournir en option un idBooking pour tracer l'origine
 * et idUser pour préciser le client concerné.
 */
export const createTransaction = async (req: Request, res: Response) => {
  try {
    logger.info({
      msg: "transaction.create.start",
      route: req.originalUrl,
      method: req.method,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { userProId, idUser, type, amount, description, status, idBooking } = req.body;

    const transactionData: any = {
      userProId,
      type,
      amount,
      description,
      status,
      date: new Date(),
    };
    if (idBooking) transactionData.idBooking = idBooking;
    if (idUser) transactionData.idUser = idUser;

    const newTransaction = new TransactionModel(transactionData);
    await newTransaction.save();

    logger.info({
      msg: "transaction.create.success",
      id: newTransaction._id?.toString(),
      userProId,
      idUser,
      type,
      amount,
      status,
    });

    return res.status(201).json(newTransaction);
  } catch (error: any) {
    logger.error({
      msg: "transaction.create.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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
    logger.info({
      msg: "transaction.list.start",
      route: req.originalUrl,
      method: req.method,
      query: req.query,
    });

    const { userProId, idUser, idBooking } = req.query;
    let filter: any = {};
    if (userProId) filter.userProId = String(userProId);
    if (idUser) filter.idUser = String(idUser);
    if (idBooking) filter.idBooking = String(idBooking);

    const transactions = await TransactionModel.find(filter);

    logger.info({
      msg: "transaction.list.success",
      filter,
      count: transactions.length,
    });

    return res.json(transactions);
  } catch (error: any) {
    logger.error({
      msg: "transaction.list.error",
      route: req.originalUrl,
      method: req.method,
      query: req.query,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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

    logger.info({
      msg: "transaction.get_by_id.start",
      route: req.originalUrl,
      method: req.method,
      id,
    });

    const transaction = await TransactionModel.findById(id);
    if (transaction) {
      logger.info({ msg: "transaction.get_by_id.success", id });
      return res.json(transaction);
    } else {
      logger.warn({ msg: "transaction.get_by_id.not_found", id });
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "transaction.get_by_id.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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

    logger.info({
      msg: "transaction.update.start",
      route: req.originalUrl,
      method: req.method,
      id,
      bodyKeys: Object.keys(req.body || {}),
    });

    const updatedTransaction = await TransactionModel.findByIdAndUpdate(id, req.body, { new: true });
    if (updatedTransaction) {
      logger.info({ msg: "transaction.update.success", id });
      return res.json(updatedTransaction);
    } else {
      logger.warn({ msg: "transaction.update.not_found", id });
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "transaction.update.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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

    logger.info({
      msg: "transaction.delete.start",
      route: req.originalUrl,
      method: req.method,
      id,
    });

    const deletedTransaction = await TransactionModel.findByIdAndDelete(id);
    if (deletedTransaction) {
      logger.info({ msg: "transaction.delete.success", id });
      return res.json({ message: "Transaction supprimée avec succès" });
    } else {
      logger.warn({ msg: "transaction.delete.not_found", id });
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "transaction.delete.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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
