import Stripe from "stripe";
import moment from "moment-timezone";
import bookingModel from "../models/booking";
import ServiceModel from "../models/service";
import ShopModel from "../models/shop";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Garde ta version si tu en as besoin via ENV ; sinon Stripe utilisera la par défaut du compte.
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function guestClientId(phoneE164: string) {
  return `guest:${phoneE164}`;
}

function formatHuman(startUtc: Date, tz: string) {
  // Affichage humain dans le timezone du shop (plus logique pour le pro)
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

// E.164 minimal (Twilio envoie déjà +33..., donc on le garde)
// Si tu reçois "0612..." on ne devine pas le pays ici : on garde tel quel.
function normalizePhone(phone: string) {
  const p = (phone || "").trim();
  return p.startsWith("+") ? p : p;
}

export async function createBookingAndCheckout(params: {
  shopId: string;
  serviceId: string;
  fromPhone: string;
  slot: { date: string; start: string; end: string }; // local shop time
}) {
  const { shopId, serviceId, fromPhone, slot } = params;

  const shop: any = await ShopModel.findById(shopId).lean();
  if (!shop) throw new Error("Shop not found");

  const service: any = await ServiceModel.findById(serviceId).lean();
  if (!service || service.blocked) throw new Error("Service not found");

  const tz: string = shop.timeZone || "Europe/Paris";

  // ✅ Convertit le créneau (local shop TZ) -> UTC Date
  const startUtc = moment
    .tz(`${slot.date} ${slot.start}`, "YYYY-MM-DD HH:mm", tz)
    .utc()
    .toDate();

  const endUtc = moment
    .tz(`${slot.date} ${slot.end}`, "YYYY-MM-DD HH:mm", tz)
    .utc()
    .toDate();

  if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime()) || endUtc <= startUtc) {
    throw new Error("Invalid slot start/end");
  }

  const priceEuro = Number(service.price || 0);
  if (!Number.isFinite(priceEuro) || priceEuro <= 0) throw new Error("Invalid price");

  // V1 simple: tu brancheras ta vraie logique plus tard
  const commissionEuro = 0;
  const serviceFeeEuro = 0;
  const shopEarningsEuro = priceEuro - commissionEuro - serviceFeeEuro;

  const phone = normalizePhone(fromPhone);

  const booking = await bookingModel.create({
    title: service.name,
    establishmentName: shop.name || "IzyGlam",
    productName: service.name,

    // ⚠️ si tu as une adresse client à domicile, passe-la plus tard.
    address: shop.legal?.addressLine1 || "Adresse à confirmer",
    phoneNumber: phone,

    clientId: guestClientId(phone),
    userProId: String(shop.idUser),
    serviceId: String(service._id),
    shopId: String(shop._id),

    status: "pending",

    price: String(priceEuro),
    serviceFee: String(serviceFeeEuro),
    commission: String(commissionEuro),
    shopEarnings: String(shopEarningsEuro),
    tva: "0",

    // date "humaine" affichée dans le TZ du shop, mais start/end restent UTC
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
          unit_amount: Math.round(priceEuro * 100),
          product_data: { name: service.name },
        },
      },
    ],
    // ✅ important pour ton webhook
    metadata: {
      bookingId: String(booking._id),
      shopId: String(shop._id),
      serviceId: String(service._id),
      proId: String(shop.idUser),
      clientPhone: phone,
    },
    success_url: `${process.env.FRONTEND_URL}/paiement-validation?success=true&bookingId=${booking._id}`,
    cancel_url: `${process.env.FRONTEND_URL}/paiement-validation?success=false&bookingId=${booking._id}`,
  });

  if (!session.url) throw new Error("Stripe session url missing");

  return { bookingId: String(booking._id), checkoutUrl: session.url };
}
