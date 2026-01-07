import Stripe from "stripe";
import moment from "moment-timezone";

import bookingModel from "../models/booking";
import ServiceModel from "../models/service";
import ShopModel from "../models/shop";
import AdminSettingsModel from "../models/adminSettings";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function guestClientId(phoneE164: string) {
  return `guest:${phoneE164}`;
}

function formatHuman(startUtc: Date, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startUtc);
}

function generateCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizePhone(phone: string) {
  const p = (phone || "").trim();
  return p.startsWith("+") ? p : p;
}

function toRate(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  // si on reçoit 15 => 0.15 ; si on reçoit 0.15 => 0.15
  return n > 1 ? n / 100 : n;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function euroToCents(e: number) {
  return Math.round(e * 100);
}

function centsToEuro(c: number) {
  return round2(c / 100);
}

/**
 * Pricing:
 * - base = prix service (HT ou “prix catalogue”)
 * - commission = base * commissionRate
 * - serviceFee = fixe
 * - TVA appliquée sur (base + commission + fee)
 *
 * Retour en € + centimes
 */
function computePricing(params: {
  baseEuro: number;
  commissionRate: number; // 0.15 ou 15 => géré par toRate en amont si tu veux
  serviceFeeEuro: number;
  taxRate: number; // 20 ou 0.2 => géré par toRate
}) {
  const base = Math.max(0, Number(params.baseEuro) || 0);

  const commissionRate = toRate(params.commissionRate);
  const taxRate = toRate(params.taxRate);

  const commission = base * commissionRate;
  const fee = Math.max(0, Number(params.serviceFeeEuro) || 0);

  const subtotal = base + commission + fee;
  const tva = subtotal * taxRate;
  const total = subtotal + tva;

  // arrondi centimes (source de vérité)
  const totalCents = euroToCents(total);

  // recalcul “propre” depuis centimes (évite les micro-écarts)
  const totalEuro = centsToEuro(totalCents);

  // Pour booking, on peut aussi “figer” commission/fee/tva en € arrondis
  // (si tu veux 100% cohérence comptable, tu peux aussi tout stocker en centimes)
  return {
    baseEuro: round2(base),
    commissionEuro: round2(commission),
    serviceFeeEuro: round2(fee),
    taxEuro: round2(tva),
    totalEuro,
    totalCents,
  };
}

export async function createBookingAndCheckout(params: {
  shopId: string;
  serviceId: string;
  fromPhone: string;
  slot: { date: string; start: string; end: string }; // local shop time
  clientAddress?: string; // ✅ optionnel: si tu veux l’ajouter depuis SMS flow
}) {
  const { shopId, serviceId, fromPhone, slot, clientAddress } = params;

  const shop: any = await ShopModel.findById(shopId).lean();
  if (!shop) throw new Error("Shop not found");

  const service: any = await ServiceModel.findById(serviceId).lean();
  if (!service || service.blocked) throw new Error("Service not found");

  // ✅ tu n’as pas timeZone dans Shop -> fallback Paris (ok)
  const tz: string = "Europe/Paris";

  // slot local -> UTC
  const startUtc = moment.tz(`${slot.date} ${slot.start}`, "YYYY-MM-DD HH:mm", tz).utc().toDate();
  const endUtc = moment.tz(`${slot.date} ${slot.end}`, "YYYY-MM-DD HH:mm", tz).utc().toDate();

  if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime()) || endUtc <= startUtc) {
    throw new Error("Invalid slot start/end");
  }

  // ✅ settings admin
  const settings: any = await AdminSettingsModel.findOne({}).lean();
  const commissionRate = settings?.commissionRate ?? 0; // ex: 15
  const serviceFeeEuro = settings?.serviceFee ?? 0;     // ex: 2.9
  const taxRate = settings?.taxRate ?? 20;              // ex: 20

  const baseEuro = Number(service.price || 0);
  if (!Number.isFinite(baseEuro) || baseEuro <= 0) throw new Error("Invalid base price");

  const pricing = computePricing({
    baseEuro,
    commissionRate,
    serviceFeeEuro,
    taxRate,
  });

  // ✅ ce que le client paie (TTC)
  const priceEuroTtc = pricing.totalEuro;

  // ✅ ce que tu stockes dans Booking (strings comme ton model)
  const commissionEuro = pricing.commissionEuro;
  const feeEuro = pricing.serviceFeeEuro;

  // Shop earnings = total - commission - fee
  // (TVA incluse dans total, donc commission/fee doivent être “compatibles” avec ta logique business)
  const shopEarningsEuro = round2(priceEuroTtc - commissionEuro - feeEuro);

  const phone = normalizePhone(fromPhone);

  const booking = await bookingModel.create({
    title: service.name,
    establishmentName: shop.name || "IzyGlam",
    productName: service.name,

    // ✅ adresse client si fournie
    address: clientAddress || "Adresse à confirmer",
    phoneNumber: phone,

    clientId: guestClientId(phone),
    userProId: String(shop.idUser),
    serviceId: String(service._id),
    shopId: String(shop._id),

    status: "pending",

    // TTC + détails
    price: String(priceEuroTtc),
    serviceFee: String(feeEuro),
    commission: String(commissionEuro),
    shopEarnings: String(shopEarningsEuro),
    tva: String(pricing.taxEuro),

    date: formatHuman(startUtc, tz),
    orderDate: new Date(),
    start: startUtc,
    end: endUtc,

    color: service.color || "#ff4081",
    image: service.image || "",

    generatedCode: generateCode(6),
    proCodeConfirmed: false,

    reviewAdded: false,
    closed: false,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: pricing.totalCents, // ✅ centimes TTC
          product_data: { name: service.name },
        },
      },
    ],
    metadata: {
      bookingId: String(booking._id),
      shopId: String(shop._id),
      serviceId: String(service._id),
      proId: String(shop.idUser),
      clientPhone: phone,

      // bonus debug pricing (optionnel)
      baseEuro: String(pricing.baseEuro),
      commissionEuro: String(pricing.commissionEuro),
      serviceFeeEuro: String(pricing.serviceFeeEuro),
      taxEuro: String(pricing.taxEuro),
      totalEuro: String(pricing.totalEuro),
    },
    success_url: `${process.env.FRONTEND_URL}/paiement-validation?success=true&bookingId=${booking._id}`,
    cancel_url: `${process.env.FRONTEND_URL}/paiement-validation?success=false&bookingId=${booking._id}`,
  });

  if (!session.url) throw new Error("Stripe session url missing");

  return { bookingId: String(booking._id), checkoutUrl: session.url };
}
