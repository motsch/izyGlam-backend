const express = require("express");
const reservationController = require("../controllers/reservationController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// Route to create a new reservation
router.post(
  "/reservation",
  authMiddleware,
  reservationController.createReservation
);

// Route to retrieve all reservations
router.get(
  "/reservation",
  authMiddleware,
  reservationController.getAllReservations
);

// Route to retrieve a specific reservation by ID
router.get(
  "/reservation/:id",
  authMiddleware,
  reservationController.getReservationById
);

// Route to update a reservation
router.put(
  "/reservation/:id",
  authMiddleware,
  reservationController.updateReservationById
);

// Route to delete a reservation
router.delete(
  "/reservation/:id",
  authMiddleware,
  reservationController.deleteReservationById
);

module.exports = router;
