import { Request, Response } from "express";
import Stripe from "stripe";
import bookingModel from "../models/booking";
import ServiceModel from "../models/service";
import UserModel from "../models/user";
// Si tu as ShopModel avec name etc, importe-le. Sinon on fait simple.
import ShopModel from "../models/shop";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Garde ta version si tu en as besoin via ENV ; sinon Stripe utilisera la par défaut du compte.
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

function guestClientId(phone: string) {
    return `guest:${phone}`;
}

function humanDate(d: Date) {
    // simple et lisible
    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function generateCode(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

export const createAssistantCheckout = async (req: Request, res: Response) => {
    try {
        const {
            shopId,
            serviceId,
            start,
            end,
            phoneNumber,
            address,
            userProId, // optionnel si tu veux forcer
        } = req.body;

        if (!shopId || !serviceId || !start || !end || !phoneNumber) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Invalid start/end" });
        }

        // 1) Récupérer la prestation
        const service = await ServiceModel.findById(serviceId).lean();
        if (!service || service.blocked) {
            return res.status(404).json({ message: "Service not found" });
        }

        // 2) Shop + pro (si dispo)
        const shop = await ShopModel.findById(shopId).lean();
        if (!shop) return res.status(404).json({ message: "Shop not found" });

        // ✅ grâce à ton schema Shop
        const proIdFinal = (shop as any).idUser; // champ présent dans ton modèle :contentReference[oaicite:2]{index=2}
        if (!proIdFinal) return res.status(400).json({ message: "Shop missing idUser (pro)" });


        const pro = await UserModel.findById(proIdFinal).lean();
        if (!pro) return res.status(404).json({ message: "Pro not found" });

        // 3) Calculs prix (V1 simple)
        // service.price est en euros (number). Booking attend string, donc on stringify.
        const priceEuro = Number(service.price || 0);
        if (!Number.isFinite(priceEuro) || priceEuro <= 0) {
            return res.status(400).json({ message: "Invalid service price" });
        }

        // V1: commission/serviceFee/shopEarnings = tu peux brancher ta logique existante plus tard.
        const commissionEuro = 0; // ou 6% si tu veux direct : Math.round(priceEuro * 0.06 * 100) / 100
        const serviceFeeEuro = 0;
        const shopEarningsEuro = priceEuro - commissionEuro - serviceFeeEuro;

        // 4) Créer booking PENDING (status pending)
        const booking = await bookingModel.create({
            title: service.name,
            establishmentName: (shop as any).name || "IzyGlam",
            productName: service.name,
            address: address || "Adresse à confirmer",
            phoneNumber,

            clientId: guestClientId(phoneNumber),
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

            generatedCode: generateCode(6),
            proCodeConfirmed: false,

            reviewAdded: false,
            closed: false,
        });

        // 5) Checkout Session Stripe
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
            metadata: {
                bookingId: String(booking._id),
                shopId: String(shop._id),
                serviceId: String(service._id),
                proId: String(pro._id),
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
        return res.status(500).json({ message: "Server error" });
    }
};
