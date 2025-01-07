import CommentModel from "../models/comment";
import * as express from "express";

// Ajouter un commentaire
const createComment = async (req: express.Request, res: express.Response) => {
  try {
    const newComment = new CommentModel(req.body);
    await newComment.save();
    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer le commentaire" });
  }
};
const getAllComments = async (req: express.Request, res: express.Response) => {
    try {
      const comments = await CommentModel.find();
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Impossible de récupérer les commentaires" });
    }
  };
  const getCommentById = async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const comment = await CommentModel.findById(id);
      if (comment) {
        res.json(comment);
      } else {
        res.status(404).json({ message: "Commentaire non trouvé" });
      }
    } catch (error) {
      res.status(500).json({ message: "Impossible de récupérer le commentaire" });
    }
  };
  const updateCommentById = async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const updatedComment = await CommentModel.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (updatedComment) {
        res.json(updatedComment);
      } else {
        res.status(404).json({ message: "Commentaire non trouvé" });
      }
    } catch (error) {
      res.status(500).json({ message: "Impossible de mettre à jour le commentaire" });
    }
  };
  const deleteCommentById = async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const deletedComment = await CommentModel.findByIdAndDelete(id);
      if (deletedComment) {
        res.json({ message: "Commentaire supprimé avec succès" });
      } else {
        res.status(404).json({ message: "Commentaire non trouvé" });
      }
    } catch (error) {
      res.status(500).json({ message: "Impossible de supprimer le commentaire" });
    }
  };
  
  module.exports = {
    createComment,
    getAllComments,
    getCommentById,
    updateCommentById,
    deleteCommentById,
  };
  