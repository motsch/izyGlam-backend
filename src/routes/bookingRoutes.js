const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour récupérer les réservations d'une boutique
router.get('/shop/:shopId', bookingController.getBookingsByShop);
// Route pour récupérer les créneaux disponibles
router.get('/shops/:shopId/services/:serviceId/available-slots/:date', bookingController.getAvailableSlots);
// Autres routes pour Booking
router.post('/booking', bookingController.createBooking);
router.get('/booking', bookingController.getAllBookings);
router.get('/booking/:id', bookingController.getBookingById);
router.put('/booking/:id', bookingController.updateBookingById);
router.delete('/booking/:id', bookingController.deleteBookingById);
module.exports = router;
