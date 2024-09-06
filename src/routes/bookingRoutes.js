const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour récupérer les réservations d'une boutique
router.get('/booking-by-shop/:shopId', bookingController.getBookingsByShop);
// Route pour récupérer les créneaux disponibles
router.get('/booking/:shopId/services/:serviceId/available-slots/:date', bookingController.getAvailableSlots);
// Autres routes pour Booking
router.post('/booking', bookingController.createBooking);
router.get('/booking', bookingController.getAllBookings);
router.get('/booking/:id', bookingController.getBookingById);
router.put('/booking/:id', bookingController.updateBookingById);
router.delete('/booking/:id', bookingController.deleteBookingById);
// router.get('/booking/user/:id', bookingController.getBookingByUser);
module.exports = router;
