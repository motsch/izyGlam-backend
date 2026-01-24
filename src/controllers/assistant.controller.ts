import { Request, Response } from "express";
import Stripe from "stripe";
import bookingModel from "../models/booking";
import ServiceModel from "../models/service";
import UserModel from "../models/user";
import ShopModel from "../models/shop";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

/**
 * ✅ IMPORTANT
 * En testmode + Accounts V2, Stripe Checkout ne supporte pas `customer_creation: "always"`
 * sans customer existant. Donc:
 * - on crée/récupère un Customer Stripe nous-mêmes
 * - on passe `customer: cus_...` à Checkout
 * - on laisse Stripe collecter & MAJ via customer_update + billing_address_collection
 */
async function ensureStripeCustomerForUser(user: any) {
  const existing = String(user?.customerId || "").trim();
  if (existing) return existing;

  const email = String(user?.email || "").trim() || undefined;
  const phone = String(user?.phone || "").trim() || undefined;

  const name = `${String(user?.firstname || "").trim()} ${String(user?.lastname || "").trim()}`
    .trim()
    || undefined;

  const customer = await stripe.customers.create({
    email,
    phone,
    name,
    metadata: {
      userId: String(user?._id || ""),
      role: String(user?.role || ""),
    },
  });

  await UserModel.updateOne(
    { _id: user._id, $or: [{ customerId: { $exists: false } }, { customerId: null }, { customerId: "" }] },
    { $set: { customerId: customer.id } }
  );

  return customer.id;
}

function humanDate(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** ✅ Code NUMERIQUE 6 chiffres (100000..999999) */
function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone: string) {
  return String(phone || "").trim();
}

function makeGuestEmail(phoneE164: string) {
  const safe = normalizePhone(phoneE164).replace(/[^\d+]/g, "");
  return `guest+${safe}@izyglam.invalid`;
}

/**
 * ✅ Get or Create "guest" user par phone (UPSERT atomique)
 * ⚠️ IMPORTANT: findOneAndUpdate bypass le pre-save bcrypt
 * => on hashe le password avant $setOnInsert pour éviter un password en clair.
 */
async function getOrCreateGuestUserByPhone(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error("PHONE_REQUIRED");

  const email = makeGuestEmail(phone);

  const guestPasswordPlain = randomBytes(24).toString("hex");
  const guestPasswordHashed = await bcrypt.hash(guestPasswordPlain, 10);

  const nowIso = new Date().toISOString();

  const user = await UserModel.findOneAndUpdate(
    { phone },
    {
      $setOnInsert: {
        firstname: "Invité",
        lastname: "IzyGlam",
        phone,
        email,
        password: guestPasswordHashed,
        sex: "female",
        role: "guest",
        active: true,

        credit: 0,
        favoriteShops: [],
        fidelity: { stars: 0, card_expiration: new Date(), rewards_history: [] },

        createdAt: nowIso,
        updatedAt: nowIso,
        lastSeen: nowIso,
      },
      $set: {
        updatedAt: nowIso,
        lastSeen: nowIso,
        // (optionnel) si tu veux garder l'email "guest+..." aligné au tel:
        // email,
      },
    },
    { new: true, upsert: true }
  ).exec();

  if (!user) throw new Error("USER_UPSERT_FAILED");
  return user;
}

export const createAssistantCheckout = async (req: Request, res: Response) => {
  try {
    const { shopId, serviceId, start, end, phoneNumber, address, userProId } = req.body;

    if (!shopId || !serviceId || !start || !end || !phoneNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ message: "Invalid start/end" });
    }

    // 1) Service
    const service: any = await ServiceModel.findById(serviceId).lean();
    if (!service || service.blocked) {
      return res.status(404).json({ message: "Service not found" });
    }

    // 2) Shop + pro
    const shop: any = await ShopModel.findById(shopId).lean();
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const proIdFinal = String(userProId || shop.idUser || "").trim();
    if (!proIdFinal) return res.status(400).json({ message: "Shop missing idUser (pro)" });

    const pro: any = await UserModel.findById(proIdFinal).lean();
    if (!pro) return res.status(404).json({ message: "Pro not found" });

    // 2bis) Client get-or-create
    const phone = normalizePhone(phoneNumber);
    const clientUser: any = await getOrCreateGuestUserByPhone(phone);

    // 3) Pricing simple
    const priceEuro = Number(service.price || 0);
    if (!Number.isFinite(priceEuro) || priceEuro <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    const commissionEuro = 0;
    const serviceFeeEuro = 0;
    const shopEarningsEuro = priceEuro - commissionEuro - serviceFeeEuro;

    // 4) Booking pending
    const booking = await bookingModel.create({
      title: service.name,
      establishmentName: shop.name || "IzyGlam",
      productName: service.name,
      address: address || "Adresse à confirmer",
      phoneNumber: phone,

      // ✅ IMPORTANT: vrai userId (ObjectId string)
      clientId: String(clientUser._id),

      userProId: String(pro._id),
      serviceId: String(service._id),
      shopId: String(shop._id),

      status: "pending",

      price: String(priceEuro),
      serviceFee: String(serviceFeeEuro),
      commission: String(commissionEuro),
      shopEarnings: String(shopEarningsEuro),
      tva: "0",

      date: humanDate(startDate),
      orderDate: new Date(),
      start: startDate,
      end: endDate,

      color: service.color || "#ff4081",
      image: service.image || "",

      generatedCode: generate6DigitCode(),
      proCodeConfirmed: false,

      reviewAdded: false,
      proCommentAdded: false,
      closed: false,
    });

    // ✅ 5) Stripe Customer (fix Accounts V2 testmode)
    const stripeCustomerId = await ensureStripeCustomerForUser(clientUser);

    // ✅ 6) Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      // ✅ IMPORTANT: on passe un customer existant
      customer: stripeCustomerId,

      // ✅ Stripe collect + MAJ automatique du customer
      customer_update: {
        name: "auto",
        address: "auto",
        shipping: "auto",
      },
      billing_address_collection: "auto",

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
      metadata: {
        bookingId: String(booking._id),
        shopId: String(shop._id),
        serviceId: String(service._id),
        proId: String(pro._id),

        // ✅ SUPER IMPORTANT pour le webhook + debugging
        clientId: String(clientUser._id),
        clientPhone: phone,
      },
      success_url: `${process.env.FRONTEND_URL}/paiement-validation?success=true&bookingId=${booking._id}`,
      cancel_url: `${process.env.FRONTEND_URL}/paiement-validation?success=false&bookingId=${booking._id}`,
    });

    if (!session.url) {
      return res.status(500).json({ message: "Stripe session url missing" });
    }

    return res.json({
      bookingId: booking._id,
      checkoutUrl: session.url,
    });
  } catch (err: any) {
    console.error("createAssistantCheckout error:", err);
    return res.status(500).json({ message: "Server error", error: err?.message });
  }
};
