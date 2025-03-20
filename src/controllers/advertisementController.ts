import AdvertisementModel from "../models/advertisement";
import * as express from "express";

// Créer une nouvelle couleur
const addAdvertisement = async (req: express.Request, res: express.Response) => {
    try {
        const newAd = new AdvertisementModel(req.body);
        await newAd.save();
        res.status(201).json(newAd);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de l’ajout de la pub', error });
    }
};

// Récupérer toutes les couleurs
const getAdvertisements = async (req: express.Request, res: express.Response) => {

    try {
        const now = new Date();
        const ads = await AdvertisementModel.find({
            date_expiration: { $gte: new Date(now) } // S'assure que la comparaison est faite avec un objet Date valide
        }).sort({ budget: -1 });

        console.log(ads)
        console.log("ADS GET ALL")
        res.json(ads);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des pubs', error });
    }
};

// Récupérer une couleur par son ID
const getAdvertisementById = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const color = await AdvertisementModel.findById(id);
        if (color) {
            res.json(color);
        } else {
            res.status(404).json({ message: "Couleur non trouvée" });
        }
    } catch (error) {
        res.status(500).json({ message: "Impossible de récupérer la couleur" });
    }
};

// Mettre à jour une couleur par son ID
const updateAdvertisement = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const updatedAd = await AdvertisementModel.findByIdAndUpdate(id, req.body, { new: true });
        res.json(updatedAd);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la mise à jour', error });
    }
};

// Incrémenter le nombre d'impressions
const incrementImpression = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        console.log(`📢 Requête reçue pour incrémentation d'impression de la pub ${id}`);

        const ad = await AdvertisementModel.findById(id);
        if (!ad) {
            console.log(`❌ Publicité non trouvée pour ID : ${id}`);
            return res.status(404).json({ message: "Publicité non trouvée" });
        }

        ad.impressions += 1;
        ad.taux_conversion = ad.impressions > 0 ? (ad.clics / ad.impressions) * 100 : 0;

        await ad.save();
        console.log(`✅ Impression mise à jour pour pub ${id}, total : ${ad.impressions}`);
        res.json({ message: "Impression mise à jour", ad });
    } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour des impressions :`, error);
        res.status(500).json({ message: "Erreur lors de la mise à jour des impressions", error });
    }
};


// Incrémenter le nombre de clicks
const incrementClick  = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const ad = await AdvertisementModel.findById(id);

        if (!ad) {
            return res.status(404).json({ message: "Publicité non trouvée" });
        }

        ad.clics += 1;
        ad.taux_conversion = ad.impressions > 0 ? (ad.clics / ad.impressions) * 100 : 0;

        await ad.save();
        res.json({ message: "Clic mis à jour", ad });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la mise à jour des clics", error });
    }
};
// Mettre à jour le temps d'affichage d'une publicité
const updateAdDisplayTime = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const { duree_affichage } = req.body; // Durée en secondes

        if (!duree_affichage || duree_affichage <= 0) {
            return res.status(400).json({ message: "Durée d'affichage invalide" });
        }

        const ad = await AdvertisementModel.findById(id);
        if (!ad) {
            return res.status(404).json({ message: "Publicité non trouvée" });
        }

        // ✅ Mise à jour des statistiques d'affichage
        ad.temps_affichage_total += duree_affichage;
        ad.nombre_affichages_valides += 1;

        await ad.save();
        res.json({ message: "Temps d'affichage mis à jour", ad });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la mise à jour du temps d'affichage", error });
    }
};

const incrementValidImpression = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const ad = await AdvertisementModel.findById(id);

        if (!ad) {
            return res.status(404).json({ message: "Publicité non trouvée" });
        }

        ad.nombre_affichages_valides += 1;
        await ad.save();
        res.json({ message: "Affichage valide mis à jour", ad });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la mise à jour des affichages valides", error });
    }
};


module.exports = {
    addAdvertisement,
    getAdvertisements,
    getAdvertisementById,
    updateAdvertisement,
    incrementImpression,
    incrementClick,
    updateAdDisplayTime,
};
