import ReservationModel from "../models/reservation";
import { Request, Response } from "express";

// Create a new reservation
export const createReservation = async (req: Request, res: Response) => {
  try {
    const reservation = new ReservationModel({
      client: req.body.client,
      service: req.body.service,
      date: new Date(req.body.date),
      statut: req.body.statut,
    });
    await reservation.save();
    res.status(201).json(reservation);
  } catch (error) {
    res.status(500).json({ message: "Failed to create reservation", error });
  }
};

// Get all reservations
export const getAllReservations = async (req: Request, res: Response) => {
  try {
    const reservations = await ReservationModel.find()
      .populate("client", "name email") // Adjust fields to what's needed
      .populate("service", "nom description prix");
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: "Failed to get reservations", error });
  }
};

// Get a single reservation by ID
export const getReservationById = async (req: Request, res: Response) => {
  try {
    const reservation = await ReservationModel.findById(req.params.id)
      .populate("client")
      .populate("service");
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: "Failed to get reservation", error });
  }
};

// Update a reservation
export const updateReservationById = async (req: Request, res: Response) => {
  try {
    const updatedReservation = await ReservationModel.findByIdAndUpdate(
      req.params.id,
      { date: req.body.date, statut: req.body.statut },
      { new: true }
    )
      .populate("client")
      .populate("service");
    if (!updatedReservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    res.json(updatedReservation);
  } catch (error) {
    res.status(500).json({ message: "Failed to update reservation", error });
  }
};

// Delete a reservation
export const deleteReservationById = async (req: Request, res: Response) => {
  try {
    const deletedReservation = await ReservationModel.findByIdAndDelete(
      req.params.id
    );
    if (!deletedReservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    res.json({ message: "Reservation deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete reservation", error });
  }
};
