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
const getBookingsByUserPro = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by userPro");
    const { userId } = req.params;
    const bookings = await BookingModel.find({ userProId: userId });
    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

// Récupérer toutes les réservations d'un utilisateur
const getBookingsByClient = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by user");
    const { id } = req.params;
    console.log("userId : " + id);
    const bookings = await BookingModel.find({ clientId: id });
    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

const getAvailableSlots = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId, shopId } = req.params;

    // Obtenir les détails du service
    let service = await serviceModel.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service non trouvé" });
    }
    const duration = service.duration; // Durée du service en minutes

    // Obtenir les détails de la boutique
    let shop = await shopModel.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const margin = 30; // Marge de sécurité entre les rendez-vous

    // Récupérer le professionnel
    const professional = await userModel.findById(shop.idUser); // Supposant que le modèle shop contient une référence au professionnel
    if (!professional) {
      return res.status(404).json({ message: "Professionnel non trouvé" });
    }

    // Récupérer les réservations existantes pour le professionnel sur la période
    const startDate = moment().startOf("day");
    const endDate = moment().add(6, "weeks").endOf("day");

    const bookings = await BookingModel.find({
      userProId: professional._id,
      start: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    });

    // Vérifier si le professionnel a des disponibilités
    if (!professional.availability || professional.availability.length === 0) {
      return res.status(200).json([]); // Pas de disponibilités
    }

    const allAvailableSlots = [];

    // Boucle sur chaque jour de la période
    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'days')) {
      const dayOfWeek = date.format('dddd');

      // Vérifier si le professionnel est disponible ce jour-là
      const availablePeriods = professional.availability.find(avail => avail.day === dayOfWeek);
      if (!availablePeriods) {
        continue; // Passer au jour suivant
      }

      // Vérifier les indisponibilités
      const isUnavailable = professional.unavailability?.some(unavail => {
        const unavailableStart = moment(unavail.start);
        const unavailableEnd = moment(unavail.end);
        return date.isBetween(unavailableStart, unavailableEnd, 'day', '[]');
      });
      if (isUnavailable) {
        continue; // Passer au jour suivant
      }

      // Calculer les créneaux disponibles pour la journée
      const availableSlotsForDay = [];

      for (let period of availablePeriods.periods) {
        let periodStart = date.clone().hour(Number(period.start.split(":")[0])).minute(Number(period.start.split(":")[1]));
        let periodEnd = date.clone().hour(Number(period.end.split(":")[0])).minute(Number(period.end.split(":")[1]));

        // Initialiser currentTime pour le calcul des créneaux
        let currentTime = periodStart.clone();

        while (currentTime.add(duration, 'minutes').isSameOrBefore(periodEnd)) {
          const slotStart = currentTime.clone().subtract(duration, 'minutes');
          const slotEnd = currentTime.clone();

          // Vérifier les chevauchements avec les réservations existantes
          const isOverlapping = bookings.some(booking => {
            const bookingStart = moment(booking.start);
            const bookingEnd = moment(booking.end);

            return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
          });

          if (!isOverlapping) {
            availableSlotsForDay.push({
              date: date.format('YYYY-MM-DD'),
              start: slotStart.format('HH:mm'),
              end: slotEnd.format('HH:mm'),
            });
          }

          currentTime.add(professional.breaks?.duration || "00:20", 'minutes'); // Ajouter la marge de sécurité
        }
      }

      allAvailableSlots.push(...availableSlotsForDay);
    }

    res.json(allAvailableSlots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Impossible de calculer les créneaux disponibles" });
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
};
