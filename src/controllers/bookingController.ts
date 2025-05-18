import BookingModel from "../models/booking";
import * as express from "express";
import moment from "moment"; // moment.js pour faciliter les calculs de temps
import shopModel from "../models/shop";
import serviceModel from "../models/service";
import userModel from "../models/user";


const getAllCACount = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Filtrer les réservations avec le statut "completed" et récupérer seulement le champ price
    const bookings = await BookingModel.find({ status: "completed" }, "price");

    // Calculer le chiffre d'affaires en additionnant toutes les valeurs de price
    const CA = bookings.reduce((total, booking) => {
      return total + parseFloat(booking.price);
    }, 0);

    res.status(200).json(CA);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le chiffre d'affaires" });
  }
};


// Créer une nouvelle réservation
const createBooking = async (req: express.Request, res: express.Response) => {
  try {
    const newBooking = new BookingModel(req.body);
    console.log(req.body)
    await newBooking.save();
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la réservation" });
  }
};

// Récupérer toutes les réservations
const getAllBookings = async (req: express.Request, res: express.Response) => {
  try {
    const bookings = await BookingModel.find();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations" });
  }
};

// Récupérer une réservation par son ID
const getBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const booking = await BookingModel.findById(id);
    if (booking) {
      res.json(booking);
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la réservation" });
  }
};

// Mettre à jour une réservation par son ID
const updateBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedBooking = await BookingModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedBooking) {
      res.json(updatedBooking);
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la réservation" });
  }
};

// Supprimer une réservation par son ID
const deleteBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedBooking = await BookingModel.findByIdAndDelete(id);
    if (deletedBooking) {
      res.json({ message: "Réservation supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la réservation" });
  }
};

// Récupérer toutes les réservations pour une boutique spécifique
const getBookingsByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { shopId } = req.params;
    const bookings = await BookingModel.find({ shop: shopId });
    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cette boutique" });
  }
};

// Récupérer toutes les réservations d'un utilisateur Pro (sans le champ generatedCode)
const getBookingsByUserPro = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by userPro");
    const { userId } = req.params;
    // Exclure le champ 'generatedCode'
    const bookings = await BookingModel.find({ userProId: userId })
      .select("-generatedCode");

    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};


// Récupérer toutes les réservations d'un utilisateur en excluant celles supprimées
const getBookingsByClient = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by user");
    const { id } = req.params;
    console.log("userId : " + id);

    // On ajoute { status: { $ne: "deleted" } } à la condition de recherche
    const bookings = await BookingModel.find({ clientId: id, status: { $ne: "deleted" } });

    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

export const getAvailableSlots = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId, shopId } = req.params;

    const service = await serviceModel.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service non trouvé" });
    const duration = service.duration;

    const shop:any = await shopModel.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Boutique non trouvée" });

    const professional = await userModel.findById(shop.idUser);
    if (!professional) return res.status(404).json({ message: "Professionnel non trouvé" });

    const ondaybooking = shop.ondaybooking;
    const margin = 30;
    const minimumDelay = moment.duration(shop.minimumDelay || "30", "minutes").asMinutes();

    const startDate = moment().startOf("day");
    const endDate = moment().add(6, "weeks").endOf("day");

    const bookings = await BookingModel.find({
      userProId: professional._id,
      start: { $gte: startDate.toDate(), $lte: endDate.toDate() },
      status: { $ne: "deleted" },
    });

    const now = moment();
    const today = now.format("YYYY-MM-DD");
    const allAvailableSlots: any[] = [];

    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, "days")) {
      const dayKey = date.format("dddd").toLowerCase();
      const daySchedule = shop.hours?.[dayKey];

      if (!daySchedule || daySchedule.closed) continue;

      const isUnavailable = professional.unavailability?.some(unavail => {
        const unavailableStart = moment(unavail.start);
        const unavailableEnd = moment(unavail.end);
        return date.isBetween(unavailableStart, unavailableEnd, "day", "[]");
      });
      if (isUnavailable) continue;

      const addSlots = (label: string, startStr: string, endStr: string) => {
        let periodStart = date.clone().hour(Number(startStr.split(":")[0])).minute(Number(startStr.split(":")[1]));
        let periodEnd = date.clone().hour(Number(endStr.split(":")[0])).minute(Number(endStr.split(":")[1]));

        let currentTime = periodStart.clone();

        // Si on est aujourd'hui et ondaybooking = false, on saute
        if (!ondaybooking && date.isSame(today, "day")) return;

        // Si on est aujourd'hui, on doit appliquer minimumDelay à now
        const minAvailableTime = now.clone().add(minimumDelay, "minutes");
        if (date.isSame(today, "day")) {
          if (minAvailableTime.isAfter(periodEnd)) return; // trop tard
          if (currentTime.isBefore(minAvailableTime)) {
            currentTime = minAvailableTime.clone();
          }
        }

        while (currentTime.clone().add(duration, "minutes").isSameOrBefore(periodEnd)) {
          const slotStart = currentTime.clone();
          const slotEnd = currentTime.clone().add(duration, "minutes");

          const isOverlapping = bookings.some(booking => {
            const bookingStart = moment(booking.start);
            const bookingEnd = moment(booking.end).add(minimumDelay, "minutes");
            return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
          });

          if (!isOverlapping) {
            allAvailableSlots.push({
              date: date.format("YYYY-MM-DD"),
              start: slotStart.format("HH:mm"),
              end: slotEnd.format("HH:mm"),
            });
            currentTime = slotEnd.clone().add(margin, "minutes");
          } else {
            currentTime.add(5, "minutes");
          }
        }
      };

      if (daySchedule.morning?.start && daySchedule.morning?.end) {
        addSlots("matin", daySchedule.morning.start, daySchedule.morning.end);
      }
      if (daySchedule.afternoon?.start && daySchedule.afternoon?.end) {
        addSlots("après-midi", daySchedule.afternoon.start, daySchedule.afternoon.end);
      }
    }

    res.json(allAvailableSlots);
  } catch (error) {
    console.error("Erreur lors du calcul des créneaux:", error);
    res.status(500).json({ message: "Erreur lors du calcul des créneaux disponibles" });
  }
};




// Annuler une réservation en mettant à jour son statut à "cancelled"
const updateBookingStatusById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const status = req.body.status;
    // Mettre à jour la réservation avec le statut "cancelled"
    const updatedBooking = await BookingModel.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
    );

    if (updatedBooking) {
      res.json({ message: "Réservation annulée avec succès", booking: updatedBooking });
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible d'annuler la réservation" });
  }
};

/**
 * Controller pour confirmer le code du booking.
 * Expects { bookingId: string, code: string } dans req.body.
 */
const confirmBookingCode = async (req: express.Request, res: express.Response) => {
  try {
    const { bookingId, code } = req.body;

    // Vérification des paramètres obligatoires
    if (!bookingId || !code) {
      return res.status(400).json({ message: "bookingId et code sont obligatoires" });
    }

    // Recherche du booking par son ID
    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking non trouvé" });
    }

    // Vérification du code
    if (booking.generatedCode === code) {
      // Mise à jour de proCodeConfirmed à true
      booking.proCodeConfirmed = true;
      await booking.save();
      return res.json({ confirmed: true });
    } else {
      // Le code ne correspond pas
      return res.json({ confirmed: false });
    }
  } catch (error) {
    console.error("Erreur lors de la confirmation du code :", error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
};



module.exports = {
  getAllCACount,
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingById,
  deleteBookingById,
  getBookingsByShop,
  getBookingsByUserPro,
  getBookingsByClient,
  getAvailableSlots,
  updateBookingStatusById,
  confirmBookingCode,
};
