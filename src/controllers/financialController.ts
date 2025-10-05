// financialController.ts
import { Request, Response } from "express";
import BookingModel from "../models/booking";
import TransactionModel from "../models/transaction";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Garde ta version si tu en as besoin via ENV ; sinon Stripe utilisera la par défaut du compte.
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

// -- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban", "authorization", "api_key", "apikey", "secret"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

/**
 * Création du paiement initial lors de la réservation.
 * Le client est débité de la totalité et la plateforme reçoit l'intégralité en séquestre.
 */
export const createInitialPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = (req.body as any)?.booking;
    if (!booking) {
      logger.warn({
        msg: "createInitialPayment bad request (booking missing)",
        route: "POST /api/financial/initial-payment",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      res.status(400).json({ error: "Booking data is required" });
      return;
    }

    const totalAmount = Math.round(parseFloat(booking.price) * 100); // en cents

    // Transaction pour le client (débit)
    const clientTransaction = new TransactionModel({
      idUser: booking.clientId,            // côté client
      operation: "debit",
      category: "earnings",
      amount: totalAmount,
      description: `Paiement pour booking ${booking._id} - ${booking.productName}`,
      status: "pending",
      idBooking: booking._id,
    });
    await clientTransaction.save();

    // Transaction pour la plateforme (crédit)
    const platformTransaction = new TransactionModel({
      userProId: "platform",
      operation: "credit",
      category: "earnings",
      amount: totalAmount,
      description: `Fonds reçus pour booking ${booking._id} - ${booking.productName}`,
      status: "pending",
      idBooking: booking._id,
    });
    await platformTransaction.save();

    logger.info({
      msg: "createInitialPayment success",
      route: "POST /api/financial/initial-payment",
      method: req.method,
      url: req.originalUrl,
      bookingId: booking._id,
      amountCents: totalAmount,
    });

    res.status(201).json({ clientTransaction, platformTransaction });
  } catch (error: any) {
    logger.error({
      msg: "createInitialPayment failed",
      route: "POST /api/financial/initial-payment",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

/**
 * Processus de remboursement (complet ou partiel selon refundType).
 */
export const processRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, refundType } = req.body;
    if (!bookingId || !refundType) {
      logger.warn({
        msg: "processRefund bad request (missing fields)",
        route: "POST /api/financial/refund",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      res.status(400).json({ error: "bookingId and refundType are required" });
      return;
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      logger.warn({
        msg: "processRefund booking not found",
        route: "POST /api/financial/refund",
        method: req.method,
        url: req.originalUrl,
        bookingId,
      });
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    let refund: Stripe.Response<Stripe.Refund>;

    // Remboursements complets
    if (
      refundType === "customer-cancel-greater-than-24" ||
      refundType === "provider-cancel" ||
      refundType === "no-show-pro"
    ) {
      const refundPayload: Stripe.RefundCreateParams = { payment_intent: booking.paymentIntentId as string };
      refund = await stripe.refunds.create(refundPayload);

      // Marque les transactions initiales comme "completed"
      const transactions = await TransactionModel.find({ idBooking: bookingId });
      for (const tx of transactions) {
        tx.status = "completed";
        await tx.save();
      }

      const totalCents = Math.round(parseFloat(booking.price) * 100);

      // Débit plateforme
      const adjustmentDebit = new TransactionModel({
        userProId: "platform",
        operation: "debit",
        category: "refund",
        amount: totalCents,
        description: `Ajustement pour remboursement intégral du booking ${bookingId}`,
        status: "completed",
        idBooking: bookingId,
      });
      await adjustmentDebit.save();

      // Crédit client
      const adjustmentCredit = new TransactionModel({
        idUser: booking.clientId,
        operation: "credit",
        category: "refund",
        amount: totalCents,
        description: `Remboursement intégral pour booking ${bookingId}`,
        status: "completed",
        idBooking: bookingId,
      });
      await adjustmentCredit.save();

      logger.info({
        msg: "processRefund full success",
        route: "POST /api/financial/refund",
        method: req.method,
        url: req.originalUrl,
        bookingId,
        refundId: refund.id,
        amountCents: totalCents,
      });
    }
    // Remboursement partiel 50% (<24h)
    else if (refundType === "customer-cancel-less-than-24") {
      const totalAmount = parseFloat(booking.price);
      const refundAmount = Math.round(totalAmount * 0.5 * 100);

      const refundPayload: Stripe.RefundCreateParams = {
        payment_intent: booking.paymentIntentId as string,
        amount: refundAmount,
      };
      refund = await stripe.refunds.create(refundPayload);

      const transactions = await TransactionModel.find({ idBooking: bookingId });
      for (const tx of transactions) {
        tx.status = "completed";
        await tx.save();
      }

      // Débit plateforme
      const adjustmentDebit = new TransactionModel({
        userProId: "platform",
        operation: "debit",
        category: "refund",
        amount: refundAmount,
        description: `Ajustement plateforme pour remboursement partiel (<24h) du booking ${bookingId}`,
        status: "completed",
        idBooking: bookingId,
      });
      await adjustmentDebit.save();

      // Crédit client
      const adjustmentCredit = new TransactionModel({
        idUser: booking.clientId,
        operation: "credit",
        category: "refund",
        amount: refundAmount,
        description: `Remboursement partiel (<24h) pour booking ${bookingId}`,
        status: "completed",
        idBooking: bookingId,
      });
      await adjustmentCredit.save();

      logger.info({
        msg: "processRefund partial success",
        route: "POST /api/financial/refund",
        method: req.method,
        url: req.originalUrl,
        bookingId,
        refundId: refund.id,
        amountCents: refundAmount,
      });
    } else {
      logger.warn({
        msg: "processRefund invalid refundType",
        route: "POST /api/financial/refund",
        method: req.method,
        url: req.originalUrl,
        refundType,
      });
      res.status(400).json({ error: "Invalid refundType" });
      return;
    }

    res.status(200).json({ refund });
  } catch (error: any) {
    logger.error({
      msg: "processRefund failed",
      route: "POST /api/financial/refund",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

/**
 * Versement (payout) au prestataire une fois la prestation terminée.
 */
export const processPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      logger.warn({
        msg: "processPayout bad request (missing bookingId)",
        route: "POST /api/financial/payout",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      res.status(400).json({ error: "bookingId is required" });
      return;
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      logger.warn({
        msg: "processPayout booking not found",
        route: "POST /api/financial/payout",
        method: req.method,
        url: req.originalUrl,
        bookingId,
      });
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const shopEarnings = Math.round(parseFloat(booking.shopEarnings) * 100); // en cents

    // Débiter la plateforme
    const platformDebit = new TransactionModel({
      userProId: "platform",
      operation: "debit",
      category: "payout",
      amount: shopEarnings,
      description: `Versement au prestataire pour booking ${bookingId}`,
      status: "completed",
      idBooking: bookingId,
    });
    await platformDebit.save();

    // Créditer le prestataire
    const providerCredit = new TransactionModel({
      userProId: booking.userProId,
      operation: "credit",
      category: "payout",
      amount: shopEarnings,
      description: `Versement reçu pour booking ${bookingId}`,
      status: "completed",
      idBooking: bookingId,
    });
    await providerCredit.save();

    logger.info({
      msg: "processPayout success",
      route: "POST /api/financial/payout",
      method: req.method,
      url: req.originalUrl,
      bookingId,
      amountCents: shopEarnings,
    });

    res.status(200).json({
      message: "Payout processed",
      platformDebit,
      providerCredit,
    });
  } catch (error: any) {
    logger.error({
      msg: "processPayout failed",
      route: "POST /api/financial/payout",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

/**
 * Retrait (withdrawal) pour un prestataire : calcule le solde et le vide.
 */
export const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userProId } = req.body;
    if (!userProId) {
      logger.warn({
        msg: "processWithdrawal bad request (missing userProId)",
        route: "POST /api/financial/withdrawal",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      res.status(400).json({ error: "userProId is required" });
      return;
    }

    const transactions = await TransactionModel.find({ userProId });
    let balance = 0;
    transactions.forEach((tx) => {
      if (tx.operation === "credit") balance += tx.amount;
      else if (tx.operation === "debit" || tx.operation === "withdrawal") balance -= tx.amount;
    });

    const withdrawalTransaction = new TransactionModel({
      userProId,
      operation: "withdrawal",
      category: "withdrawal",
      amount: balance, // en cents (peut être 0)
      description: `Retrait demandé pour le prestataire ${userProId}`,
      status: "completed",
    });
    await withdrawalTransaction.save();

    logger.info({
      msg: "processWithdrawal success",
      route: "POST /api/financial/withdrawal",
      method: req.method,
      url: req.originalUrl,
      userProId,
      balanceCents: balance,
    });

    res.status(200).json({
      message: "Withdrawal processed",
      withdrawalTransaction,
    });
  } catch (error: any) {
    logger.error({
      msg: "processWithdrawal failed",
      route: "POST /api/financial/withdrawal",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

export default {
  createInitialPayment,
  processRefund,
  processPayout,
  processWithdrawal,
};
