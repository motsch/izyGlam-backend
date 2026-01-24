import moment from "moment-timezone";
import BookingModel from "../models/booking";
import ServiceModel from "../models/service";
import ShopModel from "../models/shop";
import UserModel from "../models/user";

// ⚠️ Mets les mêmes constantes que dans ton bookingController
const WINDOW_WEEKS = 4;
const GRID_MINUTES = 15;
const MAX_SLOTS_PER_DAY = 3;
const BLOCKING_STATUSES = ["pending", "accepted", "finished"];

function dayKeyFromMoment(d: moment.Moment) {
  const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[d.day()];
}

function roundUpToGrid(t: moment.Moment, gridMin: number) {
  const m = t.minute();
  const r = Math.ceil(m / gridMin) * gridMin;
  const out = t.clone().second(0).millisecond(0);
  if (r === 60) return out.minute(0).add(1, "hour");
  return out.minute(r);
}

function overlapsWithBuffer(
  slotStart: moment.Moment,
  slotEnd: moment.Moment,
  bStart: moment.Moment,
  bEnd: moment.Moment,
  bufferMin: number
) {
  const sStart = slotStart.clone().subtract(bufferMin, "minutes");
  const sEnd = slotEnd.clone().add(bufferMin, "minutes");
  return sStart.isBefore(bEnd) && sEnd.isAfter(bStart);
}

function pickSpread<T>(arr: T[], max: number) {
  return arr.slice(0, max);
}

export async function computeAvailableSlots(shopId: string, serviceId: string) {
  const service: any = await ServiceModel.findById(serviceId);
  if (!service) throw new Error("Service non trouvé");
  const durationMin = Number(service.duration);

  const shop: any = await ShopModel.findById(shopId);
  if (!shop) throw new Error("Boutique non trouvée");

  const professional: any = await UserModel.findById(shop.idUser);
  if (!professional) throw new Error("Professionnel non trouvé");

  const tz = shop.timeZone || "Europe/Paris";
  const now = moment.tz(tz);

  const ondaybooking: boolean = !!shop.ondaybooking;
  const minimumDelayMin = Number(shop.minimumDelay || "30");
  const startDate = now.clone().startOf("day");
  const endDate = now.clone().add(WINDOW_WEEKS, "weeks").endOf("day");

  const bookings: any[] = await BookingModel.find({
    userProId: professional._id.toString(),
    status: { $in: BLOCKING_STATUSES },
    $or: [{ start: { $lt: endDate.toDate() }, end: { $gt: startDate.toDate() } }],
  }).lean();

  const allAvailableSlots: Array<{ date: string; start: string; end: string }> = [];

  for (let d = startDate.clone(); d.isSameOrBefore(endDate, "day"); d.add(1, "day")) {
    const dayKey = dayKeyFromMoment(d);
    const daySchedule = shop.hours?.[dayKey];

    if (!daySchedule || daySchedule.closed) continue;

    const hasUnavailability = (professional.unavailability || []).some((u: any) => {
      const uStart = moment(u.start).tz(tz).subtract(minimumDelayMin, "minutes");
      const uEnd = moment(u.end).tz(tz).add(minimumDelayMin, "minutes");
      return d.clone().endOf("day").isAfter(uStart) && d.clone().startOf("day").isBefore(uEnd);
    });
    if (hasUnavailability) continue;

    const periods: Array<{ pStart: moment.Moment; pEnd: moment.Moment }> = [];
    const addPeriod = (startStr?: string, endStr?: string) => {
      if (!startStr || !endStr) return;

      const pStart = d.clone()
        .hour(Number(startStr.split(":")[0]))
        .minute(Number(startStr.split(":")[1]))
        .second(0)
        .millisecond(0);

      const pEnd = d.clone()
        .hour(Number(endStr.split(":")[0]))
        .minute(Number(endStr.split(":")[1]))
        .second(0)
        .millisecond(0);

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

  allAvailableSlots.sort((a, b) =>
    a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)
  );

  return allAvailableSlots;
}
