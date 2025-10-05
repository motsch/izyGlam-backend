const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route pour récupérer les réservations d'une boutique
router.get("/booking-by-shop/:shopId", bookingController.getBookingsByShop);

// Route pour récupérer les créneaux disponibles
router.get("/available-slots/:shopId/services/:serviceId", bookingController.getAvailableSlots);

// CRUD Booking
router.post("/booking", bookingController.createBooking);
router.get("/booking", bookingController.getAllBookings);
router.get("/booking/:id", bookingController.getBookingById);
router.put("/booking/:id", bookingController.updateBookingById);
router.delete("/booking/:id", bookingController.deleteBookingById);

// Filtres par utilisateur
router.get("/booking-by-userPro/:userId", bookingController.getBookingsByUserPro);
router.get("/booking-by-client/:id", bookingController.getBookingsByClient);

// Mise à jour de statut
router.patch("/booking-update-status/:id", bookingController.updateBookingStatusById);

// KPI CA global
router.get("/ca-count-all", authMiddleware, bookingController.getAllCACount);

// Confirmation code
router.post("/bookings-confirm-code", authMiddleware, bookingController.confirmBookingCode);

// Dashboard KPI par salon
router.get("/booking-dashboard/:shopId", authMiddleware, bookingController.getDashboardStatsByShop);

module.exports = router;
