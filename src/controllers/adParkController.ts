import mongoose from "mongoose";
import adParkModel from "../models/adPark";
import * as express from "express";

// Créer une nouvelle campagne adPark
const createAdPark = async (req: express.Request, res: express.Response) => {
    try {
        const newAdPark = new adParkModel(req.body);
        await newAdPark.save();
        res.status(201).json(newAdPark);
    } catch (error) {
        console.error("Erreur lors de la création d'un adPark :", error);
        res.status(500).json({ message: "Impossible de créer la campagne adPark." });
    }
};

// Récupérer toutes les campagnes adPark
const getAllAdParks = async (req: express.Request, res: express.Response) => {
    try {
        const adParks = await adParkModel.find();
        res.json(adParks);
    } catch (error) {
        console.error("Erreur lors de la récupération des adParks :", error);
        res.status(500).json({ message: "Impossible de récupérer les campagnes adPark." });
    }
};

// Récupérer une campagne adPark par son ID
const getAdParkById = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const adPark = await adParkModel.findById(id);
        if (adPark) {
            res.json(adPark);
        } else {
            res.status(404).json({ message: "Campagne adPark non trouvée." });
        }
    } catch (error) {
        console.error("Erreur lors de la récupération d'un adPark :", error);
        res.status(500).json({ message: "Impossible de récupérer la campagne adPark." });
    }
};

// Récupérer un adPark par advertisementId
const getAdParkByAdvertisementId = async (req: express.Request, res: express.Response) => {
    try {
      const { advertisementId } = req.params;
      console.log("🟡 ID reçu :", advertisementId);
  
      if (!mongoose.Types.ObjectId.isValid(advertisementId)) {
        console.log("🔴 ID invalide");
        return res.status(400).json({ message: "ID de publicité invalide." });
      }
  
      const castedId = new mongoose.Types.ObjectId(advertisementId);
      console.log("🟢 ObjectId casté :", castedId);
  
      const resultList = await adParkModel.find({});
      console.log("🧾 Tous les IDs en base :", resultList.map(p => p.advertisementId.toString()));
  
      const adPark = await adParkModel.findOne({ advertisementId: castedId });
      if (adPark) {
        return res.json(adPark);
      } else {
        return res.status(404).json({ message: "❌ Aucun adPark trouvé avec cet advertisementId." });
      }
    } catch (error) {
      console.error("🔥 Erreur serveur :", error);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  };
  
  

// Mettre à jour une campagne adPark par son ID
const updateAdParkById = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const updatedAdPark = await adParkModel.findByIdAndUpdate(id, req.body, {
            new: true,
        });
        if (updatedAdPark) {
            res.json(updatedAdPark);
        } else {
            res.status(404).json({ message: "Campagne adPark non trouvée." });
        }
    } catch (error) {
        console.error("Erreur lors de la mise à jour d'un adPark :", error);
        res.status(500).json({ message: "Impossible de mettre à jour la campagne adPark." });
    }
};

// Supprimer une campagne adPark par son ID
const deleteAdParkById = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const deletedAdPark = await adParkModel.findByIdAndDelete(id);
        if (deletedAdPark) {
            res.json({ message: "Campagne adPark supprimée avec succès." });
        } else {
            res.status(404).json({ message: "Campagne adPark non trouvée." });
        }
    } catch (error) {
        console.error("Erreur lors de la suppression d'un adPark :", error);
        res.status(500).json({ message: "Impossible de supprimer la campagne adPark." });
    }
};

module.exports = {
    createAdPark,
    getAllAdParks,
    getAdParkById,
    updateAdParkById,
    deleteAdParkById,
    getAdParkByAdvertisementId,
};
