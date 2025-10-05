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

// ====== CRUD Booking ======
const createBooking = async (req: express.Request, res: express.Response) => {
  try {
    const { lang = "fr", ...data } = req.body;

    const newBooking = new BookingModel(data);
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
      logger.error({ msg: "notifyBookingStatusChanged failed", bookingId: updatedBooking._id?.toString(), errorMessage: e?.message, stack: e?.stack })
    );

    if (status === "accepted") {
      // Conversation auto si inexistante
      const conversationExists = await ConversationModel.findOne({
        participants: {
          $all: [
            new mongoose.Types.ObjectId(updatedBooking.clientId),
            new mongoose.Types.ObjectId(updatedBooking.userProId),
          ],
        },
      });

      if (conversationExists) {
        logger.info({
          msg: "updateBookingStatusById conversation exists",
          route: "PATCH /api/booking-update-status/:id",
          method: req.method,
          url: req.originalUrl,
          conversationId: conversationExists._id?.toString(),
        });
      } else {
        const conversation = new ConversationModel({
          participants: [
            new mongoose.Types.ObjectId(updatedBooking.clientId),
            new mongoose.Types.ObjectId(updatedBooking.userProId),
          ],
          name: `Conversation entre ${updatedBooking.clientId} et ${updatedBooking.userProId}`,
          messages: [],
        });

        await conversation.save();

        logger.info({
          msg: "updateBookingStatusById conversation created",
          route: "PATCH /api/booking-update-status/:id",
          method: req.method,
          url: req.originalUrl,
          conversationId: conversation._id?.toString(),
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

// ====== confirmation code & paiement ======
const confirmBookingCode = async (req: express.Request, res: express.Response) => {
  try {
    const { bookingId, code } = req.body;
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

    if (booking.generatedCode === code) {
      booking.proCodeConfirmed = true;
      await booking.save();

      const pro = await UserModel.findById(booking.userProId);
      if (!pro || !pro.bank || !pro.bank.iban || !pro.bank.bic) {
        logger.warn({
          msg: "confirmBookingCode missing bank info",
          route: "POST /api/bookings-confirm-code",
          method: req.method,
          url: req.originalUrl,
          proId: pro?._id?.toString(),
        });
        return res.status(400).json({ message: "Coordonnées bancaires manquantes" });
      }
      const amount = parseFloat(booking.shopEarnings || "0");
      if (amount <= 0) {
        logger.warn({
          msg: "confirmBookingCode invalid amount",
          route: "POST /api/bookings-confirm-code",
          method: req.method,
          url: req.originalUrl,
          amount,
        });
        return res.status(400).json({ message: "Montant invalide pour le paiement" });
      }

      // Paiement
      await sendSepaTransferToPro({
        iban: pro.bank.iban,
        bic: pro.bank.bic,
        amount,
        label: `Prestation du ${booking.date} pour ${booking.productName}`,
        recipient: `${pro.firstname} ${pro.lastname}`,
      });

      // Notification client
      notifyBookingCodeConfirmed(booking).catch((e) =>
        logger.error({ msg: "notifyBookingCodeConfirmed failed", bookingId, errorMessage: e?.message, stack: e?.stack })
      );

      logger.info({
        msg: "confirmBookingCode success",
        route: "POST /api/bookings-confirm-code",
        method: req.method,
        url: req.originalUrl,
        bookingId,
        proId: pro._id?.toString(),
        amount,
      });

      return res.json({ confirmed: true });
    } else {
      logger.info({
        msg: "confirmBookingCode mismatch",
        route: "POST /api/bookings-confirm-code",
        method: req.method,
        url: req.originalUrl,
        bookingId,
      });
      return res.json({ confirmed: false });
    }
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
};
