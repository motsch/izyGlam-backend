// src/services/assistantCheckout.service.ts
import Stripe from "stripe";
import moment from "moment-timezone";
import { randomBytes } from "crypto";

import bookingModel from "../models/booking";
import ServiceModel from "../models/service";
import ShopModel from "../models/shop";
import AdminSettingsModel from "../models/adminSettings";
import UserModel from "../models/user";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

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

/** ✅ Code NUMERIQUE 6 chiffres (100000..999999) */
function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone: string) {
  // Twilio renvoie en général déjà du E.164 (+33...)
  // On fait juste un trim + garde tel quel pour éviter de casser ton existant.
  return String(phone || "").trim();
}

function makeGuestEmail(phoneE164: string) {
  const safe = normalizePhone(phoneE164).replace(/[^\d+]/g, "");
  return `guest+${safe}@izyglam.invalid`;
}

/**
 * ✅ Get-or-Create client par téléphone
 * Règles:
 * 1) Si un user NON-guest existe déjà avec ce phone => on le réutilise
 * 2) Sinon => upsert d’un guest (role: "guest") sur { phone, role: "guest" }
 */
async function getOrCreateClientUserByPhone(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error("PHONE_REQUIRED");

  // 1) vrai user existant ?
  const existingReal = await UserModel.findOne({
    phone,
    role: { $ne: "guest" },
  }).exec();

  if (existingReal) return existingReal;

  // 2) upsert guest
  const email = makeGuestEmail(phone);
  const guestPassword = randomBytes(24).toString("hex");

  const guest = await UserModel.findOneAndUpdate(
    { phone, role: "guest" },
    {
      $setOnInsert: {
        firstname: "Invité",
        lastname: "IzyGlam",
        phone,
        email,
        password: guestPassword,
        sex: "female",
        role: "guest",
        active: true,

        credit: 0,
        favoriteShops: [],
        fidelity: { stars: 0, card_expiration: new Date(), rewards_history: [] },

        createdAt: new Date().toISOString(),
      },
      $set: {
        updatedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      },
    },
    { new: true, upsert: true }
  ).exec();

  if (!guest) throw new Error("USER_UPSERT_FAILED");
  return guest;
}

function toRate(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
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

function computePricing(params: {
  baseEuro: number;
  commissionRate: number;
  serviceFeeEuro: number;
  taxRate: number;
}) {
  const base = Math.max(0, Number(params.baseEuro) || 0);
  const commissionRate = toRate(params.commissionRate);
  const taxRate = toRate(params.taxRate);

  const commission = base * commissionRate;
  const fee = Math.max(0, Number(params.serviceFeeEuro) || 0);

  const subtotal = base + commission + fee;
  const tva = subtotal * taxRate;
  const total = subtotal + tva;

  const totalCents = euroToCents(total);
  const totalEuro = centsToEuro(totalCents);

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
  clientAddress?: string;
}) {
  const { shopId, serviceId, fromPhone, slot, clientAddress } = params;

  const shop: any = await ShopModel.findById(shopId).lean();
  if (!shop) throw new Error("Shop not found");

  const service: any = await ServiceModel.findById(serviceId).lean();
  if (!service || service.blocked) throw new Error("Service not found");

  const tz: string = "Europe/Paris";

  const startUtc = moment.tz(`${slot.date} ${slot.start}`, "YYYY-MM-DD HH:mm", tz).utc().toDate();
  const endUtc = moment.tz(`${slot.date} ${slot.end}`, "YYYY-MM-DD HH:mm", tz).utc().toDate();

  if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime()) || endUtc <= startUtc) {
    throw new Error("Invalid slot start/end");
  }

  const settings: any = await AdminSettingsModel.findOne({}).lean();
  const commissionRate = settings?.commissionRate ?? 0;
  const serviceFeeEuro = settings?.serviceFee ?? 0;
  const taxRate = settings?.taxRate ?? 20;

  const baseEuro = Number(service.price || 0);
  if (!Number.isFinite(baseEuro) || baseEuro <= 0) throw new Error("Invalid base price");

  const pricing = computePricing({
    baseEuro,
    commissionRate,
    serviceFeeEuro,
    taxRate,
  });

  const priceEuroTtc = pricing.totalEuro;
  const commissionEuro = pricing.commissionEuro;
  const feeEuro = pricing.serviceFeeEuro;
  const shopEarningsEuro = round2(priceEuroTtc - commissionEuro - feeEuro);

  const phone = normalizePhone(fromPhone);

  // ✅ CLIENT: get-or-create
  const clientUser: any = await getOrCreateClientUserByPhone(phone);

  const generatedCode = generate6DigitCode();

  const booking = await bookingModel.create({
    title: service.name,
    establishmentName: shop.name || "IzyGlam",
    productName: service.name,

    address: clientAddress || "Adresse à confirmer",
    phoneNumber: phone,

    categoryId: service.categoryId ? String(service.categoryId) : undefined,

    // ✅ IMPORTANT: vrai userId
    clientId: String(clientUser._id),

    userProId: String(shop.idUser),
    serviceId: String(service._id),
    shopId: String(shop._id),

    status: "pending",

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

    generatedCode,
    proCodeConfirmed: false,

    reviewAdded: false,
    proCommentAdded: false,
    closed: false,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",

    // ✅ Stripe collect
    customer_creation: "always",
    billing_address_collection: "auto",

    // ✅ pré-rempli
    customer_email: clientUser.email,

    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: pricing.totalCents,
          product_data: { name: service.name },
        },
      },
    ],
    metadata: {
      bookingId: String(booking._id),
      shopId: String(shop._id),
      serviceId: String(service._id),
      proId: String(shop.idUser),

      // ✅ super important pour webhook / debug
      clientId: String(clientUser._id),
      clientPhone: phone,

      generatedCode: generatedCode,

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
