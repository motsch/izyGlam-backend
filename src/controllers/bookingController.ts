import BookingModel from "../models/booking";
import * as express from "express";
// import moment from "moment"; // moment.js pour faciliter les calculs de temps
// import shopModel from "../models/shop";
import serviceModel from "../models/service";
import userModel from "../models/user";
import { sendSepaTransferToPro } from "../services/paymentService"; // à créer
import moment from "moment-timezone";
import ServiceModel from "../models/service";      // ajuste le chemin si besoin
import ShopModel from "../models/shop";
import UserModel from "../models/user";
// import shopModel from "../models/shop";
import { iShop } from "../models/shop"; // adapte le chemin si besoin
import { notifyBookingCodeConfirmed, notifyBookingStatusChanged, notifyProNewBooking } from "../services/notify";
import ConversationModel from "../models/conversation";
import mongoose from "mongoose";

const getAllCACount = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Filtrer les réservations avec le statut "completed" et récupérer seulement le champ price
    const bookings = await BookingModel.find({ status: "completed" }, "price");

    // Calculer le chiffre d'affaires en additionnant toutes les valeurs de price
    const CA = bookings.reduce((total, booking) => {
      return total + parseFloat(booking.price);
    }, 0);

    res.status(200).json(CA);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le chiffre d'affaires" });
  }
};

// Créer une nouvelle réservation
const createBooking = async (req: express.Request, res: express.Response) => {
  try {
    const { lang = "fr", ...data } = req.body; // 👈 on sort "lang" du body

    const newBooking = new BookingModel(data);
    await newBooking.save();

    // 🔔 Notifier le prestataire
    await notifyProNewBooking(newBooking, lang);

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: "Impossible de créer la réservation" });
  }
};


// Récupérer toutes les réservations
const getAllBookings = async (req: express.Request, res: express.Response) => {
  try {
    const bookings = await BookingModel.find();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations" });
  }
};

// Récupérer une réservation par son ID
const getBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const booking = await BookingModel.findById(id);
    if (booking) {
      res.json(booking);
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la réservation" });
  }
};

// Mettre à jour une réservation par son ID
const updateBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedBooking = await BookingModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedBooking) {
      res.json(updatedBooking);
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la réservation" });
  }
};

// Supprimer une réservation par son ID
const deleteBookingById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const deletedBooking = await BookingModel.findByIdAndDelete(id);
    if (deletedBooking) {
      res.json({ message: "Réservation supprimée avec succès" });
    } else {
      res.status(404).json({ message: "Réservation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer la réservation" });
  }
};

// Récupérer toutes les réservations pour une boutique spécifique
const getBookingsByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { shopId } = req.params;
    const bookings = await BookingModel.find({ shop: shopId });
    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cette boutique" });
  }
};

// Récupérer toutes les réservations d'un utilisateur Pro (sans le champ generatedCode)
const getBookingsByUserPro = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by userPro");
    const { userId } = req.params;
    // Exclure le champ 'generatedCode'
    const bookings = await BookingModel.find({ userProId: userId })
      .select("-generatedCode");

    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};


// Récupérer toutes les réservations d'un utilisateur en excluant celles supprimées
const getBookingsByClient = async (req: express.Request, res: express.Response) => {
  try {
    console.log("in by user");
    const { id } = req.params;
    console.log("userId : " + id);

    // On ajoute { status: { $ne: "deleted" } } à la condition de recherche
    const bookings = await BookingModel.find({ clientId: id, status: { $ne: "deleted" } });

    if (bookings.length > 0) {
      res.json(bookings);
    } else {
      res.status(404).json({ message: "Aucune réservation trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les réservations pour cet utilisateur" });
  }
};

export const getAvailableSlotsV2 = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId, shopId } = req.params;

    const service = await serviceModel.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service non trouvé" });
    const duration = service.duration;

    const shop: any = await ShopModel.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Boutique non trouvée" });

    const professional = await userModel.findById(shop.idUser);
    if (!professional) return res.status(404).json({ message: "Professionnel non trouvé" });

    const ondaybooking = shop.ondaybooking;
    const margin = 30;
    const minimumDelay = moment.duration(shop.minimumDelay || "30", "minutes").asMinutes();

    const startDate = moment().startOf("day");
    const endDate = moment().add(6, "weeks").endOf("day");

    const bookings = await BookingModel.find({
      userProId: professional._id,
      start: { $gte: startDate.toDate(), $lte: endDate.toDate() },
      status: { $ne: "deleted" },
    });

    const now = moment();
    const today = now.format("YYYY-MM-DD");
    const allAvailableSlots: any[] = [];

    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, "days")) {
      const dayKey = date.format("dddd").toLowerCase();
      const daySchedule = shop.hours?.[dayKey];

      if (!daySchedule || daySchedule.closed) continue;

      const isUnavailable = professional.unavailability?.some(unavail => {
        const unavailableStart = moment(unavail.start);
        const unavailableEnd = moment(unavail.end);
        return date.isBetween(unavailableStart, unavailableEnd, "day", "[]");
      });
      if (isUnavailable) continue;

      const addSlots = (label: string, startStr: string, endStr: string) => {
        let periodStart = date.clone().hour(Number(startStr.split(":")[0])).minute(Number(startStr.split(":")[1]));
        let periodEnd = date.clone().hour(Number(endStr.split(":")[0])).minute(Number(endStr.split(":")[1]));

        let currentTime = periodStart.clone();

        // Si on est aujourd'hui et ondaybooking = false, on saute
        if (!ondaybooking && date.isSame(today, "day")) return;

        // Si on est aujourd'hui, on doit appliquer minimumDelay à now
        const minAvailableTime = now.clone().add(minimumDelay, "minutes");
        if (date.isSame(today, "day")) {
          if (minAvailableTime.isAfter(periodEnd)) return; // trop tard
          if (currentTime.isBefore(minAvailableTime)) {
            currentTime = minAvailableTime.clone();
          }
        }

        while (currentTime.clone().add(duration, "minutes").isSameOrBefore(periodEnd)) {
          const slotStart = currentTime.clone();
          const slotEnd = currentTime.clone().add(duration, "minutes");

          const isOverlapping = bookings.some(booking => {
            const bookingStart = moment(booking.start);
            const bookingEnd = moment(booking.end).add(minimumDelay, "minutes");
            return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
          });

          if (!isOverlapping) {
            allAvailableSlots.push({
              date: date.format("YYYY-MM-DD"),
              start: slotStart.format("HH:mm"),
              end: slotEnd.format("HH:mm"),
            });
            currentTime = slotEnd.clone().add(margin, "minutes");
          } else {
            currentTime.add(5, "minutes");
          }
        }
      };

      if (daySchedule.morning?.start && daySchedule.morning?.end) {
        addSlots("matin", daySchedule.morning.start, daySchedule.morning.end);
      }
      if (daySchedule.afternoon?.start && daySchedule.afternoon?.end) {
        addSlots("après-midi", daySchedule.afternoon.start, daySchedule.afternoon.end);
      }
    }

    res.json(allAvailableSlots);
  } catch (error) {
    console.error("Erreur lors du calcul des créneaux:", error);
    res.status(500).json({ message: "Erreur lors du calcul des créneaux disponibles" });
  }
};

// Annuler une réservation en mettant à jour son statut à "cancelled"
// Mettre à jour le statut d'une réservation
const updateBookingStatusById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const status = req.body.status;
    const langue = req.body.langue;

    console.log("📩 [updateBookingStatusById] Called with:", { id, status, langue });

    const updatedBooking = await BookingModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedBooking) {
      console.log("❌ Booking not found:", id);
      return res.status(404).json({ message: "Réservation non trouvée" });
    }

    console.log("✅ Booking updated:", updatedBooking._id, "→", updatedBooking.status);

    // 🔔 fire & forget
    notifyBookingStatusChanged(updatedBooking, langue).catch(console.error);

    // 👉 Cas 1 : Création de conversation quand "accepted"
    if (status === "accepted") {
      console.log("🔍 Booking accepted, checking for existing conversation...");

      const conversationExists = await ConversationModel.findOne({
        participants: {
          $all: [
            new mongoose.Types.ObjectId(updatedBooking.clientId),
            new mongoose.Types.ObjectId(updatedBooking.userProId),
          ],
        },
      });

      if (conversationExists) {
        console.log("⚠️ Conversation already exists:", conversationExists._id);
      } else {
        console.log("🆕 Creating new conversation...");
        const conversation = new ConversationModel({
          participants: [
            new mongoose.Types.ObjectId(updatedBooking.clientId),
            new mongoose.Types.ObjectId(updatedBooking.userProId),
          ],
          name: `Conversation entre ${updatedBooking.clientId} et ${updatedBooking.userProId}`,
          messages: [],
        });

        await conversation.save();
        console.log("✅ Conversation created successfully:", conversation._id);
      }
    }

    // 👉 Cas 2 : plus besoin de fermer les conversations
    // elles vivent indépendamment du booking maintenant
    // (donc on supprime ce bloc)

    return res.json({ message: "Statut mis à jour", booking: updatedBooking });

  } catch (error) {
    console.error("🔥 Error in updateBookingStatusById:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la réservation" });
  }
};

/**
 * Controller pour confirmer le code du booking.
 * Expects { bookingId: string, code: string } dans req.body.
 */

const confirmBookingCode = async (req: express.Request, res: express.Response) => {
  try {
    const { bookingId, code } = req.body;
    if (!bookingId || !code) {
      return res.status(400).json({ message: "bookingId et code sont obligatoires" });
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking non trouvé" });

    if (booking.generatedCode === code) {
      booking.proCodeConfirmed = true;
      await booking.save();

      // ➕ Paiement au pro (ta logique)
      const pro = await userModel.findById(booking.userProId);
      if (!pro || !pro.bank || !pro.bank.iban || !pro.bank.bic) {
        return res.status(400).json({ message: "Coordonnées bancaires manquantes" });
      }
      const amount = parseFloat(booking.shopEarnings || "0");
      if (amount <= 0) {
        return res.status(400).json({ message: "Montant invalide pour le paiement" });
      }
      await sendSepaTransferToPro({
        iban: pro.bank.iban,
        bic: pro.bank.bic,
        amount,
        label: `Prestation du ${booking.date} pour ${booking.productName}`,
        recipient: `${pro.firstname} ${pro.lastname}`,
      });

      // 🔔 notifier le client
      notifyBookingCodeConfirmed(booking).catch(console.error);

      return res.json({ confirmed: true });
    } else {
      return res.json({ confirmed: false });
    }
  } catch (error) {
    console.error("Erreur lors de la confirmation du code :", error);
    return res.status(500).json({ message: "Erreur interne du serveur" });
  }
};

const getDashboardStatsByShop = async (req: express.Request, res: express.Response) => {
  const { shopId } = req.params;

  try {
    const allBookings = await BookingModel.find({ shopId, status: "finished" });
    const now = moment();
    const startOfCurrentMonth = now.clone().startOf("month");
    const startOfLastMonth = now.clone().subtract(1, "month").startOf("month");
    const endOfLastMonth = startOfCurrentMonth.clone().subtract(1, "day").endOf("day");

    // KPI 1 : CA
    const totalRevenue = allBookings.reduce((sum, b) => sum + parseFloat(b.price || "0"), 0);

    // KPI 2 : Commissions
    const totalCommission = allBookings.reduce((sum, b) => sum + parseFloat(b.commission || "0"), 0);

    // KPI 3 : Évolution M-1 → M
    const currentMonthRevenue = allBookings
      .filter(b => moment(b.orderDate).isSameOrAfter(startOfCurrentMonth))
      .reduce((sum, b) => sum + parseFloat(b.price || "0"), 0);

    const lastMonthRevenue = allBookings
      .filter(b => moment(b.orderDate).isBetween(startOfLastMonth, endOfLastMonth))
      .reduce((sum, b) => sum + parseFloat(b.price || "0"), 0);

    const evolution =
      lastMonthRevenue > 0
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : null;

    // KPI 4 : Revenu net à verser
    const confirmedBookings = allBookings.filter(b => b.proCodeConfirmed);
    const totalEarnings = confirmedBookings.reduce((sum, b) => sum + parseFloat(b.shopEarnings || "0"), 0);

    // KPI 5 : Nombre de prestations
    const totalBookings = allBookings.length;

    // KPI 6 : Nb d’annulations
    const cancelledBookings = await BookingModel.countDocuments({
      shopId,
      status: { $in: ["cancelled", "refused", "no-show-client", "no-show-pro"] },
    });

    // KPI 7 : Moyenne par prestation
    const avgPrice = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // KPI 8 : % de bookings avec avis
    const reviewsCount = allBookings.filter(b => b.reviewAdded).length;
    const reviewRatio = totalBookings > 0 ? (reviewsCount / totalBookings) * 100 : 0;

    // KPI 9 : Top prestations
    const earningsByProduct: Record<string, number> = {};
    allBookings.forEach(b => {
      const name = b.productName || "Inconnu";
      earningsByProduct[name] = (earningsByProduct[name] || 0) + parseFloat(b.price || "0");
    });
    const topProducts = Object.entries(earningsByProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([product, total]) => ({ product, total: total.toFixed(2) }));

    // KPI 10 : Durée moyenne
    const totalDurations = allBookings.reduce((sum, b) => {
      const start = moment(b.start);
      const end = moment(b.end);
      return sum + end.diff(start, "minutes");
    }, 0);
    const avgDuration = totalBookings > 0 ? totalDurations / totalBookings : 0;

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
      avgDuration: Math.round(avgDuration), // en minutes
    });
  } catch (error) {
    console.error("Erreur dans getDashboardStatsByShop :", error);
    return res.status(500).json({ message: "Erreur lors du calcul des stats" });
  }
};

// ----- CONFIG METIER -----
const GRID_MINUTES = 15;            // alignement Doctolib-like
const MAX_SLOTS_PER_DAY = 10;       // “10 pile”
const WINDOW_WEEKS = 6;             // 6 semaines
const BLOCKING_STATUSES = ["pending", "accepted"] as const;

// ----- UTILS -----
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// arrondit vers le haut sur la grille (ex. 15 min)
const roundUpToGrid = (m: moment.Moment, gridMin: number) => {
  const minutes = m.minutes();
  const remainder = minutes % gridMin;
  if (remainder === 0) return m.clone().seconds(0).milliseconds(0);
  return m.clone().add(gridMin - remainder, "minutes").seconds(0).milliseconds(0);
};

const dayKeyFromMoment = (d: moment.Moment) => {
  // moment().format('dddd') dépend de la locale; on normalise :
  const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  // return map[d.day()] as keyof ShopModel["hours"];
  return map[d.day()] as keyof iShop["hours"];

};

// overlap avec buffer bilatéral :
// slot [S,E] interdit si (S < bookingEnd+buffer) && (E > bookingStart-buffer)
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

// étalement “humain” : on prend 10 slots répartis sur la liste triée
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
    const service = await ServiceModel.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service non trouvé" });
    const durationMin = Number(service.duration); // en minutes

    const shop: any = await ShopModel.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Boutique non trouvée" });

    const professional = await UserModel.findById(shop.idUser);
    if (!professional) return res.status(404).json({ message: "Professionnel non trouvé" });

    // 2) Timezone
    const tz = shop.timeZone || "Europe/Paris"; // prêt pour l’international
    const now = moment.tz(tz);

    // 3) Paramètres métier
    const ondaybooking: boolean = !!shop.ondaybooking;
    const minimumDelayMin = Number(shop.minimumDelay || "30"); // buffer global avant ET après
    const startDate = now.clone().startOf("day");
    const endDate = now.clone().add(WINDOW_WEEKS, "weeks").endOf("day");

    // 4) Récupère les bookings bloquants sur la fenêtre (pending + accepted)
    const bookings = await BookingModel.find({
      userProId: professional._id.toString(),
      status: { $in: BLOCKING_STATUSES },
      // correction n°1 : on prend toute résa qui chevauche la fenêtre
      $or: [
        { start: { $lt: endDate.toDate() }, end: { $gt: startDate.toDate() } }
      ]
    }).lean();

    const allAvailableSlots: Array<{ date: string; start: string; end: string }> = [];

    // 5) Boucle par jour
    for (let d = startDate.clone(); d.isSameOrBefore(endDate, "day"); d.add(1, "day")) {
      const dayKey = dayKeyFromMoment(d);
      const daySchedule = shop.hours?.[dayKey];

      if (!daySchedule || daySchedule.closed) continue;

      // 5.1 indisponibilités pro (inclusives + délai)
      const hasUnavailability = (professional.unavailability || []).some((u: any) => {
        const uStart = moment(u.start).tz(tz).subtract(minimumDelayMin, "minutes");
        const uEnd = moment(u.end).tz(tz).add(minimumDelayMin, "minutes");
        // si le jour d est touché par l’indispo élargie
        return d.clone().endOf("day").isAfter(uStart) && d.clone().startOf("day").isBefore(uEnd);
      });
      if (hasUnavailability) continue;

      // 5.2 Construit les deux périodes du jour
      const periods: Array<{ pStart: moment.Moment; pEnd: moment.Moment }> = [];
      const addPeriod = (startStr?: string, endStr?: string) => {
        if (!startStr || !endStr) return;
        const pStart = d.clone().hour(Number(startStr.split(":")[0])).minute(Number(startStr.split(":")[1])).second(0).millisecond(0);
        const pEnd = d.clone().hour(Number(endStr.split(":")[0])).minute(Number(endStr.split(":")[1])).second(0).millisecond(0);
        if (pEnd.isAfter(pStart)) periods.push({ pStart, pEnd });
      };
      addPeriod(daySchedule.morning?.start, daySchedule.morning?.end);
      addPeriod(daySchedule.afternoon?.start, daySchedule.afternoon?.end);

      // 5.3 Slots candidats sur chaque période
      const dayCandidates: Array<{ date: string; start: string; end: string; _msStart: number }> = [];

      for (const { pStart, pEnd } of periods) {
        // Règle “buffer avant la première du jour” : on ne peut pas démarrer avant pStart + minimumDelay
        let cur = pStart.clone().add(minimumDelayMin, "minutes");

        // Today rules
        if (d.isSame(now, "day")) {
          if (!ondaybooking) continue; // aucun slot aujourd’hui
          const earliestToday = roundUpToGrid(now.clone().add(minimumDelayMin, "minutes"), GRID_MINUTES);
          if (earliestToday.isAfter(cur)) cur = earliestToday.clone();
        }

        // aligne sur la grille 15 min
        cur = roundUpToGrid(cur, GRID_MINUTES);

        while (true) {
          const slotStart = cur.clone();
          const slotEnd = cur.clone().add(durationMin, "minutes");

          // Le slot doit tenir ENTIEREMENT dans la période (pas de chevauchement pause)
          if (slotEnd.isAfter(pEnd)) break; // on dépasse, on passe à la période suivante

          // Test overlap vs bookings (buffer bilatéral)
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

          // avance d’un pas de grille (15 min)
          cur.add(GRID_MINUTES, "minutes");
        }
      }

      // Tri, limitation à 10, étalement
      dayCandidates.sort((a, b) => a._msStart - b._msStart);
      const picked = pickSpread(dayCandidates, MAX_SLOTS_PER_DAY);
      picked.forEach(({ date, start, end }) => allAvailableSlots.push({ date, start, end }));
    }

    // Tri global (date + heure)
    allAvailableSlots.sort((a, b) => {
      if (a.date === b.date) return a.start.localeCompare(b.start);
      return a.date.localeCompare(b.date);
    });

    return res.json(allAvailableSlots);
  } catch (err) {
    console.error("Erreur getAvailableSlots:", err);
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
