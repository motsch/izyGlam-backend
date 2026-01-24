import * as express from "express";
import OrderModel from "../models/order";

export const getMyOrders = async (req: express.Request, res: express.Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const orders = await OrderModel.find({ buyerId: userId })
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ items: orders });
};

export const getMyOrderById = async (req: express.Request, res: express.Response) => {
  const userId = (req as any).user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const id = String(req.params.id || "");
  const order = await OrderModel.findOne({ _id: id, buyerId: userId }).lean();
  if (!order) return res.status(404).json({ message: "Order not found" });

  return res.json(order);
};

module.exports = { getMyOrders, getMyOrderById };
