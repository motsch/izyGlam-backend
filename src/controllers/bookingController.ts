import BookingModel from "../models/booking";
import * as express from "express";
import moment from "moment-timezone";
import ServiceModel from "../models/service";
import ShopModel, { iShop } from "../models/shop";
import UserModel from "../models/user";
import { sendSepaTransferToPro } from "../services/paymentService";
import { notifyBookingCodeConfirmed, notifyBookingStatusChanged, notifyProNewBooking } from "../services/notify";
import ConversationModel from "../models/conversation";
import mongoose from "mongoose";
import { logger } from "../utils/logger";
import bookingModel from "../models/booking";
import { attributeTargetToFeed } from "../services/feedAttribution.service";

// -------- utils --------
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban", "generatedCode"];
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

// ====== KPI CA global ======
const getAllCACount = async (req: express.Request, res: express.Response) => {
  try {
    const bookings = await BookingModel.find({ status: "completed" }, "price");
    const CA = bookings.reduce((total, booking: any) => total + parseFloat(booking.price), 0);

    logger.info({
      msg: "getAllCACount success",
      route: "GET /api/ca-count-all",
      method: req.method,
      url: req.originalUrl,
      count: bookings.length,
      CA,
    });

    res.status(200).json(CA);
  } catch (error: any) {
    logger.error({
      msg: "getAllCACount failed",
      route: "GET /api/ca-count-all",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer le chiffre d'affaires" });
  }
};

function generateValidationCode(): string {
  // Génère un nombre entre 100000 et 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ====== CRUD Booking ======
const createBooking = async (req: express.Request, res: express.Response) => {
  try {
    const { lang = "fr", ...data } = req.body;

    // 🔐 Génération serveur du code de validation
    const validationCode = generateValidationCode();

    const newBooking = new BookingModel({
      ...data,
      generatedCode: validationCode,
      proCodeConfirmed: false,
    });
    await newBooking.save();

    logger.info({
      msg: "createBooking success",
      route: "POST /api/booking",
      method: req.method,
      url: req.originalUrl,
      bookingId: newBooking?._id?.toString(),
      body: sanitize(data),
      userId: (req as any).user?._id,
    });

    // 🔔 Notifier le prestataire (fire & forget acceptable ici)
    notifyProNewBooking(newBooking, lang).catch((e) =>
      logger.error({ msg: "notifyProNewBooking failed", bookingId: newBooking._id?.toString(), errorMessage: e?.message, stack: e?.stack })
    );

    res.status(201).json(newBooking);
  } catch (error: any) {
    logger.error({
      msg: "createBooking failed",
      route: "POST /api/booking",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de créer la réservation" });
  }
};

const getAllBookings = async (req: express.Request, res: express.Response) => {
  try {
    const bookings = await BookingModel.find();
    logger.info({
      msg: "getAllBookings success",
      route: "GET /api/booking",
      method: req.method,
      url: req.originalUrl,
      count: bookings.length,
    });
    res.json(bookings);
  } catch (error: any) {
    logger.error({
      msg: "getAllBookings failed",
      route: "GET /api/booking",
      method: req.method,
      url: req.originalUrl,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les réservations" });
  }
};

const getBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const booking = await BookingModel.findById(id);

    if (booking) {
      logger.info({
        msg: "getBookingById success",
        route: "GET /api/booking/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
      });
      res.json(booking);
    } else {
      logger.warn({
        msg: "getBookingById not found",
        route: "GET /api/booking/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
      });
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getBookingById failed",
      route: "GET /api/booking/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer la réservation" });
  }
};

const updateBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedBooking = await BookingModel.findByIdAndUpdate(id, req.body, { new: true });

    if (updatedBooking) {
      logger.info({
        msg: "updateBookingById success",
        route: "PUT /api/booking/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
        body: sanitize(req.body),
      });
      res.json(updatedBooking);
    } else {
      logger.warn({
        msg: "updateBookingById not found",
        route: "PUT /api/booking/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
      });
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "updateBookingById failed",
      route: "PUT /api/booking/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de mettre à jour la réservation" });
  }
};

const deleteBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedBooking = await BookingModel.findByIdAndDelete(id);

    if (deletedBooking) {
      logger.info({
        msg: "deleteBookingById success",
        route: "DELETE /api/booking/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
      });
      res.json({ message: "Réservation supprimée avec succès" });
    } else {
      logger.warn({
        msg: "deleteBookingById not found",
        route: "DELETE /api/booking/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
      });
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error: any) {
    logger.error({
      msg: "deleteBookingById failed",
      route: "DELETE /api/booking/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de supprimer la réservation" });
  }
};

// ====== filtres ======
const getBookingsByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { shopId } = req.params;
    const bookings = await BookingModel.find({ shop: shopId });

    if (bookings.length > 0) {
      logger.info({
        msg: "getBookingsByShop success",
        route: "GET /api/booking-by-shop/:shopId",
        method: req.method,
        url: req.originalUrl,
        shopId,
        count: bookings.length,
      });
      res.json(bookings);
    } else {
      logger.warn({
        msg: "getBookingsByShop not found",
        route: "GET /api/booking-by-shop/:shopId",
        method: req.method,
        url: req.originalUrl,
        shopId,
      });
      res.status(404).json({ message: "Aucune réservation trouvée pour cette boutique" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getBookingsByShop failed",
      route: "GET /api/booking-by-shop/:shopId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cette boutique" });
  }
};

const getBookingsByUserPro = async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const bookings = await BookingModel.find({ userProId: userId }).select("-generatedCode");

    if (bookings.length > 0) {
      logger.info({
        msg: "getBookingsByUserPro success",
        route: "GET /api/booking-by-userPro/:userId",
        method: req.method,
        url: req.originalUrl,
        userId,
        count: bookings.length,
      });
      res.json(bookings);
    } else {
      logger.warn({
        msg: "getBookingsByUserPro not found",
        route: "GET /api/booking-by-userPro/:userId",
        method: req.method,
        url: req.originalUrl,
        userId,
      });
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getBookingsByUserPro failed",
      route: "GET /api/booking-by-userPro/:userId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

const getBookingsByClient = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    const bookings = await BookingModel.find({ clientId: id, status: { $ne: "deleted" } });

    if (bookings.length > 0) {
      logger.info({
        msg: "getBookingsByClient success",
        route: "GET /api/booking-by-client/:id",
        method: req.method,
        url: req.originalUrl,
        clientId: id,
        count: bookings.length,
      });
      res.json(bookings);
    } else {
      logger.warn({
        msg: "getBookingsByClient not found",
        route: "GET /api/booking-by-client/:id",
        method: req.method,
        url: req.originalUrl,
        clientId: id,
      });
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error: any) {
    logger.error({
      msg: "getBookingsByClient failed",
      route: "GET /api/booking-by-client/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

// ====== statut & conversation ======
const updateBookingStatusById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const status = req.body.status;
    const langue = req.body.langue;

    logger.info({
      msg: "updateBookingStatusById start",
      route: "PATCH /api/booking-update-status/:id",
      method: req.method,
      url: req.originalUrl,
      bookingId: id,
      status,
      langue,
    });

    const updatedBooking = await BookingModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedBooking) {
      logger.warn({
        msg: "updateBookingStatusById not found",
        route: "PATCH /api/booking-update-status/:id",
        method: req.method,
        url: req.originalUrl,
        bookingId: id,
      });
      return res.status(404).json({ message: "Réservation non trouvée" });
    }

    logger.info({
      msg: "updateBookingStatusById success",
      route: "PATCH /api/booking-update-status/:id",
      method: req.method,
      url: req.originalUrl,
      bookingId: updatedBooking._id?.toString(),
      newStatus: updatedBooking.status,
    });

    // 🔔 fire & forget
    notifyBookingStatusChanged(updatedBooking, langue).catch((e) =>
      logger.error({
        msg: "notifyBookingStatusChanged failed",
        bookingId: updatedBooking._id?.toString(),
        errorMessage: e?.message,
        stack: e?.stack,
      })
    );

    // Statuts qui doivent clôturer la conversation liée au booking
    const CLOSING_STATUSES = new Set<
      "deleted" | "cancelled" | "finished" | "no-show-client" | "no-show-pro"
    >([
      "deleted",
      "cancelled",
      "finished",
      "no-show-client",
      "no-show-pro",
    ]);

    if (status === "accepted") {
      // ✅ Conversation 1:1 liée au booking
      const bookingObjectId = new mongoose.Types.ObjectId(updatedBooking._id);

      const existingConversation = await ConversationModel.findOne({
        bookingId: bookingObjectId,
      });

      if (existingConversation) {
        // Si elle existe déjà mais est "closed", on peut la ré-ouvrir
        if (existingConversation.status !== "open") {
          existingConversation.status = "open";
          existingConversation.closedAt = undefined;
          await existingConversation.save();
        }

        logger.info({
          msg: "updateBookingStatusById booking conversation exists",
          bookingId: updatedBooking._id?.toString(),
          conversationId: existingConversation._id?.toString(),
          conversationStatus: existingConversation.status,
        });
      } else {
        const conversation = new ConversationModel({
          bookingId: bookingObjectId,
          participants: [
            new mongoose.Types.ObjectId(updatedBooking.clientId),
            new mongoose.Types.ObjectId(updatedBooking.userProId),
          ],
          name: `${updatedBooking.title} • ${updatedBooking.date}`,
          status: "open",
          bookingRef: {
            title: updatedBooking.title,
            establishmentName: updatedBooking.establishmentName,
            productName: updatedBooking.productName,
            date: updatedBooking.date,
            start: updatedBooking.start,
            end: updatedBooking.end,
            price: updatedBooking.price,
            status: updatedBooking.status,
            shopId: updatedBooking.shopId,
            clientId: updatedBooking.clientId,
            userProId: updatedBooking.userProId,
          },
        });

        // ✅ Anti-doublon concurrent (index unique bookingId)
        try {
          await conversation.save();
        } catch (err: any) {
          // duplication concurrente → on ignore
          if (err?.code !== 11000) throw err;
        }

        logger.info({
          msg: "updateBookingStatusById booking conversation created",
          bookingId: updatedBooking._id?.toString(),
          conversationId: conversation._id?.toString(),
        });
      }
    }

    if (CLOSING_STATUSES.has(status)) {
      const bookingObjectId = new mongoose.Types.ObjectId(updatedBooking._id);
      const conversation = await ConversationModel.findOne({ bookingId: bookingObjectId });

      if (conversation) {
        if (conversation.status !== "closed") {
          conversation.status = "closed";
          conversation.closedAt = new Date();
          await conversation.save();
        }

        logger.info({
          msg: "updateBookingStatusById booking conversation closed",
          bookingId: updatedBooking._id?.toString(),
          conversationId: conversation._id?.toString(),
          newConversationStatus: conversation.status,
        });
      } else {
        logger.info({
          msg: "updateBookingStatusById no booking conversation to close",
          bookingId: updatedBooking._id?.toString(),
          status,
        });
      }
    }

    // ✅ Attribution feed -> conversion booking (quand c’est vraiment “réalisé”)
    if (status === "finished") {
      try {
        // buyer = client
        const userId = String(updatedBooking.clientId);
        const proId = String(updatedBooking.userProId);

        // montant: si tu veux CA réel, prends price
        const amount = (() => {
          const n = Number(String(updatedBooking.price ?? "").replace(",", "."));
          return Number.isFinite(n) ? n : undefined;
        })();

        await attributeTargetToFeed({
          userId,
          proId,
          targetType: "BOOKING",
          targetId: String(updatedBooking._id),
          amount,
          currency: "eur",
        });

        logger.info({
          msg: "feed.attribution.booking.done",
          bookingId: String(updatedBooking._id),
          userId,
          proId,
          amount,
        });
      } catch (e: any) {
        logger.error({
          msg: "feed.attribution.booking.failed",
          bookingId: String(updatedBooking._id),
          errorMessage: e?.message,
          stack: e?.stack,
        });
      }
    }


    return res.json({ message: "Statut mis à jour", booking: updatedBooking });
  } catch (error: any) {
    logger.error({
      msg: "updateBookingStatusById failed",
      route: "PATCH /api/booking-update-status/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({ message: "Impossible de mettre à jour la réservation" });
  }
};


// ====== confirmation code & passage en finished ======
export const confirmBookingCode = async (req: express.Request, res: express.Response) => {
  try {
    const { bookingId, code, langue } = req.body;

    logger.info({
      msg: "confirmBookingCode start",
      route: "POST /api/bookings-confirm-code",
      method: req.method,
      url: req.originalUrl,
      bookingId,
      hasCode: !!code,
      langue,
      userId: (req as any).user?._id,
    });

    if (!bookingId || !code) {
      logger.warn({
        msg: "confirmBookingCode bad request",
        route: "POST /api/bookings-confirm-code",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "bookingId et code sont obligatoires" });
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      logger.warn({
        msg: "confirmBookingCode not found",
        route: "POST /api/bookings-confirm-code",
        method: req.method,
        url: req.originalUrl,
        bookingId,
      });
      return res.status(404).json({ message: "Booking non trouvé" });
    }

    // ✅ Si déjà confirmé / déjà terminé, on renvoie confirmed:true (idempotent)
    if (booking.proCodeConfirmed === true || booking.status === "finished") {
      logger.info({
        msg: "confirmBookingCode already confirmed",
        route: "POST /api/bookings-confirm-code",
        method: req.method,
        url: req.originalUrl,
        bookingId,
        status: booking.status,
      });



      // ✅ OK : on passe en finished
      booking.proCodeConfirmed = true;
      booking.status = "finished";
      const updatedBooking = await BookingModel.findById(bookingId);
      if (updatedBooking) {
        // (optionnel) si tu veux tracer la date de clôture
        updatedBooking.closed = true;
        updatedBooking.closedAt = new Date();
        await updatedBooking.save();
      }
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      console.log("BOOKING FINISHED !");
      return res.json({ confirmed: true, booking: updatedBooking });
      // return res.json({ confirmed: true, booking });
    }

    // Normalisation du code reçu (au cas où espaces / tirets)
    const normalizedCode = String(code).replace(/\D/g, "").slice(0, 6);

    // Si ton generatedCode est stocké en string
    const expectedCode = String(booking.generatedCode ?? "");

    // ❌ Mauvais code
    if (!expectedCode || expectedCode !== normalizedCode) {
      logger.info({
        msg: "confirmBookingCode mismatch",
        route: "POST /api/bookings-confirm-code",
        method: req.method,
        url: req.originalUrl,
        bookingId,
      });
      return res.json({ confirmed: false });
    }

    // ✅ OK : on passe en finished
    booking.proCodeConfirmed = true;
    booking.status = "finished";

    // (optionnel) si tu veux tracer la date de clôture
    booking.closed = true;
    booking.closedAt = new Date();

    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");
    console.log("BOOKING FINISHED !");

    logger.info({
      msg: "confirmBookingCode booking set to finished",
      route: "POST /api/bookings-confirm-code",
      method: req.method,
      url: req.originalUrl,
      bookingId: booking._id?.toString(),
      newStatus: booking.status,
    });

    // ===========================
    // ✅ Conversation : on ferme (même logique que updateBookingStatusById)
    // ===========================
    try {
      const bookingObjectId = new mongoose.Types.ObjectId(booking._id);
      const conversation = await ConversationModel.findOne({ bookingId: bookingObjectId });

      if (conversation) {
        if (conversation.status !== "closed") {
          conversation.status = "closed";
          conversation.closedAt = new Date();
          await conversation.save();
        }

        logger.info({
          msg: "confirmBookingCode booking conversation closed",
          bookingId: booking._id?.toString(),
          conversationId: conversation._id?.toString(),
          newConversationStatus: conversation.status,
        });
      } else {
        logger.info({
          msg: "confirmBookingCode no booking conversation to close",
          bookingId: booking._id?.toString(),
        });
      }
    } catch (e: any) {
      logger.error({
        msg: "confirmBookingCode conversation close failed",
        bookingId: booking._id?.toString(),
        errorMessage: e?.message,
        stack: e?.stack,
      });
      // on ne bloque pas la réponse si la conversation n’a pas pu être fermée
    }

    // ===========================
    // 🔔 Notifications (fire & forget)
    // ===========================
    notifyBookingCodeConfirmed(booking).catch((e: any) =>
      logger.error({
        msg: "notifyBookingCodeConfirmed failed",
        bookingId: booking._id?.toString(),
        errorMessage: e?.message,
        stack: e?.stack,
      })
    );

    // ===========================
    // ✅ Attribution feed (si tu veux le même comportement que updateBookingStatusById)
    // ===========================
    // try {
    //   const userId = String(booking.clientId);
    //   const proId = String(booking.userProId);
    //   const amount = (() => {
    //     const n = Number(String(booking.price ?? "").replace(",", "."));
    //     return Number.isFinite(n) ? n : undefined;
    //   })();
    //
    //   await attributeTargetToFeed({
    //     userId,
    //     proId,
    //     targetType: "BOOKING",
    //     targetId: String(booking._id),
    //     amount,
    //     currency: "eur",
    //   });
    // } catch (e: any) {
    //   logger.error({
    //     msg: "feed.attribution.booking.failed",
    //     bookingId: String(booking._id),
    //     errorMessage: e?.message,
    //     stack: e?.stack,
    //   });
    // }

    return res.json({ confirmed: true, booking });
  } catch (error: any) {
    logger.error({
      msg: "confirmBookingCode failed",
      route: "POST /api/bookings-confirm-code",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
};

// ====== Dashboard KPI par salon ======
const getDashboardStatsByShop = async (req: express.Request, res: express.Response) => {
  const { shopId } = req.params;

  try {
    const allBookings: any[] = await BookingModel.find({ shopId, status: "finished" });
    const now = moment();
    const startOfCurrentMonth = now.clone().startOf("month");
    const startOfLastMonth = now.clone().subtract(1, "month").startOf("month");
    const endOfLastMonth = startOfCurrentMonth.clone().subtract(1, "day").endOf("day");

    const totalRevenue = allBookings.reduce((sum, b) => sum + parseFloat(b.price || "0"), 0);
    const totalCommission = allBookings.reduce((sum, b) => sum + parseFloat(b.commission || "0"), 0);

    const currentMonthRevenue = allBookings
      .filter((b) => moment(b.orderDate).isSameOrAfter(startOfCurrentMonth))
      .reduce((sum, b) => sum + parseFloat(b.price || "0"), 0);

    const lastMonthRevenue = allBookings
      .filter((b) => moment(b.orderDate).isBetween(startOfLastMonth, endOfLastMonth))
      .reduce((sum, b) => sum + parseFloat(b.price || "0"), 0);

    const evolution =
      lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null;

    const confirmedBookings = allBookings.filter((b) => b.proCodeConfirmed);
    const totalEarnings = confirmedBookings.reduce((sum, b) => sum + parseFloat(b.shopEarnings || "0"), 0);

    const totalBookings = allBookings.length;

    const cancelledBookings = await BookingModel.countDocuments({
      shopId,
      status: { $in: ["cancelled", "refused", "no-show-client", "no-show-pro"] },
    });

    const avgPrice = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const reviewsCount = allBookings.filter((b) => b.reviewAdded).length;
    const reviewRatio = totalBookings > 0 ? (reviewsCount / totalBookings) * 100 : 0;

    const earningsByProduct: Record<string, number> = {};
    allBookings.forEach((b) => {
      const name = b.productName || "Inconnu";
      earningsByProduct[name] = (earningsByProduct[name] || 0) + parseFloat(b.price || "0");
    });
    const topProducts = Object.entries(earningsByProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([product, total]) => ({ product, total: (total as number).toFixed(2) }));

    const totalDurations = allBookings.reduce((sum, b) => {
      const start = moment(b.start);
      const end = moment(b.end);
      return sum + end.diff(start, "minutes");
    }, 0);
    const avgDuration = totalBookings > 0 ? totalDurations / totalBookings : 0;

    logger.info({
      msg: "getDashboardStatsByShop success",
      route: "GET /api/booking-dashboard/:shopId",
      method: req.method,
      url: req.originalUrl,
      shopId,
      totalBookings,
    });

    return res.status(200).json({
      totalRevenue: totalRevenue.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      evolution: evolution !== null ? evolution.toFixed(2) : null,
      totalEarnings: totalEarnings.toFixed(2),
      totalBookings,
      cancelledBookings,
      avgPrice: avgPrice.toFixed(2),
      reviewRatio: reviewRatio.toFixed(2),
      topProducts,
      avgDuration: Math.round(avgDuration),
    });
  } catch (error: any) {
    logger.error({
      msg: "getDashboardStatsByShop failed",
      route: "GET /api/booking-dashboard/:shopId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Erreur lors du calcul des stats" });
  }
};

// ----- CONFIG METIER -----
const GRID_MINUTES = 15;
const MAX_SLOTS_PER_DAY = 10;
const WINDOW_WEEKS = 6;
const BLOCKING_STATUSES = ["pending", "accepted"] as const;

// ----- UTILS -----
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const roundUpToGrid = (m: moment.Moment, gridMin: number) => {
  const minutes = m.minutes();
  const remainder = minutes % gridMin;
  if (remainder === 0) return m.clone().seconds(0).milliseconds(0);
  return m.clone().add(gridMin - remainder, "minutes").seconds(0).milliseconds(0);
};

const dayKeyFromMoment = (d: moment.Moment) => {
  const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[d.day()] as keyof iShop["hours"];
};

// overlap avec buffer bilatéral
const overlapsWithBuffer = (
  slotStart: moment.Moment,
  slotEnd: moment.Moment,
  bookingStart: moment.Moment,
  bookingEnd: moment.Moment,
  bufferMin: number
) => {
  const bookingStartMinus = bookingStart.clone().subtract(bufferMin, "minutes");
  const bookingEndPlus = bookingEnd.clone().add(bufferMin, "minutes");
  return slotStart.isBefore(bookingEndPlus) && slotEnd.isAfter(bookingStartMinus);
};

// étalement “humain”
const pickSpread = <T>(items: T[], count: number): T[] => {
  if (items.length <= count) return items;
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (items.length - 1)) / (count - 1));
    picked.push(items[idx]);
  }
  return picked;
};

// ----- CONTROLLER -----
export const getAvailableSlots = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId, shopId } = req.params;

    // 1) Charge service/shop/pro
    const service: any = await ServiceModel.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service non trouvé" });
    const durationMin = Number(service.duration);

    const shop: any = await ShopModel.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Boutique non trouvée" });

    const professional: any = await UserModel.findById(shop.idUser);
    if (!professional) return res.status(404).json({ message: "Professionnel non trouvé" });

    // 2) Timezone
    const tz = shop.timeZone || "Europe/Paris";
    const now = moment.tz(tz);

    // 3) Paramètres métier
    const ondaybooking: boolean = !!shop.ondaybooking;
    const minimumDelayMin = Number(shop.minimumDelay || "30");
    const startDate = now.clone().startOf("day");
    const endDate = now.clone().add(WINDOW_WEEKS, "weeks").endOf("day");

    // 4) Récupère bookings bloquants
    const bookings: any[] = await BookingModel.find({
      userProId: professional._id.toString(),
      status: { $in: BLOCKING_STATUSES },
      $or: [{ start: { $lt: endDate.toDate() }, end: { $gt: startDate.toDate() } }],
    }).lean();

    const allAvailableSlots: Array<{ date: string; start: string; end: string }> = [];

    // 5) Boucle jour
    for (let d = startDate.clone(); d.isSameOrBefore(endDate, "day"); d.add(1, "day")) {
      const dayKey = dayKeyFromMoment(d);
      const daySchedule = shop.hours?.[dayKey];

      if (!daySchedule || daySchedule.closed) continue;

      // indisponibilités pro (élargies par minimumDelay)
      const hasUnavailability = (professional.unavailability || []).some((u: any) => {
        const uStart = moment(u.start).tz(tz).subtract(minimumDelayMin, "minutes");
        const uEnd = moment(u.end).tz(tz).add(minimumDelayMin, "minutes");
        return d.clone().endOf("day").isAfter(uStart) && d.clone().startOf("day").isBefore(uEnd);
      });
      if (hasUnavailability) continue;

      const periods: Array<{ pStart: moment.Moment; pEnd: moment.Moment }> = [];
      const addPeriod = (startStr?: string, endStr?: string) => {
        if (!startStr || !endStr) return;
        const pStart = d.clone().hour(Number(startStr.split(":")[0])).minute(Number(startStr.split(":")[1])).second(0).millisecond(0);
        const pEnd = d.clone().hour(Number(endStr.split(":")[0])).minute(Number(endStr.split(":")[1])).second(0).millisecond(0);
        if (pEnd.isAfter(pStart)) periods.push({ pStart, pEnd });
      };
      addPeriod(daySchedule.morning?.start, daySchedule.morning?.end);
      addPeriod(daySchedule.afternoon?.start, daySchedule.afternoon?.end);

      const dayCandidates: Array<{ date: string; start: string; end: string; _msStart: number }> = [];

      for (const { pStart, pEnd } of periods) {
        let cur = pStart.clone().add(minimumDelayMin, "minutes");

        if (d.isSame(now, "day")) {
          if (!ondaybooking) continue;
          const earliestToday = roundUpToGrid(now.clone().add(minimumDelayMin, "minutes"), GRID_MINUTES);
          if (earliestToday.isAfter(cur)) cur = earliestToday.clone();
        }

        cur = roundUpToGrid(cur, GRID_MINUTES);

        while (true) {
          const slotStart = cur.clone();
          const slotEnd = cur.clone().add(durationMin, "minutes");

          if (slotEnd.isAfter(pEnd)) break;

          const collidesBooking = bookings.some((b: any) => {
            const bStart = moment(b.start).tz(tz);
            const bEnd = moment(b.end).tz(tz);
            return overlapsWithBuffer(slotStart, slotEnd, bStart, bEnd, minimumDelayMin);
          });

          if (!collidesBooking) {
            dayCandidates.push({
              date: d.format("YYYY-MM-DD"),
              start: slotStart.format("HH:mm"),
              end: slotEnd.format("HH:mm"),
              _msStart: slotStart.valueOf(),
            });
          }
          cur.add(GRID_MINUTES, "minutes");
        }
      }

      dayCandidates.sort((a, b) => a._msStart - b._msStart);
      const picked = pickSpread(dayCandidates, MAX_SLOTS_PER_DAY);
      picked.forEach(({ date, start, end }) => allAvailableSlots.push({ date, start, end }));
    }

    allAvailableSlots.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));

    logger.info({
      msg: "getAvailableSlots success",
      route: "GET /api/available-slots/:shopId/services/:serviceId",
      method: req.method,
      url: req.originalUrl,
      shopId,
      serviceId,
      total: allAvailableSlots.length,
    });

    return res.json(allAvailableSlots);
  } catch (error: any) {
    logger.error({
      msg: "getAvailableSlots failed",
      route: "GET /api/available-slots/:shopId/services/:serviceId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Erreur lors du calcul des créneaux disponibles" });
  }
};

// --- Dates helpers ---
// Semaine ISO-ish (lundi -> dimanche)
function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = lundi
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}
function endOfWeekSunday(d: Date) {
  const start = startOfWeekMonday(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfMonth(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfMonth(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  date.setHours(23, 59, 59, 999);
  return date;
}

// Convert string money -> double dans l'aggregation (gère virgule)
function toDoubleExpr(fieldPath: string) {
  return {
    $toDouble: {
      $replaceAll: {
        input: { $ifNull: [fieldPath, "0"] },
        find: ",",
        replacement: ".",
      },
    },
  };
}

/**
 * ✅ Suivi comptable d'un shop
 * - mode=week|month
 * - date=YYYY-MM-DD (un jour dans la période)
 *
 * Retour :
 * - période (from/to)
 * - totaux (CA, commission, serviceFee, shopEarnings, tva)
 * - nb bookings
 * - breakdown (par jour si week, par semaine si month)
 * - split "open" (closed=false) vs "closed" (closed=true)
 */
const getShopAccounting = async (req: express.Request, res: express.Response) => {
  try {
    const { shopId } = req.params;

    const mode = (req.query.mode as string)?.toLowerCase() || "week";
    const dateStr = (req.query.date as string) || "";

    // Sécurité : date obligatoire pour un comportement clair
    const baseDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(baseDate.getTime())) {
      return res.status(400).json({ message: "Paramètre date invalide. Format attendu: YYYY-MM-DD" });
    }

    let from: Date;
    let to: Date;

    if (mode === "month") {
      from = startOfMonth(baseDate);
      to = endOfMonth(baseDate);
    } else {
      // default week
      from = startOfWeekMonday(baseDate);
      to = endOfWeekSunday(baseDate);
    }

    // Statuts considérés comme "comptables" (tu peux ajuster)
    // - accepted / finished : généralement payés
    // - on exclut refused/deleted/cancelled + no-shows selon ton business
    const allowedStatuses = ["finished"];

    // NOTE: on exclut les bookings déjà remboursés (refundId/refundedAt)
    const match: any = {
      shopId,
      orderDate: { $gte: from, $lte: to },
      status: { $in: allowedStatuses },
      $or: [{ refundId: { $exists: false } }, { refundId: null }, { refundId: "" }],
    };

    // Breakdown:
    // - week => group by day
    // - month => group by week number (ISO-ish via $isoWeek)
    const breakdownGroupId =
      mode === "month"
        ? { isoWeek: { $isoWeek: "$orderDate" }, year: { $isoWeekYear: "$orderDate" } }
        : {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
        };

    const pipeline: any[] = [
      { $match: match },
      {
        $addFields: {
          _price: toDoubleExpr("$price"),
          _serviceFee: toDoubleExpr("$serviceFee"),
          _commission: toDoubleExpr("$commission"),
          _shopEarnings: toDoubleExpr("$shopEarnings"),
          _tva: toDoubleExpr("$tva"),
          _closed: { $ifNull: ["$closed", false] },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                bookingsCount: { $sum: 1 },
                totalPrice: { $sum: "$_price" },
                totalServiceFee: { $sum: "$_serviceFee" },
                totalCommission: { $sum: "$_commission" },
                totalShopEarnings: { $sum: "$_shopEarnings" },
                totalTva: { $sum: "$_tva" },
              },
            },
          ],
          totalsOpenClosed: [
            {
              $group: {
                _id: "$_closed",
                bookingsCount: { $sum: 1 },
                totalPrice: { $sum: "$_price" },
                totalServiceFee: { $sum: "$_serviceFee" },
                totalCommission: { $sum: "$_commission" },
                totalShopEarnings: { $sum: "$_shopEarnings" },
                totalTva: { $sum: "$_tva" },
              },
            },
          ],
          breakdown: [
            {
              $group: {
                _id: breakdownGroupId,
                bookingsCount: { $sum: 1 },
                totalPrice: { $sum: "$_price" },
                totalServiceFee: { $sum: "$_serviceFee" },
                totalCommission: { $sum: "$_commission" },
                totalShopEarnings: { $sum: "$_shopEarnings" },
                totalTva: { $sum: "$_tva" },
              },
            },
            { $sort: { "_id.day": 1, "_id.year": 1, "_id.isoWeek": 1 } },
          ],
        },
      },
    ];

    const agg = await bookingModel.aggregate(pipeline);

    const totals = agg?.[0]?.totals?.[0] || {
      bookingsCount: 0,
      totalPrice: 0,
      totalServiceFee: 0,
      totalCommission: 0,
      totalShopEarnings: 0,
      totalTva: 0,
    };

    const splitArray = agg?.[0]?.totalsOpenClosed || [];
    const split = {
      open: splitArray.find((x: any) => x._id === false) || null,
      closed: splitArray.find((x: any) => x._id === true) || null,
    };

    const breakdownRaw = agg?.[0]?.breakdown || [];
    const breakdown =
      mode === "month"
        ? breakdownRaw.map((b: any) => ({
          year: b._id.year,
          isoWeek: b._id.isoWeek,
          bookingsCount: b.bookingsCount,
          totalPrice: b.totalPrice,
          totalServiceFee: b.totalServiceFee,
          totalCommission: b.totalCommission,
          totalShopEarnings: b.totalShopEarnings,
          totalTva: b.totalTva,
        }))
        : breakdownRaw.map((b: any) => ({
          day: b._id.day,
          bookingsCount: b.bookingsCount,
          totalPrice: b.totalPrice,
          totalServiceFee: b.totalServiceFee,
          totalCommission: b.totalCommission,
          totalShopEarnings: b.totalShopEarnings,
          totalTva: b.totalTva,
        }));

    logger.info({
      msg: "getShopAccounting success",
      route: "GET /api/booking-accounting/:shopId",
      method: req.method,
      url: req.originalUrl,
      shopId,
      query: sanitize(req.query),
      from,
      to,
      totals,
      userId: (req as any).user?._id,
    });

    return res.json({
      shopId,
      mode,
      period: { from, to },
      totals,
      split, // open vs closed
      breakdown,
    });
  } catch (error: any) {
    logger.error({
      msg: "getShopAccounting failed",
      route: "GET /api/booking-accounting/:shopId",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: sanitize(req.query),
      userId: (req as any).user?._id,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Impossible de générer le suivi comptable" });
  }
};


/**
 * Récupère toutes les bookings "pending" d'un prestataire (userProId)
 * GET /booking-pending-by-userPro/:userId
 */
const getPendingBookingsByUserPro = async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId manquant." });
    }

    const bookings = await bookingModel
      .find({
        userProId: userId,
        status: "pending",
      })
      .sort({ orderDate: -1 }); // les plus récentes en premier

    return res.status(200).json(bookings);
  } catch (error) {
    console.error("❌ getPendingBookingsByUserPro error:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = {
  getAllCACount,
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingById,
  deleteBookingById,
  getBookingsByShop,
  getBookingsByUserPro,
  getBookingsByClient,
  getAvailableSlots,
  updateBookingStatusById,
  confirmBookingCode,
  getDashboardStatsByShop,
  getPendingBookingsByUserPro,
  getShopAccounting,
};
