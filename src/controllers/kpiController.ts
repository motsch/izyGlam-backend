import { Request, Response } from "express";
import BookingModel from "../models/booking"; // Vérifie le chemin de ton modèle Booking
import ShopModel from "../models/shop"; // Vérifie le chemin de ton modèle Shop

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
      console.log("Période invalide :", period);
      return res.status(400).json({ message: "Période invalide" });
    }

    console.log("Période :", period);
    console.log("Start Date :", startDate);
    console.log("End Date :", endDate);

    // Récupérer toutes les réservations de la période pour ce prestataire
    const bookings = await BookingModel.find({
      userProId,
      start: { $gte: startDate, $lte: endDate },
    });
    console.log("Total bookings récupérées :", bookings.length);
    console.log("Statuts des bookings :", bookings.map(b => b.status));

    /* 
      Filtrage des réservations :
      - finishedBookings : réservations réalisées (seulement celles dont le statut est "finished")
      - upcomingBookings : réservations dont le statut est "pending" ou "accepted" ET dont la date de début est postérieure à "now"
      - cancelledBookings : réservations annulées, ici celles dont le statut est "refused" ou "deleted"
    */
    const finishedBookings = bookings.filter(b => b.status === "finished");
    const upcomingBookings = bookings.filter(b => 
      (b.status === "pending" || b.status === "accepted") && new Date(b.start) > now
    );
    const cancelledBookings = bookings.filter(b => b.status === "refused" || b.status === "deleted");

    console.log("Finished bookings :", finishedBookings.length);
    console.log("Upcoming bookings :", upcomingBookings.length);
    console.log("Cancelled/Refused/Deleted bookings :", cancelledBookings.length);

    const bookingsCount = finishedBookings.length;
    
    // Calcul du chiffre d'affaires et du bénéfice uniquement sur les réservations "finished"
    let revenue = 0;
    let netProfit = 0;
    finishedBookings.forEach(booking => {
      const price = parseFloat(booking.price);
      const earnings = parseFloat(booking.shopEarnings);
      console.log(`Booking ID: ${booking._id} - Price: ${price}, ShopEarnings: ${earnings}`);
      revenue += price;
      netProfit += earnings;
    });

    // Calcul du taux d'annulation : (bookings refusées ou supprimées) / (nombre total de bookings récupérées)
    const totalBookings = bookings.length;
    const cancellationRate = totalBookings > 0 ? cancelledBookings.length / totalBookings : 0;
    console.log("Total bookings :", totalBookings);
    console.log("Cancellation rate :", cancellationRate);

    // Récupérer la moyenne des notes à partir des reviews du shop lié à ce userProId
    const shop = await ShopModel.findOne({ idUser: userProId });
    let averageRating = 0;
    if (shop && shop.reviews && shop.reviews.length > 0) {
      const sumRatings = shop.reviews.reduce((acc: number, review) => {
        return acc + (review.rating as unknown as number);
      }, 0);
      averageRating = sumRatings / shop.reviews.length;
      console.log("Shop reviews count :", shop.reviews.length, " - Sum of ratings :", sumRatings);
    } else {
      console.log("Aucune review trouvée pour le shop.");
    }

    console.log("KPIs calculés : Revenue =", revenue, ", Net Profit =", netProfit, ", Bookings Count =", bookingsCount);

    return res.json({
      revenue,
      netProfit,
      bookingsCount,
      upcomingBookingsCount: upcomingBookings.length,
      cancellationRate,
      averageRating,
    });
  } catch (error) {
    console.error("Erreur lors du calcul des KPIs :", error);
    return res.status(500).json({ message: "Erreur lors du calcul des KPIs" });
  }
};

export default {
  getKpi,
};
