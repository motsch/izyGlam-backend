const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour récupérer les réservations d'une boutique
router.get('/booking-by-shop/:shopId', bookingController.getBookingsByShop);
// Route pour récupérer les créneaux disponibles
router.get('/available-slots/:shopId/services/:serviceId', bookingController.getAvailableSlots);
// Autres routes pour Booking
router.post('/booking', bookingController.createBooking);
router.get('/booking', bookingController.getAllBookings);
router.get('/booking/:id', bookingController.getBookingById);
router.put('/booking/:id', bookingController.updateBookingById);
router.delete('/booking/:id', bookingController.deleteBookingById);
router.get('/booking-by-userPro/:userId', bookingController.getBookingsByUserPro);
router.get('/booking-by-client/:id', bookingController.getBookingsByClient);
// Route pour annuler une réservation
router.patch('/booking-update-status/:id', bookingController.updateBookingStatusById);

// get number of CA on the platform
router.get("/ca-count-all", authMiddleware, bookingController.getAllCACount);

module.exports = router;
