// financialController.ts
import { Request, Response } from "express";
import BookingModel from "../models/booking";
import TransactionModel, { ITransaction } from "../models/transaction";
import Stripe from "stripe";
import * as dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia", // Adaptée à votre configuration
});

/**
 * Création du paiement initial lors de la réservation.
 * Le client est débité de la totalité et la plateforme reçoit l'intégralité en séquestre.
 */
export const createInitialPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = req.body.booking;
    if (!booking) {
      res.status(400).json({ error: "Booking data is required" });
      return;
    }

    // Conversion du montant en cents
    const totalAmount = Math.round(parseFloat(booking.price) * 100);

    // Transaction pour le client (débit)
    const clientTransaction = new TransactionModel({
      idUser: booking.clientId,
      operation: "debit",
      category: "earnings", // on considère que le paiement initial représente une dépense client
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

    res.status(201).json({
      clientTransaction,
      platformTransaction,
    });
  } catch (error: any) {
    console.error("Erreur lors de la création du paiement initial :", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Processus de remboursement.
 * Selon refundType, on effectue un remboursement complet ou partiel.
 *
 * refundType possible :
 * - "customer-cancel-greater-than-24" : annulation client > 24h (remboursement complet)
 * - "customer-cancel-less-than-24" : annulation client < 24h (remboursement partiel)
 * - "provider-cancel" : annulation par le prestataire (remboursement complet)
 * - "no-show-pro" : prestataire absent (remboursement complet du client)
 *
 * Pour un remboursement, on met à jour les transactions initiales en "completed",
 * puis on crée des transactions d'ajustement : la plateforme est débitée et le client est crédité.
 */
export const processRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, refundType } = req.body;
    if (!bookingId || !refundType) {
      res.status(400).json({ error: "bookingId and refundType are required" });
      return;
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    let refund;
    // Pour les remboursements complets
    if (
      refundType === "customer-cancel-greater-than-24" ||
      refundType === "provider-cancel" ||
      refundType === "no-show-pro"
    ) {
      // Préparation du payload de remboursement
      const refundPayload: any = { payment_intent: booking.paymentIntentId };
      // Remboursement complet (pas de montant précis)
      refund = await stripe.refunds.create(refundPayload);

      // Mise à jour des transactions initiales en "completed"
      const transactions = await TransactionModel.find({ idBooking: bookingId });
      for (const tx of transactions) {
        tx.status = "completed";
        await tx.save();
      }

      // Ajustement : débiter la plateforme et créditer le client du montant total
      const totalCents = Math.round(parseFloat(booking.price) * 100);
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
    }
    // Pour les remboursements partiels (<24h) : remboursement de 50%
    else if (refundType === "customer-cancel-less-than-24") {
      const totalAmount = parseFloat(booking.price);
      const refundAmount = Math.round(totalAmount * 0.5 * 100); // en cents

      const refundPayload: any = {
        payment_intent: booking.paymentIntentId,
        amount: refundAmount,
      };
      refund = await stripe.refunds.create(refundPayload);

      // Mise à jour des transactions initiales en "completed"
      const transactions = await TransactionModel.find({ idBooking: bookingId });
      for (const tx of transactions) {
        tx.status = "completed";
        await tx.save();
      }

      // Ajustement pour remboursement partiel : débiter la plateforme et créditer le client pour refundAmount
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
    } else {
      res.status(400).json({ error: "Invalid refundType" });
      return;
    }

    res.status(200).json({ refund });
  } catch (error: any) {
    console.error("Erreur dans processRefund :", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Processus de versement (payout) au prestataire une fois la prestation terminée.
 * La plateforme transfère le montant net (shop earnings) au prestataire.
 * Cela se traduit par un débit sur le compte de la plateforme et un crédit sur le compte du prestataire.
 */
export const processPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      res.status(400).json({ error: "bookingId is required" });
      return;
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Conversion du montant net à payer au prestataire en cents
    const shopEarnings = Math.round(parseFloat(booking.shopEarnings) * 100);

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

    res.status(200).json({
      message: "Payout processed",
      platformDebit,
      providerCredit,
    });
  } catch (error: any) {
    console.error("Erreur dans processPayout :", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Processus de retrait pour un prestataire.
 * Calcule le solde du prestataire en parcourant toutes ses transactions,
 * puis enregistre une transaction de type "withdrawal" pour vider son solde.
 */
export const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userProId } = req.body;
    if (!userProId) {
      res.status(400).json({ error: "userProId is required" });
      return;
    }

    const transactions = await TransactionModel.find({ userProId });
    let balance = 0;
    transactions.forEach((tx) => {
      if (tx.operation === "credit") {
        balance += tx.amount;
      } else if (tx.operation === "debit" || tx.operation === "withdrawal") {
        balance -= tx.amount;
      }
    });

    const withdrawalTransaction = new TransactionModel({
      userProId,
      operation: "withdrawal",
      category: "withdrawal",
      amount: balance, // montant en cents
      description: `Retrait demandé pour le prestataire ${userProId}`,
      status: "completed",
    });
    await withdrawalTransaction.save();

    res.status(200).json({
      message: "Withdrawal processed",
      withdrawalTransaction,
    });
  } catch (error: any) {
    console.error("Erreur dans processWithdrawal :", error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  createInitialPayment,
  processRefund,
  processPayout,
  processWithdrawal,
};
