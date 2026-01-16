import * as express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import UserModel from "../models/user";
import ProductModel from "../models/product";
import OrderModel from "../models/order";
import { bigbuyApi } from "../services/bigbuyApi.service";
import { logger } from "../utils/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) || undefined,
});

type CartItemInput = { productId: string; qty: number };

function toCents(amountEuro: number): number {
    return Math.round((Number(amountEuro) || 0) * 100);
}

function safeQty(qty: any): number {
    const n = Number(qty);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(Math.floor(n), 0), 999);
}

function normalizeCountryToBigBuy(country: string): string {
    // BigBuy attend souvent ISO2 (ex: "FR")
    // si tu stockes "France", on force "FR" pour l’instant
    const c = String(country || "").trim().toUpperCase();
    if (c === "FRANCE" || c === "FR") return "fr";
    if (c.length === 2) return c;
    return "FR";
}

function buildBigBuyPayload(items: any[], shippingAddress: any, chosenShipping?: any) {
    const products = items.map((it: any) => ({
        id: it.supplierBigbuyId,
        quantity: it.qty,
    }));

    const carriers = chosenShipping?.carriers || [];

    return {
        order: {
            internalReference: String(new mongoose.Types.ObjectId()), // on remplacera par orderId réel ensuite si besoin
            language: "fr",
            paymentMethod: "wallet",
            carriers,
            shippingAddress: {
                firstName: shippingAddress.firstName,
                lastName: shippingAddress.lastName,
                company: shippingAddress.company || "",
                address: shippingAddress.address1,
                address2: shippingAddress.address2 || "",
                city: shippingAddress.city,
                postalCode: shippingAddress.zipCode,
                country: normalizeCountryToBigBuy(shippingAddress.country),
                phone: shippingAddress.phone,
                email: shippingAddress.email,
            },
            products,
        },
    };
}

/**
 * POST /izyshop/checkout/shipping-options
 * Body: { items: [{productId, qty}], shippingAddress: {...} }
 * Public: pas besoin d'être connecté (checkout invité OK)
 */
export const getShippingOptions = async (req: express.Request, res: express.Response) => {
    // ✅ petit requestId pour suivre facilement
    const requestId = `ship_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const log = (step: string, data?: any) => {
        // évite de log des trucs trop sensibles / énormes
        logger.info({
            requestId,
            step,
            ...(data !== undefined ? { data } : {}),
        });
    };

    try {
        log("START", {
            method: req.method,
            path: req.originalUrl,
            origin: req.headers?.origin,
            referer: req.headers?.referer,
            userAgent: req.headers?.["user-agent"],
        });

        const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
        const shippingAddress: any = req.body?.shippingAddress;

        log("BODY_RECEIVED", {
            itemsCount: items.length,
            itemsPreview: items.slice(0, 5),
            shippingAddressPreview: shippingAddress
                ? {
                    country: shippingAddress.country,
                    zipCode: shippingAddress.zipCode,
                    city: shippingAddress.city,
                }
                : null,
        });

        if (!items.length) {
            log("VALIDATION_FAIL", { reason: "Cart empty" });
            return res.status(400).json({ message: "Cart empty" });
        }
        if (!shippingAddress) {
            log("VALIDATION_FAIL", { reason: "Missing shippingAddress" });
            return res.status(400).json({ message: "Missing shippingAddress" });
        }
        if (!shippingAddress?.country) {
            log("VALIDATION_FAIL", { reason: "Missing shippingAddress.country" });
            return res.status(400).json({ message: "Missing shippingAddress.country" });
        }

        // 1) ids envoyés par le front
        const ids = items.map((i: any) => String(i.productId || "").trim()).filter(Boolean);
        log("IDS_EXTRACTED", { ids, idsCount: ids.length });

        // On ne garde que les ObjectId valides
        const mongoIds = ids.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
        const invalidIds = ids.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));

        log("IDS_VALIDATED", {
            mongoIdsCount: mongoIds.length,
            mongoIds,
            invalidIdsCount: invalidIds.length,
            invalidIds,
        });

        // 2) Charge produits DB (anti-triche)
        log("DB_QUERY_START", { mongoIdsCount: mongoIds.length });

        const products: any[] = await ProductModel.find({ _id: { $in: mongoIds } })
            .select({
                _id: 1,
                title: 1,
                "supplier.bigbuyId": 1,
                "supplier.sku": 1,
                "supplier.ean13": 1,
            })
            .lean();

        log("DB_QUERY_DONE", {
            productsFoundCount: products.length,
            productsPreview: products.slice(0, 5).map((p: any) => ({
                _id: String(p._id),
                title: p.title,
                supplierBigbuyId: p?.supplier?.bigbuyId,
                sku: p?.supplier?.sku,
                ean13: p?.supplier?.ean13,
            })),
        });

        const byMongoId = new Map<string, any>();
        for (const p of products) byMongoId.set(String(p._id), p);

        // Debug : quels ids demandés ne sont PAS trouvés en DB
        const foundIds = new Set(products.map((p: any) => String(p._id)));
        const missingInDb = mongoIds.filter((id: string) => !foundIds.has(id));

        log("DB_MATCHING", {
            requestedMongoIdsCount: mongoIds.length,
            foundMongoIdsCount: foundIds.size,
            missingInDbCount: missingInDb.length,
            missingInDb,
        });

        // 3) Normalisation items
        const normalizedItems = items.map((it: any, idx: number) => {
            const productId = String(it.productId || "").trim();
            const qty = safeQty(it.qty);

            log("ITEM_PROCESSING", { idx, productId, rawQty: it.qty, safeQty: qty });

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return { __missing: true, productId, reason: "Invalid Mongo ObjectId" };
            }

            const p = byMongoId.get(productId);
            if (!p) {
                return { __missing: true, productId, reason: "Not found in DB" };
            }

            if (qty <= 0) {
                return { __missing: true, productId, reason: "Invalid qty" };
            }

            const supplierBigbuyId = Number(p?.supplier?.bigbuyId);
            if (!supplierBigbuyId) {
                return { __missing: true, productId, reason: "Missing supplier.bigbuyId" };
            }

            return {
                __missing: false,
                productId,
                qty,
                supplierBigbuyId,
            };
        });

        log("NORMALIZED_ITEMS_DONE", {
            normalizedItemsCount: normalizedItems.length,
            normalizedItems,
        });

        const missing = normalizedItems.filter((x: any) => x.__missing);
        if (missing.length) {
            log("NORMALIZATION_FAIL", {
                missingCount: missing.length,
                missing,
            });
            return res.status(400).json({
                message: "Some products are invalid or missing in DB",
                details: missing,
            });
        }

        const okItems = normalizedItems as any[];

        // 4) Appel BigBuy
        const countryIsoCode = normalizeCountryToBigBuy(shippingAddress.country);
        log("BIGBUY_CALL_START", {
            countryInput: shippingAddress.country,
            countryIsoCode,
            okItemsCount: okItems.length,
            okItems,
        });

        const allLowestCosts: any[] = await bigbuyApi.getLowestShippingCostsByCountry(countryIsoCode);

        log("BIGBUY_CALL_DONE", {
            responseType: Array.isArray(allLowestCosts) ? "array" : typeof allLowestCosts,
            responseCount: Array.isArray(allLowestCosts) ? allLowestCosts.length : null,
            responsePreview: Array.isArray(allLowestCosts) ? allLowestCosts.slice(0, 10) : allLowestCosts,
        });

        // 5) Filtrage
        const wantedRefs = new Set<string>();
        for (const it of okItems) {
            wantedRefs.add(`S${it.supplierBigbuyId}`);
            wantedRefs.add(String(it.supplierBigbuyId));
        }

        log("FILTER_PREPARED", {
            wantedRefsCount: wantedRefs.size,
            wantedRefsPreview: Array.from(wantedRefs).slice(0, 50),
        });

        const filtered = Array.isArray(allLowestCosts)
            ? allLowestCosts.filter((x: any) => wantedRefs.has(String(x?.reference || "")))
            : [];

        log("FILTER_DONE", {
            filteredCount: filtered.length,
            filteredPreview: filtered.slice(0, 20),
        });

        log("SUCCESS");
        return res.json({ options: filtered });
    } catch (e: any) {
        log("ERROR", {
            message: e?.message,
            stack: e?.stack,
            bigbuyStatus: e?.response?.status,
            bigbuyRaw: e?.response?.data,
        });

        const status = Number(e?.response?.status) || 500;
        return res.status(status).json({
            message: e?.response?.data?.message || e?.message || "Shipping options failed",
            raw: e?.response?.data,
            requestId, // ✅ très utile côté front pour te le donner
        });
    }
};






/**
 * POST /izyshop/checkout/intent
 * Body: { items, shippingAddress, chosenShipping }
 * => crée Order en DB + BigBuy check + Stripe PI
 */
export const createCheckoutIntent = async (req: express.Request, res: express.Response) => {
    const userId = (req as any).user?._id;

    try {
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const items: CartItemInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
        const shippingAddress = req.body?.shippingAddress;
        const chosenShipping = req.body?.chosenShipping; // ce que le client choisit parmi les options BigBuy

        if (!items.length) return res.status(400).json({ message: "Cart empty" });
        if (!shippingAddress) return res.status(400).json({ message: "Missing shippingAddress" });
        if (!chosenShipping) return res.status(400).json({ message: "Missing chosenShipping" });

        // Load user + ensure customerId
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.firstname || ""} ${user.lastname || ""}`.trim() || undefined,
                phone: user.phone || undefined,
                metadata: { userId: String(userId) },
            });

            user.customerId = customer.id;
            await user.save();
        }

        // Load products from DB (anti-triche)
        const ids = items.map(i => i.productId).filter(Boolean);

        const products = await ProductModel.find({ _id: { $in: ids } })
            .select({ _id: 1, title: 1, pricing: 1, supplierBigbuyId: 1, bigbuyId: 1, sku: 1, ean: 1 })
            .lean();

        const map = new Map<string, any>();
        for (const p of products) map.set(String(p._id), p);

        // Build order.items
        let subtotal = 0;

        const orderItems = items.map((it) => {
            const p = map.get(String(it.productId));
            if (!p) throw new Error(`Unknown product: ${it.productId}`);

            const qty = safeQty(it.qty);
            if (qty <= 0) throw new Error(`Invalid qty for product: ${it.productId}`);

            const unitPrice = Number(p?.pricing?.retailPrice || 0);
            if (!unitPrice || unitPrice <= 0) throw new Error(`Invalid price for product: ${it.productId}`);

            const supplierBigbuyId = Number(p.supplierBigbuyId || p.bigbuyId);
            if (!supplierBigbuyId) throw new Error(`Missing supplierBigbuyId for product: ${it.productId}`);

            subtotal += unitPrice * qty;

            return {
                productId: p._id,
                supplierBigbuyId,
                qty,
                unitPrice,
                title: p.title,
                sku: p.sku,
                ean: p.ean,
            };
        });

        // BigBuy CHECK (ce que toi tu vas payer côté BigBuy)
        const bbPayload = {
            order: {
                internalReference: "precheck",
                language: "fr",
                paymentMethod: "wallet",
                carriers: chosenShipping?.carriers || [],
                shippingAddress: {
                    firstName: shippingAddress.firstName,
                    lastName: shippingAddress.lastName,
                    company: shippingAddress.company || "",
                    address: shippingAddress.address1,
                    address2: shippingAddress.address2 || "",
                    city: shippingAddress.city,
                    postalCode: shippingAddress.zipCode,
                    country: normalizeCountryToBigBuy(shippingAddress.country),
                    phone: shippingAddress.phone,
                    email: shippingAddress.email,
                },
                products: orderItems.map((it: any) => ({
                    id: it.supplierBigbuyId,
                    quantity: it.qty,
                })),
            },
        };

        const checkResp = await bigbuyApi.checkOrder(bbPayload);

        // TODO (bientôt): extraire le coût BigBuy total / shipping exact depuis checkResp
        // et appliquer ta marge / règles de pricing.
        // Pour l’instant on part sur : clientPay = subtotal + shippingFeeClient (issu de chosenShipping)
        const shippingFeeClient = Number(chosenShipping?.shippingFee || 0);

        if (!Array.isArray(chosenShipping?.carriers) || chosenShipping.carriers.length === 0) {
            throw new Error("chosenShipping.carriers missing");
        }
        if (!Number.isFinite(shippingFeeClient) || shippingFeeClient < 0) {
            throw new Error("chosenShipping.shippingFee invalid");
        }


        const total = subtotal + shippingFeeClient;
        const amountCents = toCents(total);
        if (amountCents < 50) return res.status(400).json({ message: "Amount too low" });

        // Create Order in DB (PENDING_PAYMENT)
        const order = await OrderModel.create({
            channel: "CLIENT",
            buyerId: userId,
            status: "PENDING_PAYMENT",
            items: orderItems,
            shippingAddress: {
                ...shippingAddress,
                country: normalizeCountryToBigBuy(shippingAddress.country),
            },
            totals: {
                currency: "eur",
                subtotal,
                shippingFee: shippingFeeClient,
                total,
                amountCents,
            },
            stripe: {
                customerId: user.customerId,
            },
            bigbuy: {
                internalReference: "", // on met après quand on a order._id
                language: "fr",
                paymentMethod: "wallet",
                chosenShipping,
                lastCheckAt: new Date(),
                lastCheckRaw: checkResp,
            },
            history: [
                {
                    status: "PENDING_PAYMENT",
                    note: "Order created, waiting payment",
                    at: new Date(),
                },
            ],
        });

        // set internalReference = orderId (après création)
        order.bigbuy.internalReference = String(order._id);
        await order.save();

        // Create PaymentIntent
        const pi = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: "eur",
            customer: user.customerId,
            automatic_payment_methods: { enabled: true },
            metadata: {
                orderId: String(order._id),
                userId: String(userId),
            },
        });

        // store PI id for trace
        order.stripe.paymentIntentId = pi.id;
        order.stripe.paymentIntentStatus = pi.status;
        await order.save();

        return res.json({
            orderId: String(order._id),
            clientSecret: pi.client_secret,
            amountCents,
            totals: order.totals,
        });
    } catch (e: any) {
        logger.error({
            msg: "checkout.intent.failed",
            errorMessage: e?.message,
            stack: e?.stack,
            raw: e?.response?.data,
        });
        return res.status(500).json({ message: e?.message || "Checkout failed" });
    }
};
