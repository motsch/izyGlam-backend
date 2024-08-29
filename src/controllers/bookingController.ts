import BookingModel from "../models/booking";
import * as express from "express";
import moment from "moment"; // moment.js pour faciliter les calculs de temps
import shopModel from "../models/shop";
import serviceModel from "../models/service";

// Créer une nouvelle réservation
const createBooking = async (req: express.Request, res: express.Response) => {
  try {
    const newBooking = new BookingModel(req.body);
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

// Récupérer toutes les réservations d'un utilisateur
const getBookingsByUser = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by user");
    const { userId } = req.params;
    const bookings = await BookingModel.find({ user: userId });
    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

// Récupérer les créneaux disponibles pour un service dans une boutique
const getAvailableSlots = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId } = req.params;
    let service = await serviceModel.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service non trouvé" });
    }
    const duration = service.duration; // Durée du service en minutes

    const { shopId } = req.params;
    let shop = await shopModel.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const { date } = req.params;
    const dateMoment = moment(date);
    if (!dateMoment.isValid()) {
      return res.status(400).json({ message: "Date invalide" });
    }
    const margin = 30; // Marge de sécurité en minutes

    // Récupérer les horaires d'ouverture du shop
    const openingHours = shop.hours;

    const morningStart = moment(date)
      .hours(Number(openingHours.morning.start.split(":")[0]))
      .minutes(Number(openingHours.morning.start.split(":")[1]));
    const morningEnd = moment(date)
      .hours(Number(openingHours.morning.end.split(":")[0]))
      .minutes(Number(openingHours.morning.end.split(":")[1]));

    const afternoonStart = moment(date)
      .hours(Number(openingHours.afternoon.start.split(":")[0]))
      .minutes(Number(openingHours.afternoon.start.split(":")[1]));
    const afternoonEnd = moment(date)
      .hours(Number(openingHours.afternoon.end.split(":")[0]))
      .minutes(Number(openingHours.afternoon.end.split(":")[1]));

    // Récupérer les réservations existantes pour cette boutique et cette date
    const bookings = await BookingModel.find({
      shop: shop._id,
      date: {
        $gte: moment(date).startOf("day").toDate(),
        $lt: moment(date).endOf("day").toDate(),
      },
    });

    // Fonction pour calculer les créneaux disponibles dans une plage horaire
    const calculateSlots = (startTime: moment.Moment, endTime: moment.Moment) => {
      const slots = [];
      let currentTime = startTime.clone();

      while (currentTime.add(duration, "minutes").isSameOrBefore(endTime)) {
        const slotEnd = currentTime.clone();
        const slotStart = slotEnd.clone().subtract(duration, "minutes");

        // Vérifier si ce créneau chevauche une réservation existante
        const overlap = bookings.some((booking) => {
          const bookingStart = moment(booking.date);
          const bookingEnd = bookingStart.clone().add(service!.duration + margin, "minutes");
          return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
        });

        if (!overlap) {
          slots.push({
            start: slotStart.format("HH:mm"),
            end: slotEnd.format("HH:mm"),
          });
        }

        currentTime.add(margin, "minutes"); // Ajouter la marge de sécurité
      }

      return slots;
    };

    // Calculer les créneaux pour le matin et l'après-midi
    const morningSlots = calculateSlots(morningStart, morningEnd);
    const afternoonSlots = calculateSlots(afternoonStart, afternoonEnd);

    res.json([...morningSlots, ...afternoonSlots]);
  } catch (error) {
    res.status(500).json({ message: "Impossible de calculer les créneaux disponibles" });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingById,
  deleteBookingById,
  getBookingsByShop,
  getBookingsByUser,
  getAvailableSlots,
};
