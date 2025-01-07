import ProfileModel from "../models/profile";
import * as express from "express";

// Créer un nouveau profil
// Utilisation de req.user.id après l'extension du type
const createProfile = async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const newProfile = new ProfileModel({ ...req.body, userId: userId });
    await newProfile.save();
    res.status(201).json(newProfile);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer le profil" });
  }
};

// Récupérer tous les profils
const getAllProfiles = async (req: express.Request, res: express.Response) => {
  try {
    const profiles = await ProfileModel.find();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les profils" });
  }
};

// Récupérer un profil par ID
const getProfileById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const profile = await ProfileModel.findById(id);
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).json({ message: "Profil non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le profil" });
  }
};

// Récupérer les profils par userId
const getProfilesByUserId = async (req: express.Request, res: express.Response) => {
    try {
      const { userId } = req.params;
      const profiles = await ProfileModel.find({ userId });
      if (profiles.length > 0) {
        res.json(profiles);
      } else {
        res.status(404).json({ message: "Aucun profil trouvé pour cet utilisateur" });
      }
    } catch (error) {
      res.status(500).json({ message: "Impossible de récupérer les profils par utilisateur" });
    }
  };

// Mettre à jour un profil par ID
const updateProfileById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const updatedProfile = await ProfileModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedProfile) {
      res.json(updatedProfile);
    } else {
      res.status(404).json({ message: "Profil non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour le profil" });
  }
};

// Supprimer un profil par ID
const deleteProfileById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const deletedProfile = await ProfileModel.findByIdAndDelete(id);
    if (deletedProfile) {
      res.json({ message: "Profil supprimé avec succès" });
    } else {
      res.status(404).json({ message: "Profil non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer le profil" });
  }
};

export {
  createProfile,
  getAllProfiles,
  getProfileById,
  updateProfileById,
  deleteProfileById,
  getProfilesByUserId,
};
