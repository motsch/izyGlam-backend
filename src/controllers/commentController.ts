import CommentModel from "../models/comment";
import * as express from "express";
import { logger } from "../utils/logger";

// -- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

// Ajouter un commentaire
const createComment = async (req: express.Request, res: express.Response) => {
  try {
    const newComment = new CommentModel(req.body);
    await newComment.save();

    logger.info({
      msg: "createComment success",
      route: "POST /api/comments",
      method: req.method,
      url: req.originalUrl,
      commentId: newComment?._id?.toString(),
      body: sanitize(req.body),
      userId: (req as any).user?._id,
    });

    res.status(201).json(newComment);
  } catch (error: any) {
    logger.error({
      msg: "createComment failed",
      route: "POST /api/comments",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer le commentaire" });
  }
};

// Récupérer tous les commentaires
const getAllComments = async (req: express.Request, res: express.Response) => {
  try {
    const comments = await CommentModel.find();

    logger.info({
      msg: "getAllComments success",
      route: "GET /api/comments",
      method: req.method,
      url: req.originalUrl,
      count: comments.length,
    });

    res.json(comments);
  } catch (error: any) {
    logger.error({
      msg: "getAllComments failed",
      route: "GET /api/comments",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les commentaires" });
  }
};

// Récupérer un commentaire par ID
const getCommentById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const comment = await CommentModel.findById(id);

    if (comment) {
      logger.info({
        msg: "getCommentById success",
        route: "GET /api/comments/:id",
        method: req.method,
        url: req.originalUrl,
        commentId: id,
      });
      res.json(comment);
    } else {
      logger.warn({
        msg: "getCommentById not found",
        route: "GET /api/comments/:id",
        method: req.method,
        url: req.originalUrl,
        commentId: id,
      });
      res.status(404).json({ message: "Commentaire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getCommentById failed",
      route: "GET /api/comments/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer le commentaire" });
  }
};

// Mettre à jour un commentaire
const updateCommentById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedComment = await CommentModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedComment) {
      logger.info({
        msg: "updateCommentById success",
        route: "PUT /api/comments/:id",
        method: req.method,
        url: req.originalUrl,
        commentId: id,
        body: sanitize(req.body),
      });
      res.json(updatedComment);
    } else {
      logger.warn({
        msg: "updateCommentById not found",
        route: "PUT /api/comments/:id",
        method: req.method,
        url: req.originalUrl,
        commentId: id,
      });
      res.status(404).json({ message: "Commentaire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateCommentById failed",
      route: "PUT /api/comments/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour le commentaire" });
  }
};

// Supprimer un commentaire
const deleteCommentById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedComment = await CommentModel.findByIdAndDelete(id);

    if (deletedComment) {
      logger.info({
        msg: "deleteCommentById success",
        route: "DELETE /api/comments/:id",
        method: req.method,
        url: req.originalUrl,
        commentId: id,
      });
      res.json({ message: "Commentaire supprimé avec succès" });
    } else {
      logger.warn({
        msg: "deleteCommentById not found",
        route: "DELETE /api/comments/:id",
        method: req.method,
        url: req.originalUrl,
        commentId: id,
      });
      res.status(404).json({ message: "Commentaire non trouvé" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteCommentById failed",
      route: "DELETE /api/comments/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
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
