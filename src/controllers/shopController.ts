import ShopModel from "../models/shop";
import { Request, Response } from "express";
const jwt = require("jsonwebtoken");

// Create a new shop
export const createShop = async (req: Request, res: Response) => {
  try {
    const shop = new ShopModel(req.body);
    await shop.save();
    res.status(201).json(shop);
  } catch (error) {
    res.status(500).json({ message: "Failed to create shop", error });
  }
};

// Get all shops
export const getAllShops = async (req: Request, res: Response) => {
  try {
    const shops = await ShopModel.find().populate("professionnel", "email");
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: "Failed to get shops", error });
  }
};

// Get a single shop by ID
export const getShopById = async (req: Request, res: Response) => {
  try {
    const shop = await ShopModel.findById(req.params.id).populate(
      "professionnel"
    );
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(shop);
  } catch (error) {
    res.status(500).json({ message: "Failed to get shop", error });
  }
};

// Update a shop
export const updateShopById = async (req: Request, res: Response) => {
  try {
    const updatedShop = await ShopModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(updatedShop);
  } catch (error) {
    res.status(500).json({ message: "Failed to update shop", error });
  }
};

// Delete a shop
export const deleteShopById = async (req: Request, res: Response) => {
  try {
    const deletedShop = await ShopModel.findByIdAndDelete(req.params.id);
    if (!deletedShop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json({ message: "Shop deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete shop", error });
  }
};
