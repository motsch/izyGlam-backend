import ShopModel from "../models/shop";
import ServiceModel from "../models/service";
import * as express from "express";

// Créer une nouvelle boutique (shop)
const createShop = async (req: express.Request, res: express.Response) => {
  try {
    console.log("IN CREATE");
    console.log(req.body);
    const newShop = new ShopModel(req.body);
    await newShop.save();
    res.status(201).json(newShop);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la boutique" });
  }
};

// Récupérer toutes les boutiques
const getAllShops = async (req: express.Request, res: express.Response) => {
  try {
    const shops = await ShopModel.find();
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les boutiques" });
  }
};

// Récupérer une boutique par son ID
const getShopById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log("ID : "+ id)
    const shop = await ShopModel.findById(id);
    if (shop) {
      res.json(shop);
    } else {
      res.status(404).json({ message: "Boutique non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la boutique" });
  }
};

// Mettre à jour une boutique par son ID
const updateShopById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedShop = await ShopModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedShop) {
      res.json(updatedShop);
    } else {
      res.status(404).json({ message: "Boutique non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la boutique" });
  }
};

// Supprimer une boutique par son ID
const deleteShopById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedShop = await ShopModel.findByIdAndDelete(id);
    if (deletedShop) {
      res.json({ message: "Boutique supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Boutique non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la boutique" });
  }
};

// Récupérer tous les services proposés par une boutique
const getServicesByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    // const services = await ServiceModel.find({ shopId: id });
    const services = await ServiceModel.find({ shopId: id });
    // const services = await ServiceModel.find();
    console.log("shopId shopController : " + id)
    if (services.length > 0) {
      console.log("Service length > 0")
      res.json(services);
    } else {
      res.status(404).json({ message: "Aucun service trouvé pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les services pour cette boutique" });
  }
};

// Récupérer toutes les boutiques associées à un userId
const getShopsByUserId = async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    console.log("id user to find : ")
    console.log(userId)
    const shops = await ShopModel.find({ idUser: userId });

    if (shops.length > 0) {
      res.json(shops);
    } else {
      res.status(404).json({ message: "Aucune boutique trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les boutiques pour cet utilisateur" });
  }
};

module.exports = {
  createShop,
  getAllShops,
  getShopById,
  updateShopById,
  deleteShopById,
  getServicesByShop,
  getShopsByUserId,
};
