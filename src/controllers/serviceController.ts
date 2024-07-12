import ServiceModel from "../models/service";
import { Request, Response } from "express";

// Create a new service
export const createService = async (req: Request, res: Response) => {
  try {
    const service = new ServiceModel(req.body);
    await service.save();
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ message: "Failed to create service", error });
  }
};

// Get all services
export const getAllServices = async (req: Request, res: Response) => {
  try {
    const services = await ServiceModel.find().populate("shop");
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Failed to get services", error });
  }
};

// Get a single service by ID
export const getServiceById = async (req: Request, res: Response) => {
  try {
    const service = await ServiceModel.findById(req.params.id).populate("shop");
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: "Failed to get service", error });
  }
};

// Update a service
export const updateServiceById = async (req: Request, res: Response) => {
  try {
    const updatedService = await ServiceModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedService) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json(updatedService);
  } catch (error) {
    res.status(500).json({ message: "Failed to update service", error });
  }
};

// Delete a service
export const deleteServiceById = async (req: Request, res: Response) => {
  try {
    const deletedService = await ServiceModel.findByIdAndDelete(req.params.id);
    if (!deletedService) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete service", error });
  }
};
