import { Request, Response } from "express";
import BookingModel from "../models/booking"; // Vérifie le chemin de ton modèle Booking
import ShopModel from "../models/shop"; // Vérifie le chemin de ton modèle Shop
import { logger } from "../utils/logger";

export const getKpi = async (req: Request, res: Response) => {
  try {
    const { userProId } = req.params;
    const period = req.query.period ? String(req.query.period) : "jour";
    const now = new Date();

    // Déterminer la période sélectionnée
    let startDate: Date, endDate: Date;
    if (period === "jour") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "semaine") {
      const dayOfWeek = now.getDay(); // Dimanche = 0, Lundi = 1, etc.
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === "mois") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      logger.warn({
        msg: "getKpi invalid period",
        route: "GET /api/kpi/:userProId",
        method: req.method,
        url: req.originalUrl,
        period,
      });
      return res.status(400).json({ message: "Période invalide" });
    }

    logger.info({
      msg: "getKpi period window",
      route: "GET /api/kpi/:userProId",
      method: req.method,
      url: req.originalUrl,
      userProId,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Récupérer toutes les réservations de la période pour ce prestataire
    const bookings = await BookingModel.find({
      userProId,
      start: { $gte: startDate, $lte: endDate },
    });

    logger.info({
      msg: "getKpi bookings fetched",
      route: "GET /api/kpi/:userProId",
      count: bookings.length,
      statuses: bookings.map((b: any) => b.status),
    });

    // Filtrages
    const finishedBookings = bookings.filter((b: any) => b.status === "finished");
    const upcomingBookings = bookings.filter(
      (b: any) =>
        (b.status === "pending" || b.status === "accepted") && new Date(b.start) > now
    );
    const cancelledBookings = bookings.filter(
      (b: any) => b.status === "refused" || b.status === "deleted"
    );

    const bookingsCount = finishedBookings.length;

    // CA & bénéfice sur "finished"
    let revenue = 0;
    let netProfit = 0;
    finishedBookings.forEach((booking: any) => {
      const price = parseFloat(booking.price);
      const earnings = parseFloat(booking.shopEarnings);
      logger.info({
        msg: "getKpi finished booking line",
        bookingId: String(booking._id),
        price,
        earnings,
      });
      revenue += price;
      netProfit += earnings;
    });

    // Taux d'annulation
    const totalBookings = bookings.length;
    const cancellationRate = totalBookings > 0 ? cancelledBookings.length / totalBookings : 0;

    // Note moyenne du shop lié
    const shop = await ShopModel.findOne({ idUser: userProId });
    let averageRating = 0;
    if (shop && shop.reviews && shop.reviews.length > 0) {
      const sumRatings = shop.reviews.reduce((acc: number, review: any) => {
        return acc + (review.rating as unknown as number);
      }, 0);
      averageRating = sumRatings / shop.reviews.length;
      logger.info({
        msg: "getKpi shop reviews",
        reviewsCount: shop.reviews.length,
        sumRatings,
        averageRating,
      });
    } else {
      logger.info({
        msg: "getKpi no reviews for shop",
        userProId,
      });
    }

    logger.info({
      msg: "getKpi computed",
      revenue,
      netProfit,
      bookingsCount,
      upcomingBookingsCount: upcomingBookings.length,
      cancellationRate,
      averageRating,
    });

    return res.json({
      revenue,
      netProfit,
      bookingsCount,
      upcomingBookingsCount: upcomingBookings.length,
      cancellationRate,
      averageRating,
    });
  } catch (error: any) {
    logger.error({
      msg: "getKpi failed",
      route: "GET /api/kpi/:userProId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Erreur lors du calcul des KPIs" });
  }
};

export default {
  getKpi,
};
