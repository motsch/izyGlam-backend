import ShopModel from "../models/shop";
import ServiceTemplateModel from "../models/serviceTemplate";
import ServiceModel from "../models/service";
import * as express from "express";
import { Request, Response } from 'express';
import axios from 'axios';
import path from "path";
import fs from "fs";
import UserModel from "../models/user";
import BookingModel from "../models/booking";
import { getStripe } from "../utils/stripe";
import { sendEmail } from "../utils/mailer";
import {
  renderClientRefundEmailHTML,
  renderAdminBlockRecapEmailHTML,
} from "../utils/emails/refundEmail";

import { logger } from "../utils/logger";
import { resolveLang } from "../utils/lang"; // ajuste le chemin si besoin
<<<<<<< HEAD
=======
import { buildCountryQuery } from '../utils/country';
import { ollamaChat } from "../services/ollamaClient";
import mongoose from "mongoose";
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7

// Étendre l'interface Request pour inclure la propriété 'files'
interface MulterRequest extends Request {
  files: Express.Multer.File[];
}

function normalizeServiceMode(input: any): "SALON" | "DOMICILE" | null {
  const raw = String(input ?? "").toUpperCase().trim();
  if (raw === "SALON") return "SALON";
  if (raw === "DOMICILE") return "DOMICILE";
  return null;
}

function buildServiceModeQuery(mode: any) {
  if (!mode) return null;
  if (mode === "SALON") return { serviceMode: { $in: ["SALON", "BOTH"] } };
  if (mode === "DOMICILE") return { serviceMode: { $in: ["DOMICILE", "BOTH"] } };
  return null;
}

function normalizeCountryCode(x: any, fallback = "FR") {
  const v = String(x || "").trim().toUpperCase();
  if (!v) return fallback;
  // petit check simple: 2 lettres
  return /^[A-Z]{2}$/.test(v) ? v : fallback;
}

function cleanString(x: any, max = 120) {
  const v = String(x ?? "").trim();
  if (!v) return "";
  return v.slice(0, max);
}

function cleanPostalCode(x: any, max = 12) {
  const v = String(x ?? "").trim().toUpperCase();
  if (!v) return "";
  return v.replace(/\s+/g, "").slice(0, max);
}

const getShopsAllCount = async (
  req: express.Request,
  res: express.Response
) => {
  logger.info({ msg: "shops.countAll.start", route: req.originalUrl, method: req.method });
  try {
    const shops = await ShopModel.find();
    const shopsCount = shops.length;
    logger.info({ msg: "shops.countAll.success", count: shopsCount });
    res.status(200).json(shopsCount);
  } catch (error: any) {
    logger.error({
      msg: "shops.countAll.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de récupérer le nombre d'utilisateurs" });
  }
};

const getShopsByIds = async (req: any, res: express.Response) => {
  logger.info({ msg: "shops.byIds.start", route: req.originalUrl, method: req.method });
  try {
    const shopIds = req.body.shopIds;
    console.log("shopIds : " + shopIds);
    const shops = await ShopModel.find({ _id: { $in: shopIds } });
    logger.info({ msg: "shops.byIds.success", returned: shops.length });
    res.json(shops);
  } catch (error: any) {
    logger.error({
      msg: "shops.byIds.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: 'Erreur lors de la récupération des shops favoris' });
  }
};

/**
 * Traitement IA de l'image principale d'un shop
 * - AUCUN upload depuis le front : on part de l'image déjà stockée
 * - req.body.shopId : obligatoire
 */
const processShopImage = async (req: any, res: express.Response) => {
  try {
    // 1) On récupère l'id du shop (body ou query, au choix)
    const shopId = req.body.shopId || req.query.shopId;

    if (!shopId) {
      return res.status(400).json({ message: 'shopId is required' });
    }

    // 2) On va chercher le shop en base
    const shop = await ShopModel.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    if (!shop.image) {
      return res.status(400).json({ message: 'Shop has no image to process' });
    }

    // 3) On reconstruit le chemin physique vers l’image existante
    //    En base tu stockes soit "profile18.png", soit "uploads/images/xxx.png"
    let storedPath: string = shop.image;
    storedPath = storedPath.replace(/^\/+/, ''); // enlève les "/" de début

    if (!storedPath.startsWith('uploads/')) {
      // Si tu ne stockes que "profile18.png"
      storedPath = `uploads/images/${storedPath}`;
    }

    const filePath = path.join(process.cwd(), storedPath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Image file not found on server' });
    }

    // 4) Lecture de l'image locale
    const imageBuffer: Buffer = fs.readFileSync(filePath);

    // 5) Construction du form-data pour OpenAI (version Node, pas DOM)
    const FormData = require('form-data');
    const formData: any = new FormData();

    formData.append('model', 'gpt-image-1');
    formData.append(
      'image',
      imageBuffer as any, // Buffer -> any pour éviter l’erreur de type "Blob"
      {
        filename: path.basename(filePath),
        contentType: 'image/png',
      }
    );

    // Prompt : harmonisation visuelle, fond gris clair, t-shirt blanc, même visage
    formData.append(
      'prompt',
      [
        // 1) Identité : miroir de la photo d'origine
        'Use the original input photo as a strict identity reference.',
        'The person in the edited image must look exactly like the person in the original photo, as if it were a perfect mirror.',
        'Do not change the person’s age, ethnicity, gender, head shape or facial proportions.',
        'Do not change the distance between the eyes, the size or shape of the nose, the lips, the jawline, the ears, or the forehead.',
        'Do not modify or remove any distinctive marks such as freckles, moles, scars or skin texture.',
        'Absolutely no beauty filters: do not smooth the skin, do not reduce pores, do not erase wrinkles, do not change skin tone or facial structure.',

        // 2) Vêtements + fond
        'Replace the clothing with a plain white t-shirt with a simple round collar, no logo, no text, no pattern.',
        'Use a very light grey studio background, uniform and clean, with no objects or textures.',

        // 3) Cadrage + format
        'Generate a perfectly square image (1:1 aspect ratio).',
        'Center the person in the frame.',
        'The head, neck, shoulders and upper torso must be fully visible, and the crop must go down clearly below the chest level (do not crop above the chest).',

        // 4) Style photo
        'Use soft, natural studio lighting, with realistic photographic rendering, no illustration style.',
        'Enhance image quality (sharpness, contrast, colors) but without altering the person’s identity or facial details.',
        'All portraits on the platform must look consistent: same lighting, same light grey background, same white t-shirt style.'
      ].join(' ')
    );



    let improvedImageBuffer: Buffer | null = null;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...(formData as any).getHeaders(), // getHeaders() existe sur form-data (node)
          },
          responseType: 'json',
        }
      );

      const base64: string = response.data.data[0].b64_json;
      improvedImageBuffer = Buffer.from(base64, 'base64');

      // 6) On écrase l'image d'origine par la version IA
      fs.writeFileSync(filePath, improvedImageBuffer);
    } catch (err) {
      const e: any = err;
      console.error(
        'Erreur OpenAI image :',
        e?.response?.data || e?.message
      );
      // En cas d’erreur on garde l’image originale
      improvedImageBuffer = imageBuffer;
    }

    // 7) On renvoie le shop et le nom de l'image (inchangé)
    return res.json({
      success: true,
      message: 'Image processed successfully',
      image: shop.image,
      shop,
    });
  } catch (err) {
    console.error('Erreur processShopImage :', err);
    return res.status(500).json({ message: 'Error processing image' });
  }
};

// Créer une nouvelle boutique (shop)
const createShop = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.create.start", route: req.originalUrl, method: req.method, bodyKeys: Object.keys(req.body || {}) });

  try {
    const body = req.body || {};

    // ✅ handle demandé ou auto depuis name
    const requestedHandle = body.handle ? normalizeHandle(body.handle) : "";
    const base = requestedHandle || body.name || "shop";

    const uniqueHandle = await generateUniqueHandle(base);

    body.handle = uniqueHandle;

    const newShop = new ShopModel(body);
    await newShop.save();

    // ... le reste inchangé (templates/services)


    let templates = await ServiceTemplateModel.find({ type: newShop.type, active: true });
    if (templates.length === 0) {
      console.log("Aucun template du type trouvé, fallback vers des templates actifs génériques");
      templates = await ServiceTemplateModel.find({ active: true });
    }

    const servicesToCreate = templates.map((template) => {
      return new ServiceModel({
        name: template.name,
        description: template.description,
        image: template.image,
        type: template.type,
        price: template.price,
        duration: template.duration,
        color: template.color || "#ff4081",
        shopId: newShop._id,
      });
    });

    const createdServices = await ServiceModel.insertMany(servicesToCreate);

    logger.info({
      msg: "shop.create.success",
      shopId: newShop._id?.toString(),
      servicesCreated: createdServices.length
    });

    res.status(201).json({
      shop: newShop,
      services: createdServices,
    });
  } catch (error: any) {
    console.error("Erreur dans createShop :", error);
    logger.error({
      msg: "shop.create.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de créer la boutique et ses services." });
  }
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


export const getIzyGlamProductDescription = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.productDescription.start", route: req.originalUrl, method: req.method });

  try {
    const lang = resolveLang(req);
    console.log("IN PRODUCT DESCRIPTION IZYGLAM", { lang });

    const { product } = req.body;

    if (!product?.type) {
      return res.status(400).json({ message: "Le type de salon est requis." });
    }
    if (!product?._id) {
      return res.status(400).json({ message: "L'ID du produit est requis." });
    }

    const baseInstruction =
      `You are a senior beauty copywriter for a home-services marketplace.
Always write the FINAL answer in the target language given by 'lang' = ${lang}.
If inputs are in other languages, TRANSLATE and LOCALIZE to ${lang}.
Output: ONE single sentence, human, professional, engaging, sales-oriented, no emojis, no weird symbols, no quotes.
Hard limit: 15 words. No list, no preface, no explanations.
The salon is always run by a single practitioner, never a team.`;

    const userPrompt = product.description
      ? `Service name: "${product.name}".
Current description: "${product.description}".
Rewrite if viable; otherwise create from scratch.`
      : `Create from scratch a compelling description for service name: "${product.name}".`;

    let formattedDescription = await ollamaChat({
      system: baseInstruction,
      user: userPrompt,
      temperature: 0.8,
      timeoutMs: 120_000,
    });

    const newProduct = await ServiceModel.findById(product._id);
    if (!newProduct) {
      return res.status(404).json({ message: "Produit introuvable." });
    }

    newProduct.description = formattedDescription;
    await newProduct.save();

    logger.info({ msg: "shop.productDescription.success", productId: product._id, lang });
    res.status(200).json(newProduct);
  } catch (error: any) {
    console.error("Erreur dans getIzyGlamProductDescription :", error?.response?.data || error);
    logger.error({
      msg: "shop.productDescription.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de générer la description." });
  }
};

export const getIzyGlamDescription = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.description.start", route: req.originalUrl, method: req.method });

  try {
    const lang = resolveLang(req);
    console.log("IN DESCRIPTION IZYGLAM", { lang });

    const { description, type } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Le type de salon est requis." });
    }

    const baseInstruction =
      `You are a senior beauty copywriter for a home-services marketplace.
Always write the FINAL answer in the target language given by 'lang' = ${lang}.
Write in FIRST-PERSON SINGULAR appropriate for ${lang} ("I" / "je" / etc.).
If inputs are in other languages, TRANSLATE and LOCALIZE to ${lang}.
Tone: human, professional, warm, selling without sounding pushy.
Output: ONE paragraph, plain text, no emojis, no weird symbols, no quotes.
Hard limit: 40 words. No list, no preface, no explanations.
The salon is operated by a single practitioner (not a team).`;

    const userPrompt = description
      ? `Salon type: "${type}".
Existing description: "${description}".
If viable, rewrite; otherwise create from scratch.`
      : `Create from scratch a compelling first-person description for a salon of type: "${type}".`;

    const formattedDescription = await ollamaChat({
      system: baseInstruction,
      user: userPrompt,
      temperature: 0.8,
      timeoutMs: 120_000,
    });

    logger.info({ msg: "shop.description.success", type, lang });
    res.status(200).json({ formattedDescription });
  } catch (error: any) {
    console.error("Erreur dans getIzyGlamDescription :", error?.response?.data || error);
    logger.error({
      msg: "shop.description.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de générer la description." });
  }
};

/**
 * Remplace l'image d'un Service par une image générée via OpenAI.
 */
export const uploadServiceImageAI = async (req: Request, res: Response) => {
  logger.info({ msg: "shop.imageAI.start", route: req.originalUrl, method: req.method });
  try {
    const { product, size } = req.body || {};
    const id = product?._id;

    if (!id) return res.status(400).json({ message: "Paramètre id manquant." });
    if (!product?.type) return res.status(400).json({ message: "product.type est requis." });
    if (!OPENAI_API_KEY) return res.status(500).json({ message: "OPENAI_API_KEY manquant." });

    const service = await ServiceModel.findById(id);
    if (!service) return res.status(404).json({ message: "Service non trouvé." });

    const clientGender = "femme";

    const prompt = `
Tu es un·e directeur·ice artistique. Crée une photo ultra réaliste et professionnelle pour représenter ce service de beauté à domicile, dans le style des visuels produits d'Uber Eats (présentation irrésistible, mise en avant claire du sujet, éclairage parfait, réalisme maximal).
Produit: ${product.name}.
Style: photo haute définition, éclairage naturel et harmonieux, ambiance chaleureuse et premium, couleurs fidèles, mise en scène soignée.
La scène montre un professionnel en train de réaliser la prestation sur un·e client·e ${clientGender}, dans un intérieur cosy et lumineux.
Une attention particulière doit être portée à la position et au réalisme des bras et des mains, avec une interaction naturelle et précise entre le professionnel et le/la client·e (aucune distorsion ou doigts supplémentaires).
Sujet: "${product.type}" à domicile.
${product.description ? `Description du produit: ${product.description}` : ""}`.trim();

    const allowedSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    const finalSize = allowedSizes.includes(size) ? size : "1536x1024";

    let aiResp;
    try {
      aiResp = await axios.post(
        "https://api.openai.com/v1/images/generations",
        { model: "gpt-image-1", prompt, n: 1, size: finalSize },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 180000,
        }
      );
    } catch (e: any) {
      console.error("OpenAI images error:", e?.response?.status, e?.response?.data || e?.message);
      logger.error({
        msg: "shop.imageAI.openai_error",
        status: e?.response?.status,
        data: e?.response?.data,
      });
      const status = e?.response?.status || 502;
      const msg = e?.response?.data?.error?.message || e?.message || "Erreur OpenAI Images";
      return res.status(status).json({ message: msg });
    }

    const item = aiResp?.data?.data?.[0];
    if (!item) {
      console.error("OpenAI images payload inattendu:", JSON.stringify(aiResp?.data, null, 2));
      logger.error({ msg: "shop.imageAI.payload_invalid" });
      return res.status(502).json({ message: "Payload image invalide (data[0] manquant)." });
    }

    const dir = path.resolve(process.cwd(), "uploads", "images", "articles");
    await fs.promises.mkdir(dir, { recursive: true });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const absPath = path.join(dir, filename);

    if (item.b64_json) {
      const buffer = Buffer.from(item.b64_json, "base64");
      await fs.promises.writeFile(absPath, buffer);
    } else if (item.url) {
      const imgResp = await axios.get(item.url, { responseType: "arraybuffer" });
      await fs.promises.writeFile(absPath, imgResp.data);
    } else {
      console.error("Ni b64_json ni url dans la réponse:", JSON.stringify(item, null, 2));
      logger.error({ msg: "shop.imageAI.no_image_field" });
      return res.status(502).json({ message: "OpenAI n'a pas retourné d'image (ni b64 ni url)." });
    }

    const publicPath = `/uploads/images/articles/${filename}`;

    if (service.image?.startsWith("/uploads/images/articles/")) {
      try {
        const oldAbs = path.resolve(process.cwd(), service.image.slice(1));
        await fs.promises.unlink(oldAbs);
      } catch { /* ignore */ }
    }

    service.image = publicPath;
    await service.save();

    logger.info({ msg: "shop.imageAI.success", serviceId: service._id?.toString(), path: publicPath });

    return res.status(200).json({
      message: "Image générée et mise à jour avec succès",
      image: publicPath,
      service
    });

  } catch (error: any) {
    console.error("Erreur uploadServiceImageAI :", error?.response?.data || error);
    logger.error({
      msg: "shop.imageAI.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({
      message: "Erreur génération image",
      error: error?.message || "unknown",
    });
  }
};

// Récupérer toutes les boutiques
const getAllShops = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shops.list.start", route: req.originalUrl, method: req.method });
  try {
    const mode = normalizeServiceMode((req.query as any)?.mode);
    const modeQuery = buildServiceModeQuery(mode);

    const query: any = {
      active: true,
      $and: [
        {
          $or: [{ flags: { $exists: false } }, { flags: { $size: 0 } }],
        },
        {
          $or: [{ status: { $exists: false } }, { status: { $ne: "needs_manual_review" } }],
        },
      ],
    };

    if (modeQuery) Object.assign(query, modeQuery);

    const shops = await ShopModel.find(query);

    logger.info({ msg: "shops.list.success", count: shops.length, mode: mode || "ALL" });
    res.json(shops);
  } catch (error: any) {
    logger.error({
      msg: "shops.list.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de récupérer les boutiques" });
  }
};


// Récupérer toutes les boutiques
const getAllShopsAdmin = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shops.list.start", route: req.originalUrl, method: req.method });
  try {
    const shops = await ShopModel.find();
    logger.info({ msg: "shops.list.success", count: shops.length });
    res.json(shops);
  } catch (error: any) {
    logger.error({
      msg: "shops.list.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de récupérer les boutiques" });
  }
};

// Fonction de calcul de distance
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = radLat2 - radLat1;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) *
    Math.cos(radLat2) *
    Math.sin(deltaLon / 2) *
    Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getShopsNearby = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shops.nearby.start", route: req.originalUrl, method: req.method, query: req.query });
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ message: "Les coordonnées 'lat' et 'lon' sont requises" });
  }
  try {
    const clientLatitude = parseFloat(lat as string);
    const clientLongitude = parseFloat(lon as string);

    const mode = normalizeServiceMode((req.query as any)?.mode);
    const modeQuery = buildServiceModeQuery(mode);

    const baseQuery: any = {};
    if (modeQuery) Object.assign(baseQuery, modeQuery);

    const shops = await ShopModel.find(baseQuery);


    const shopsNearby = shops.filter((shop: any) => {
      if (
        !shop.location ||
        shop.location.latitude === undefined ||
        shop.location.longitude === undefined
      ) {
        return false;
      }
      const distance = calculateDistance(
        clientLatitude,
        clientLongitude,
        shop.location.latitude,
        shop.location.longitude
      );
      return distance <= shop.maxDistance;
    });

    logger.info({ msg: "shops.nearby.success", returned: shopsNearby.length });
    res.json(shopsNearby);
  } catch (error: any) {
    logger.error({
      msg: "shops.nearby.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la récupération des boutiques à proximité" });
  }
};

const getShopsByPostalCodes = async (req: Request, res: Response) => {
  logger.info({ msg: "shops.byPostalCodes.start", route: req.originalUrl, method: req.method, query: req.query });
  try {
    const { codes } = req.query;
    let postalCodes: string[] = [];

    if (!codes) {
      return res.status(400).json({ message: "Les codes postaux sont requis" });
    }

    if (typeof codes === "string") {
      postalCodes = codes.split(",").map((code) => code.trim());
    } else if (Array.isArray(codes)) {
      postalCodes = codes.map((code) => String(code).trim());
    }

    const shops = await ShopModel.find();

    const shopsByPostalCodes = shops.filter((shop) => {
      if (!shop.deliveryPostalCodes || !Array.isArray(shop.deliveryPostalCodes)) {
        return false;
      }
      return shop.deliveryPostalCodes.some((deliveryCode: string) =>
        postalCodes.includes(deliveryCode)
      );
    });

    logger.info({ msg: "shops.byPostalCodes.success", postalCount: postalCodes.length, returned: shopsByPostalCodes.length });
    res.json(shopsByPostalCodes);
  } catch (error: any) {
    logger.error({
      msg: "shops.byPostalCodes.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des boutiques par codes postaux" });
  }
};

<<<<<<< HEAD
const getShopsByPostalCodesWithCategories = async (req: Request, res: Response) => {
  logger.info({ msg: "shops.byPostalCodesWithCategories.start", route: req.originalUrl, method: req.method, query: req.query });
  try {
    const { codes } = req.query;
    let postalCodes: string[] = [];
=======
function getFinishedStats(shop: any) {
  const finished = shop?.stats?.bookings?.finished;
  return {
    last24h: Number(finished?.last24h ?? 0),
    week: Number(finished?.week ?? 0),
    month: Number(finished?.month ?? 0),
    total: Number(finished?.total ?? 0),
  };
}

function computePerformanceScore(shop: any) {
  const s = getFinishedStats(shop);

  // Qualité : note (0..5). Si pas de note -> 0
  const note = Number(shop?.note ?? 0);

  // Ex: score orienté "momentum" (recent > ancien)
  // Ajuste les poids comme tu veux
  const score =
    s.last24h * 6 +     // boost fort : récent
    s.week * 3 +        // semaine : très important
    s.month * 1.2 +     // mois : important mais moins
    s.total * 0.15 +    // total : faible pour éviter "anciens only"
    note * 2;           // qualité : bonus

  return score;
}

export const getShopsByPostalCodesWithCategories = async (req: Request, res: Response) => {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const log = (step: string, data?: any) => {
    logger.info({
      requestId,
      step,
      route: req.originalUrl,
      method: req.method,
      ...(data !== undefined ? { data } : {}),
    });
  };

  // ✅ helper : priorité premium puis fallback non-premium
  const pickWithPremiumFirst = (items: any[], limit: number) => {
    const premium = items.filter((s) => !!s.isPremium);
    const normal = items.filter((s) => !s.isPremium);

    if (premium.length >= limit) return premium.slice(0, limit);
    return [...premium, ...normal.slice(0, limit - premium.length)];
  };

  try {
    log("START", {
      query: req.query,
      params: req.params,
      ip: (req as any).ip,
    });

    // 0) mode
    const rawMode = (req.query as any)?.mode;
    const mode = normalizeServiceMode(rawMode); // "SALON" | "DOMICILE"
    log("STEP_0_MODE_PARSED", { rawMode, mode });

    if (!mode) {
      log("EARLY_RETURN_MODE_MISSING", { rawMode, mode });
      return res.status(400).json({ message: "Mode requis (SALON ou DOMICILE)" });
    }

    // 1) codes + country
    const { codes, country } = req.query;
    log("STEP_1_QUERY_INPUTS", { codes, country, mode });
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7

    if (!codes) {
      log("EARLY_RETURN_CODES_MISSING", { codes });
      return res.status(400).json({ message: "Les codes postaux sont requis" });
    }

<<<<<<< HEAD
    if (typeof codes === "string") {
      postalCodes = codes.split(",").map((c) => c.trim());
    } else if (Array.isArray(codes)) {
      postalCodes = codes.map((c) => String(c).trim());
    }

    const shops = await ShopModel.find({
      deliveryPostalCodes: { $in: postalCodes },
=======
    // 2) parse postal codes
    const postalCodes = pickPostalCodes(codes);
    log("STEP_2_POSTAL_CODES_PARSED", {
      codesRaw: codes,
      postalCodes,
      count: postalCodes?.length ?? 0,
    });

    if (!postalCodes.length) {
      log("EARLY_RETURN_NO_POSTAL_CODES", { codesRaw: codes });
      return res.json({ all: [], discover: [], appreciated: [], smart: [], top10: [] });
    }

    const countryQuery = buildCountryQuery(country);
    log("STEP_3_COUNTRY_QUERY", { country, countryQuery });

    // 3) zoneQuery
    let zoneQuery: any;
    if (mode === "SALON") {
      zoneQuery = {
        serviceMode: { $in: ["SALON", null] },
        deliveryPostalCodes: { $in: postalCodes },
      };
      log("STEP_4_ZONE_QUERY_SALON", { zoneQuery });
    } else {
      zoneQuery = {
        serviceMode: { $in: ["DOMICILE", null] },
        deliveryPostalCodes: { $in: postalCodes },
      };
      log("STEP_4_ZONE_QUERY_DOMICILE", { zoneQuery });
    }

    // 4) query principale
    const shopQuery: any = {
      ...zoneQuery,
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
      active: true,
      status: "approved",
    }).lean();

<<<<<<< HEAD
    const shopsByPostalCodes = shops.filter((shop) => {
      if (!shop.deliveryPostalCodes || !Array.isArray(shop.deliveryPostalCodes)) {
        return false;
      }
      return shop.deliveryPostalCodes.some((deliveryCode: string) =>
        postalCodes.includes(deliveryCode)
      );
    });

    const shopIds = shops.map((s) => s._id.toString());

    const servicesAgg = await ServiceModel.aggregate([
      { $match: { shopId: { $in: shopIds } } },
      {
        $group: {
          _id: "$shopId",
          avgPrice: { $avg: "$price" },
        },
      },
    ]);

    const avgPriceByShop: Record<string, number> = {};
    servicesAgg.forEach((s) => {
      avgPriceByShop[s._id] = s.avgPrice;
=======
    log("STEP_5_SHOP_QUERY_FINAL", {
      shopQuery,
      postalCodesCount: postalCodes.length,
    });

    // 5) find shops
    log("STEP_6_BEFORE_SHOP_FIND");
    const shops = await ShopModel.find(shopQuery).lean();
    log("STEP_7_AFTER_SHOP_FIND", { shopsCount: shops.length });

    log("STEP_7B_SHOPS_SAMPLE", {
      sample: shops.slice(0, 3).map((s: any) => ({
        _id: String(s._id),
        name: s.name,
        serviceMode: s.serviceMode,
        active: s.active,
        status: s.status,
        placePostal: s?.placeAddress?.postalCode,
        legalPostal: s?.legal?.postalCode,
        deliveryPostalCodes: s?.deliveryPostalCodes,
      })),
    });

    if (!shops.length) {
      log("EARLY_RETURN_NO_SHOPS", { shopQuery });
      return res.json({ all: [], discover: [], appreciated: [], smart: [], top10: [] });
    }

    // 6) performance calc
    log("STEP_8_BEFORE_PERFORMANCE_MAP", { shopsCount: shops.length });

    const shopsWithPerformance = shops.map((shop: any) => {
      const finished = shop?.stats?.bookings?.finished;

      const finishedStats = {
        last24h: toNumber(finished?.last24h, 0),
        week: toNumber(finished?.week, 0),
        month: toNumber(finished?.month, 0),
        total: toNumber(finished?.total, 0),
      };

      const note = toNumber(shop?.note, 0);

      const performanceScore =
        finishedStats.last24h * 6 +
        finishedStats.week * 3 +
        finishedStats.month * 1.2 +
        finishedStats.total * 0.15 +
        note * 2;

      return {
        ...shop,
        stats: {
          ...(shop.stats ?? {}),
          bookings: {
            ...(shop.stats?.bookings ?? {}),
            finished: finishedStats,
          },
        },
        performanceScore,
      };
    });

    log("STEP_9_AFTER_PERFORMANCE_MAP", {
      count: shopsWithPerformance.length,
      sample: shopsWithPerformance.slice(0, 3).map((s: any) => ({
        _id: String(s._id),
        performanceScore: s.performanceScore,
        note: s.note,
        finished: s?.stats?.bookings?.finished,
      })),
    });

    // 7) avg price aggregation
    const shopIdsStr = shopsWithPerformance.map((s: any) => String(s._id));
    const shopIdsObj = asObjectIdArray(shopIdsStr);

    log("STEP_10_SHOP_IDS_PREPARED", {
      shopIdsStrCount: shopIdsStr.length,
      shopIdsObjCount: shopIdsObj.length,
      sampleIds: shopIdsStr.slice(0, 5),
    });

    let servicesAgg: Array<{ _id: any; avgPrice: number }> = [];

    if (shopIdsObj.length) {
      log("STEP_11_BEFORE_AGG_OBJECTID", { matchCount: shopIdsObj.length });
      try {
        servicesAgg = await ServiceModel.aggregate([
          { $match: { shopId: { $in: shopIdsObj } } },
          { $group: { _id: "$shopId", avgPrice: { $avg: "$price" } } },
        ]);
        log("STEP_12_AFTER_AGG_OBJECTID", { servicesAggCount: servicesAgg.length });
      } catch (e: any) {
        log("ERROR_AGG_OBJECTID", { message: e?.message, stack: e?.stack });
      }
    }

    if (!servicesAgg.length) {
      log("STEP_13_BEFORE_AGG_STRING_FALLBACK", { matchCount: shopIdsStr.length });
      try {
        servicesAgg = await ServiceModel.aggregate([
          { $match: { shopId: { $in: shopIdsStr } } },
          { $group: { _id: "$shopId", avgPrice: { $avg: "$price" } } },
        ]);
        log("STEP_14_AFTER_AGG_STRING_FALLBACK", { servicesAggCount: servicesAgg.length });
      } catch (e: any) {
        log("ERROR_AGG_STRING_FALLBACK", { message: e?.message, stack: e?.stack });
      }
    }

    const avgPriceByShop: Record<string, number> = {};
    servicesAgg.forEach((s: any) => {
      avgPriceByShop[String(s._id)] = toNumber(s.avgPrice, Infinity);
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
    });

    log("STEP_15_AVG_PRICE_MAP_READY", {
      keysCount: Object.keys(avgPriceByShop).length,
      sample: Object.entries(avgPriceByShop).slice(0, 5),
    });

    // ✅ 7B) PREMIUM SHOPS detection (users active + assistantShopId in current shops)
    log("STEP_15B_PREMIUM_LOOKUP_START", { shopIdsObjCount: shopIdsObj.length });

    const premiumUsers = await UserModel.find({
      "subscription.status": "active",
      assistantShopId: { $in: shopIdsObj }, // assistantShopId est un ObjectId de shop
    })
      .select({ assistantShopId: 1 })
      .lean();

    const premiumShopIdSet = new Set<string>(premiumUsers.map((u: any) => String(u.assistantShopId)));
    log("STEP_15C_PREMIUM_LOOKUP_DONE", {
      premiumUsersCount: premiumUsers.length,
      premiumShopsCount: premiumShopIdSet.size,
      samplePremiumShopIds: Array.from(premiumShopIdSet).slice(0, 10),
    });

    const enrichedShops = shopsWithPerformance.map((shop: any) => ({
      ...shop,
      avgPrice: avgPriceByShop[String(shop._id)] ?? Infinity,
      isPremium: premiumShopIdSet.has(String(shop._id)), // ✅ flag simple
    }));

    log("STEP_16_ENRICHED_SHOPS_READY", {
      count: enrichedShops.length,
      sample: enrichedShops.slice(0, 3).map((s: any) => ({
        _id: String(s._id),
        avgPrice: s.avgPrice,
        performanceScore: s.performanceScore,
        note: s.note,
        isPremium: !!s.isPremium,
      })),
    });

    // 8) categories (avec priorité premium)
    log("STEP_17_BEFORE_SORTS");

    // Tri perf (base)
    const sortedByPerf = [...enrichedShops].sort(
      (a, b) => toNumber(b.performanceScore, 0) - toNumber(a.performanceScore, 0)
    );

    log("STEP_18_AFTER_SORT_BY_PERF", {
      top: sortedByPerf.slice(0, 5).map((s: any) => ({
        _id: String(s._id),
        perf: s.performanceScore,
        note: s.note,
        avgPrice: s.avgPrice,
        isPremium: !!s.isPremium,
      })),
    });

    // ⭐ discover : on garde l’idée "top50 perf + shuffle", mais premium first
    const discoverBase = shuffle(sortedByPerf.slice(0, 50));
    const discover = pickWithPremiumFirst(discoverBase, 15);

    // ⭐ appreciated : tri note puis perf, puis premium first
    const appreciatedSorted = [...enrichedShops].sort((a, b) => {
      const na = toNumber(a.note, 0);
      const nb = toNumber(b.note, 0);
      if (nb !== na) return nb - na;
      return toNumber(b.performanceScore, 0) - toNumber(a.performanceScore, 0);
    });
    const appreciated = pickWithPremiumFirst(appreciatedSorted, 15);

    // ⭐ smart : tri prix puis perf, puis premium first
    const smartSorted = [...enrichedShops].sort((a, b) => {
      const pa = toNumber(a.avgPrice, Infinity);
      const pb = toNumber(b.avgPrice, Infinity);
      if (pa !== pb) return pa - pb;
      return toNumber(b.performanceScore, 0) - toNumber(a.performanceScore, 0);
    });
    const smart = pickWithPremiumFirst(smartSorted, 15);

    // ⭐ top10 : perf, mais premium first
    const top10 = pickWithPremiumFirst(sortedByPerf, 10);

    const categories = {
<<<<<<< HEAD
      "all": shopsByPostalCodes,
      "discover": shuffle(enrichedShops).slice(0, 15),
      "appreciated": [...enrichedShops]
        .sort((a, b) => Number(b.note) - Number(a.note))
        .slice(0, 15),
      "smart": [...enrichedShops]
        .sort((a, b) => a.avgPrice - b.avgPrice)
        .slice(0, 15),
      "top10": [...enrichedShops]
        .sort((a, b) => b.clics - a.clics)
        .slice(0, 15),
    };

    logger.info({
      msg: "shops.byPostalCodesWithCategories.success",
      postalCount: postalCodes.length,
=======
      all: enrichedShops, // (on laisse tel quel, tu peux aussi le trier premium-first si tu veux)
      discover,
      appreciated,
      smart,
      top10,
    };

    log("STEP_19_CATEGORIES_READY", {
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
      counts: {
        all: categories.all.length,
        discover: categories.discover.length,
        appreciated: categories.appreciated.length,
        smart: categories.smart.length,
<<<<<<< HEAD
        top10: categories.top10.length
      }
    });

    res.json(categories);
=======
        top10: categories.top10.length,
      },
      premiumCounts: {
        discover: categories.discover.filter((s: any) => !!s.isPremium).length,
        appreciated: categories.appreciated.filter((s: any) => !!s.isPremium).length,
        smart: categories.smart.filter((s: any) => !!s.isPremium).length,
        top10: categories.top10.filter((s: any) => !!s.isPremium).length,
      },
    });

    log("END_SUCCESS");
    return res.json(categories);
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
  } catch (error: any) {
    console.error("Erreur getShopsByPostalCodesWithCategories:", error);
    logger.error({
      requestId,
      msg: "shops.byPostalCodesWithCategories.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
      query: req.query,
    });
    res.status(500).json({ message: "Erreur serveur" });
  }
};


// Petit helper
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const pickPostalCodes = (codes: any): string[] => {
  let postalCodes: string[] = [];
  if (typeof codes === "string") {
    postalCodes = codes
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  } else if (Array.isArray(codes)) {
    postalCodes = codes.map((c) => String(c).trim()).filter(Boolean);
  }
  return postalCodes;
};

const asObjectIdArray = (ids: string[]): mongoose.Types.ObjectId[] => {
  const out: mongoose.Types.ObjectId[] = [];
  for (const id of ids) {
    if (mongoose.Types.ObjectId.isValid(id)) out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
};

// Récupérer une boutique par son ID
const getShopById = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.get.start", route: req.originalUrl, method: req.method, params: req.params });

  try {
    const { id } = req.params;

    // ✅ Stop immédiatement si id absent / invalide
    if (!id || id === "undefined" || !mongoose.isValidObjectId(id)) {
      logger.warn({ msg: "shop.get.invalid_id", id, route: req.originalUrl });
      return res.status(400).json({ message: "Shop id invalide" });
    }

    const shop = await ShopModel.findById(id);
    if (!shop) {
      logger.warn({ msg: "shop.get.not_found", id });
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    let twilioPhoneNumber: string | null = null;

    if (shop.isPremium === true) {
      const userId = String(shop.idUser || "").trim();
      if (mongoose.isValidObjectId(userId)) {
        const user: any = await UserModel.findById(userId).select({ twilioPhoneNumber: 1 }).lean();
        twilioPhoneNumber = user?.twilioPhoneNumber ? String(user.twilioPhoneNumber) : null;
      }
    }

    return res.json({
      ...shop.toObject(), // ✅ important
      twilioPhoneNumber,
    });

  } catch (error: any) {
    logger.error({
      msg: "shop.get.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Impossible de récupérer la boutique" });
  }
};

// Mettre à jour une boutique par son ID
const updateShopById = async (req: express.Request, res: express.Response) => {
  logger.info({
    msg: "shop.update.start",
    route: req.originalUrl,
    method: req.method,
    params: req.params,
    bodyKeys: Object.keys(req.body || {}),
  });

  try {
    const { id } = req.params;

    // 1) On récupère le shop existant (utile pour validation "final state")
    const existingShop = await ShopModel.findById(id).select("serviceMode placeAddress");
    if (!existingShop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    // 2) ✅ Whitelist : on filtre strictement ce qu'on accepte en update (anti open-bar)
    const raw: any = { ...(req.body || {}) };

    const allowedFields = new Set([
      "name",
      "type",
      "description",
      "image",
      "galleryImages",
      "hours",
      "location",
      "maxDistance",
      "deliveryPostalCodes",
      "minimumDelay",
      "promo",
      "trad",

      // ✅ handle
      "handle",

      // ✅ adresse salon / mode
      "serviceMode",
      "placeAddress",
    ]);

    const payload: any = {};
    for (const key of Object.keys(raw)) {
      if (allowedFields.has(key)) payload[key] = raw[key];
    }

    // 3) ✅ handle : normalise + rend unique si collision
    if (payload.handle !== undefined) {
      const normalized = normalizeHandle(payload.handle);

      if (!normalized) {
        return res.status(400).json({ message: "Handle invalide." });
      }

      // si le handle est déjà pris par un autre shop -> suffixe auto
      payload.handle = await generateUniqueHandle(normalized, id);
    }

    // 4) ✅ serviceMode : normalise et valide
    if (payload.serviceMode !== undefined) {
      const mode = normalizeServiceMode(payload.serviceMode); // "SALON" | "DOMICILE" | ""
      if (!mode) {
        return res.status(400).json({ message: "serviceMode invalide (SALON ou DOMICILE)" });
      }
      payload.serviceMode = mode;
    }

    // 5) ✅ placeAddress : nettoyage + normalisation
    if (payload.placeAddress !== undefined) {
      const a = payload.placeAddress || {};

      payload.placeAddress = {
        label: cleanString(a.label, 180) || undefined,
        addressLine1: cleanString(a.addressLine1, 120) || undefined,
        addressLine2: cleanString(a.addressLine2, 120) || undefined,
        postalCode: cleanPostalCode(a.postalCode, 12) || undefined,
        city: cleanString(a.city, 80) || undefined,
        country: normalizeCountryCode(a.country, "FR"),
      };
    }

    // 6) ✅ Validation "SALON" sur l'état FINAL (payload + existant)
    const finalMode = (payload.serviceMode ?? (existingShop as any).serviceMode) as any;
    const finalAddress = payload.placeAddress ?? (existingShop as any).placeAddress;

    if (finalMode === "SALON") {
      const a = finalAddress || {};
      if (!a.addressLine1 || !a.postalCode || !a.city) {
        return res.status(400).json({
          message: "Adresse du salon incomplète (adresse, code postal, ville requis).",
        });
      }
    }

    // 7) Update en base
    const updatedShop = await ShopModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updatedShop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    return res.json(updatedShop);
  } catch (error: any) {
    logger.error({
      msg: "shop.update.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Impossible de mettre à jour la boutique" });
  }
};



// Supprimer une boutique par son ID
const deleteShopById = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.delete.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;

    const deletedShop = await ShopModel.findByIdAndDelete(id);

    if (!deletedShop) {
      logger.warn({ msg: "shop.delete.not_found", id });
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const employeeId = deletedShop.idUser;
    const employee = await UserModel.findById(employeeId);

    if (employee && employee.managerId) {
      await UserModel.findByIdAndUpdate(employee.managerId, {
        $pull: { employeesIds: employee._id },
      });

      employee.managerId = undefined;
      await employee.save();
    }

    logger.info({ msg: "shop.delete.success", id });
    res.json({ message: "Boutique supprimée avec succès" });
  } catch (error: any) {
    console.error(error);
    logger.error({
      msg: "shop.delete.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de supprimer la boutique" });
  }
};

// Récupérer tous les services proposés par une boutique
const getServicesByShop = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.services.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    const services = await ServiceModel.find({ shopId: id });
    console.log("shopId shopController : " + id);
    if (services.length > 0) {
      console.log("Service length > 0");
      logger.info({ msg: "shop.services.success", id, count: services.length });
      res.json(services);
    } else {
      logger.warn({ msg: "shop.services.none_found", id });
      res.status(404).json({ message: "Aucun service trouvé pour cette boutique" });
    }
  } catch (error: any) {
    logger.error({
      msg: "shop.services.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de récupérer les services pour cette boutique" });
  }
};

// Récupérer toutes les boutiques associées à un userId
const getShopsByUserId = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shops.byUser.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { userId } = req.params;
    console.log(userId);
    const shops = await ShopModel.find({ idUser: userId });

    if (shops.length > 0) {
      console.log("shops to find 66666666666666      :::::::: " + shops);
      logger.info({ msg: "shops.byUser.success", userId, count: shops.length });
      res.json(shops);
    } else {
      logger.warn({ msg: "shops.byUser.none_found", userId });
      res.status(404).json({ message: "Aucune boutique trouvée pour cet utilisateur" });
    }
  } catch (error: any) {
    logger.error({
      msg: "shops.byUser.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible de récupérer les boutiques pour cet utilisateur" });
  }
};

// Upload images to a shop's gallery
const uploadGalleryImages = async (req: MulterRequest, res: Response) => {
  logger.info({ msg: "shop.gallery.upload.start", route: req.originalUrl, method: req.method, params: req.params, filesCount: (req.files || []).length });
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "Aucune image uploadée" });
    }

    const shop = await ShopModel.findById(id);
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const imagePaths = files.map(file => `/uploads/images/gallery/${file.filename}`);
    console.log("imagePaths : " + imagePaths);

    if (!shop.galleryImages) {
      shop.galleryImages = [];
    }
    shop.galleryImages.push(...imagePaths);
    console.log("shop.galleryImages : " + shop.galleryImages);
    await shop.updateOne({ galleryImages: shop.galleryImages });

    logger.info({ msg: "shop.gallery.upload.success", id, added: imagePaths.length });
    res.status(200).json({ message: "Images uploadées avec succès", galleryImages: shop.galleryImages });
  } catch (error: any) {
    logger.error({
      msg: "shop.gallery.upload.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de l'upload des images" });
  }
};

// Get all gallery images for a specific shop
const getGalleryImages = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.gallery.get.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    console.log("id ShopGallery : " + id);
    const shop = await ShopModel.findById(id);
    if (!shop || !shop.galleryImages) {
      logger.warn({ msg: "shop.gallery.get.not_found", id });
      return res.status(404).json({ message: "Boutique ou galerie non trouvée" });
    }

    logger.info({ msg: "shop.gallery.get.success", id, count: shop.galleryImages.length });
    res.status(200).json({ galleryImages: shop.galleryImages });
  } catch (error: any) {
    logger.error({
      msg: "shop.gallery.get.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la récupération des images de la galerie" });
  }
};

// Annuler une réservation en mettant à jour son statut à "cancelled"
const addShopReview = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.review.add.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    const review = req.body;
    console.log("review : " + JSON.stringify(req.body));

    const updatedShop = await ShopModel.findByIdAndUpdate(
      id,
      { $push: { reviews: review } },
      { new: true }
    );

    if (updatedShop) {
      logger.info({ msg: "shop.review.add.success", id });
      res.json({ message: "Avis ajouté avec succès", shop: updatedShop });
    } else {
      logger.warn({ msg: "shop.review.add.not_found", id });
      res.status(404).json({ message: "Shop non trouvée" });
    }
  } catch (error: any) {
    console.error(error);
    logger.error({
      msg: "shop.review.add.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Impossible d'ajouter votre avis" });
  }
};

const bulkUpdateShopStats = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.stats.bulkUpdate.start", route: req.originalUrl, method: req.method });
  try {
    const { stats } = req.body;

    if (!Array.isArray(stats) || stats.length === 0) {
      return res.status(400).json({ message: "Données invalides" });
    }

    const bulkOps = stats.map(({ shopId, impressions, duree_affichage }) => ({
      updateOne: {
        filter: { _id: shopId },
        update: {
          $inc: {
            impressions: impressions || 0,
            nombre_affichages_valides: impressions ? 1 : 0,
            temps_affichage_total: duree_affichage || 0,
          }
        }
      }
    }));

    await ShopModel.bulkWrite(bulkOps);
    logger.info({ msg: "shop.stats.bulkUpdate.success", ops: bulkOps.length });
    res.json({ message: "Mises à jour des statistiques effectuées" });

  } catch (error: any) {
    logger.error({
      msg: "shop.stats.bulkUpdate.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la mise à jour des stats", error });
  }
};

const incrementImpression = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.stats.impression.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    console.log(`📢 Tentative d'incrémentation d'impression pour la boutique ${id}`);

    const shop = await ShopModel.findById(id);
    if (!shop) {
      console.error(`❌ Boutique introuvable : ${id}`);
      logger.warn({ msg: "shop.stats.impression.not_found", id });
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    shop.impressions += 1;
    await shop.save();

    console.log(`✅ Impression mise à jour avec succès pour ${id}`);
    logger.info({ msg: "shop.stats.impression.success", id, impressions: shop.impressions });
    res.json({ message: "Impression mise à jour", shop });
  } catch (error: any) {
    console.error("❌ Erreur dans incrementImpression :", error);
    logger.error({
      msg: "shop.stats.impression.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la mise à jour des impressions", error });
  }
};

const updateShopDisplayTime = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.stats.displayTime.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    const { duree_affichage } = req.body;

    if (!duree_affichage || duree_affichage <= 0) {
      return res.status(400).json({ message: "Durée d'affichage invalide" });
    }

    const shop = await ShopModel.findById(id);
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    shop.temps_affichage_total += duree_affichage;
    shop.nombre_affichages_valides += 1;
    await shop.save();

    logger.info({
      msg: "shop.stats.displayTime.success",
      id,
      total: shop.temps_affichage_total,
      validCount: shop.nombre_affichages_valides
    });

    res.json({ message: "Temps d'affichage mis à jour", shop });
  } catch (error: any) {
    logger.error({
      msg: "shop.stats.displayTime.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur lors de la mise à jour du temps d'affichage", error });
  }
};

const searchShopsWithServices = async (req: express.Request, res: express.Response) => {
  logger.info({
    msg: "shops.searchWithServices.start",
    route: req.originalUrl,
    method: req.method,
    query: req.query,
  });

  try {
    const { postalCode, query, mode, country } = req.query;

    if (!postalCode || !query) {
      return res.status(400).json({ message: "postalCode et query sont requis" });
    }

    // ✅ mode optionnel mais fortement recommandé
    // Si non fourni => par défaut DOMICILE (cohérent avec ton historique "deliveryPostalCodes")
    const normalizedMode = String(mode || "DOMICILE").toUpperCase();
    if (normalizedMode !== "SALON" && normalizedMode !== "DOMICILE") {
      return res.status(400).json({ message: "mode invalide (SALON ou DOMICILE)" });
    }

    // country optionnel
    const countryValue = country ? String(country) : null;

    const lowerQuery = String(query).toLowerCase();
    const pc = String(postalCode).trim();

    // ✅ Filtre géographique selon mode
    let zoneMatch = {};
    if (normalizedMode === "SALON") {
      zoneMatch = {
        serviceMode: "SALON",
        $or: [
          { "placeAddress.postalCode": pc },
          { "legal.postalCode": pc }, // fallback si placeAddress non rempli
        ],
      };
    } else {
      zoneMatch = {
        serviceMode: "DOMICILE",
        deliveryPostalCodes: pc,
      };
    }

    // ✅ Filtre pays si fourni
    // Attention : dans ton shop model, tu as `country` qui contient souvent "France"
    // donc on match exactement (comme tu fais ailleurs).
    const countryMatch = countryValue ? { country: countryValue } : {};

    const results = await ShopModel.aggregate([
      {
        $match: {
          ...zoneMatch,
          ...countryMatch,
          active: true,
          status: "approved",
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "_id",
          foreignField: "shopId",
          as: "services",
        },
      },
      {
        $addFields: {
          matchedServices: {
            $filter: {
              input: "$services",
              as: "service",
              cond: {
                $regexMatch: {
                  input: { $toLower: "$$service.name" },
                  regex: lowerQuery,
                },
              },
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { name: { $regex: String(query), $options: "i" } },
            { "matchedServices.0": { $exists: true } },
          ],
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          image: 1,
          note: 1,
          type: 1,
          ville: 1,
          district: 1,
          averagePrice: 1,
          minimumDelay: 1,
          trad: 1,
          galleryImages: 1,
          location: 1,
          hours: 1,
          promo: 1,
          affichage_prioritaire: 1,
          impressions: 1,
          clics: 1,
          taux_conversion: 1,
          temps_affichage_total: 1,
          nombre_affichages_valides: 1,
          serviceMode: 1,
          placeAddress: 1,
          deliveryPostalCodes: 1,
          services: "$matchedServices",
        },
      },
    ]);

    logger.info({ msg: "shops.searchWithServices.success", returned: results.length });
    return res.status(200).json(results);
  } catch (error: any) {
    console.error("Erreur dans searchShopsWithServices :", error);
    logger.error({
      msg: "shops.searchWithServices.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Erreur lors de la recherche des boutiques" });
  }
};


const getShopsByBoss = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shops.byBoss.start", route: req.originalUrl, method: req.method });
  try {
    const token = req.header("Authorization");
    if (!token) {
      return res.status(401).json({ message: "Token manquant" });
    }

    const decoded: any = require("jsonwebtoken").verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const boss = await UserModel.findById(bossId);
    if (!boss || boss.role !== "boss") {
      return res.status(403).json({ message: "Accès interdit : rôle non autorisé" });
    }

    if (!boss.employeesIds || boss.employeesIds.length === 0) {
      logger.info({ msg: "shops.byBoss.success_noEmployees", bossId });
      return res.status(200).json([]);
    }

    const shops = await ShopModel.find({ idUser: { $in: boss.employeesIds } });
    logger.info({ msg: "shops.byBoss.success", bossId, count: shops.length });
    res.status(200).json(shops);
  } catch (error: any) {
    console.error("Erreur dans getShopsByBoss :", error);
    logger.error({
      msg: "shops.byBoss.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

/**
 * ✅ Upload des documents de vérification (pièce d’identité, assurance, Kbis)
 * - Endpoint : POST /shop/:id/verification-docs
 * - Champs de fichiers : identityDoc, insuranceDoc, kbisDoc
 */
const uploadVerificationDocs = async (req: any, res: express.Response) => {
  logger.info({ msg: "shop.verification.upload.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    const files = (req.files || {}) as {
      [field: string]: Express.Multer.File[];
    };

    const shop = await ShopModel.findById(id);
    if (!shop) {
      logger.warn({ msg: "shop.verification.upload.not_found", id });
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const identityFile = files.identityDoc?.[0];
    const insuranceFile = files.insuranceDoc?.[0];
    const kbisFile = files.kbisDoc?.[0];

    if (!shop.verification) {
      (shop as any).verification = {
        identity: { status: "missing" },
        insurance: { status: "missing" },
        kbis: { status: "missing" },
        globalStatus: "unverified",
        method: "manual",
      };
    }

    const verification: any = shop.verification || {};

    if (identityFile) {
      verification.identity = {
        file: `/uploads/docs/${identityFile.filename}`,
        status: "pending",
        checkedAt: null,
      };
    }

    if (insuranceFile) {
      verification.insurance = {
        file: `/uploads/docs/${insuranceFile.filename}`,
        status: "pending",
        checkedAt: null,
      };
    }

    if (kbisFile) {
      verification.kbis = {
        file: `/uploads/docs/${kbisFile.filename}`,
        status: "pending",
        checkedAt: null,
      };
    }

    const hasMandatoryDocs =
      verification.identity?.file && verification.insurance?.file;

    if (hasMandatoryDocs) {
      verification.globalStatus = "pending";
    } else if (!verification.identity?.file && !verification.insurance?.file) {
      verification.globalStatus = "unverified";
    }

    shop.verification = verification;
    await shop.save();

    logger.info({
      msg: "shop.verification.upload.success",
      id,
      hasIdentity: !!verification.identity?.file,
      hasInsurance: !!verification.insurance?.file,
      hasKbis: !!verification.kbis?.file,
      globalStatus: verification.globalStatus,
    });

    return res.status(200).json({
      message: "Documents uploadés avec succès",
      verification: shop.verification,
      shop,
    });
  } catch (error: any) {
    console.error("Erreur uploadVerificationDocs :", error);
    logger.error({
      msg: "shop.verification.upload.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Erreur lors de l'upload des documents" });
  }
};

/**
 * ✅ Récupérer le statut de vérification pour un shop
 * - Endpoint : GET /shop/:id/verification
 */
const getShopVerificationStatus = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.verification.get.start", route: req.originalUrl, method: req.method, params: req.params });
  try {
    const { id } = req.params;
    const shop = await ShopModel.findById(id);

    if (!shop) {
      logger.warn({ msg: "shop.verification.get.not_found", id });
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const verification =
      shop.verification ||
      {
        identity: { status: "missing" },
        insurance: { status: "missing" },
        kbis: { status: "missing" },
        globalStatus: "unverified",
        method: "manual",
      };

    logger.info({ msg: "shop.verification.get.success", id, globalStatus: verification.globalStatus });
    return res.status(200).json(verification);
  } catch (error: any) {
    logger.error({
      msg: "shop.verification.get.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Erreur lors de la récupération du statut de vérification" });
  }
};


export const updateVerificationDocs = async (req: Request, res: Response) => {
  try {
    const shopId = req.params.id;
    const shop = await ShopModel.findById(shopId);
    if (!shop) return res.status(404).send({ error: "Shop not found" });

    const files = req.files as { [key: string]: Express.Multer.File[] };

    if (!shop.verification) {
      shop.verification = {
        identity: { status: "missing" },
        insurance: { status: "missing" },
        kbis: { status: "missing" },
        globalStatus: "pending",
        method: "manual"
      };
    }

    if (files.identityDoc?.[0]) {
      shop.verification.identity = {
        file: `/uploads/docs/${files.identityDoc[0].filename}`,
        status: "pending",
        checkedAt: undefined
      };
    }

    if (files.insuranceDoc?.[0]) {
      shop.verification.insurance = {
        file: `/uploads/docs/${files.insuranceDoc[0].filename}`,
        status: "pending",
        checkedAt: undefined
      };
    }

    if (files.kbisDoc?.[0]) {
      shop.verification.kbis = {
        file: `/uploads/docs/${files.kbisDoc[0].filename}`,
        status: "pending",
        checkedAt: undefined
      };
    }

    shop.verification.globalStatus = "pending";

    await shop.save();

    res.send({ success: true, verification: shop.verification });

  } catch (err) {
    console.error("Erreur updateVerificationDocs :", err);
    res.status(500).send({ error: "Server error" });
  }
};

// ✅ Validation manuelle d’un document de vérification
// body: { shopId: string, docType: 'identity' | 'insurance' | 'kbis', status: 'missing' | 'pending' | 'approved' | 'rejected' }
const validateVerificationDoc = async (req: express.Request, res: express.Response) => {
  try {
    const { shopId, docType, status } = req.body as {
      shopId?: string;
      docType?: 'identity' | 'insurance' | 'kbis';
      status?: 'missing' | 'pending' | 'approved' | 'rejected';
    };

    if (!shopId || !docType || !status) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    const shop = await ShopModel.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // -------------------------------------------------
    // 🔐 On récupère un objet "verification" toujours défini
    // -------------------------------------------------
    const verification: any =
      shop.verification || {
        identity: {
          file: undefined,
          status: "missing",
          checkedAt: null,
        },
        insurance: {
          file: undefined,
          status: "missing",
          checkedAt: null,
        },
        kbis: {
          file: undefined,
          status: "missing",
          checkedAt: null,
        },
        globalStatus: "unverified",
        method: "manual",
      };

    // -------------------------------------------------
    // ✏️ Mise à jour du doc ciblé
    // -------------------------------------------------
    if (docType === "identity" || docType === "insurance" || docType === "kbis") {
      const current = verification[docType] || {};
      verification[docType] = {
        ...current,
        status,
        checkedAt: new Date(),
      };
    }

    // -------------------------------------------------
    // 🌐 Recalcul du statut global
    // -------------------------------------------------
    const allDocs: Array<'identity' | 'insurance' | 'kbis'> = [
      "identity",
      "insurance",
      "kbis",
    ];

    const statuses = allDocs
      .map((d) => verification[d]?.status as string | undefined)
      .filter(Boolean) as Array<'missing' | 'pending' | 'approved' | 'rejected'>;

    if (statuses.length === 0) {
      verification.globalStatus = "unverified";
    } else if (statuses.every((s) => s === "approved")) {
      verification.globalStatus = "verified";
    } else if (statuses.some((s) => s === "rejected")) {
      verification.globalStatus = "rejected";
    } else {
      verification.globalStatus = "pending";
    }

    // -------------------------------------------------
    // 💾 Sauvegarde
    // -------------------------------------------------
    shop.verification = verification;
    await shop.save();

    return res.status(200).json({
      message: "Verification updated",
      verification: shop.verification,
    });
  } catch (error: any) {
    console.error("Erreur validateVerificationDoc :", error);
    return res.status(500).json({ message: "Server error" });
  }
};


function normalizeLangShop(x: any): "fr" | "en" {
  const raw = String(x || "").toLowerCase().slice(0, 2);
  return raw === "fr" ? "fr" : "en";
}

function adminRowHtml(b: any, clientEmail: string) {
  const start = b?.start ? new Date(b.start).toISOString() : "";
  const amount = b?.price ?? "";
  const pi = b?.paymentIntentId ?? "";
  return `
    <div style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:13px;color:#fff;"><strong>${String(b?._id || "")}</strong> • ${clientEmail}</div>
      <div style="font-size:12px;color:#b7b7cc;">${String(b?.productName || "")} • ${start} • ${amount} € • PI=${pi}</div>
    </div>
  `;
}

export const blockShopAndRefundBookings = async (req: Request, res: Response) => {
  const { id } = req.params;
  const reason = String((req.body?.reason || "Blocage boutique (admin)").trim());

  try {
    logger.info({ msg: "shop.block.start", shopId: id, reason });

    const shop = await ShopModel.findById(id);
    if (!shop) {
      logger.warn({ msg: "shop.block.shop_not_found", shopId: id });
      return res.status(404).json({ message: "Boutique introuvable" });
    }

    // 🌍 Langue = langue du shop (FR sinon "en")
    // (Tu voulais: FR si boutique FR, sinon langue boutique)
    // Si ton shop a un champ `language` c'est parfait, sinon adapte.
    const shopLang = normalizeLangShop((shop as any).language || (shop as any).lang || "fr");

    // 1) On récupère les bookings impactés (pending/accepted)
    const bookings = await BookingModel.find({
      shopId: String(id),
      status: { $in: ["pending", "accepted"] },
    });

    const stripe = getStripe();

    const adminRows: string[] = [];
    const adminEmail = "contact@izyglam.com";

    // 2) Traiter chaque booking
    for (const b of bookings) {
      try {
        // Sécurité idempotence: si déjà refunded => on ne refait pas
        if ((b as any).refundedAt || (b as any).refundId) {
          // On s'assure quand même que le statut est cancelled
          if ((b as any).status !== "cancelled") {
            (b as any).status = "cancelled";
            await b.save();
          }
          continue;
        }

        // Récupérer le client (email + prénom) via clientId
        const client = await UserModel.findById((b as any).clientId).lean();
        const clientEmail = (client as any)?.email;
        const clientName =
          [(client as any)?.firstname, (client as any)?.lastname].filter(Boolean).join(" ").trim()
          || (client as any)?.firstname
          || "Client";

        if (!clientEmail) {
          logger.warn({ msg: "shop.block.client_email_missing", bookingId: String((b as any)._id) });
          // Même sans email, on annule le booking + refund si possible
        }

        // a) Refund Stripe si PaymentIntent
        let refundId: string | undefined;
        const paymentIntentId = (b as any).paymentIntentId;

        if (paymentIntentId) {
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            // reason optionnel (Stripe accepte des valeurs spécifiques, sinon enlève)
          });
          refundId = refund.id;
        }

        // b) Update booking -> cancelled + refund info
        (b as any).status = "cancelled";
        (b as any).refundId = refundId;
        (b as any).refundedAt = new Date();
        await b.save();

        // c) Email client (dans la langue du shop)
        if (clientEmail) {
          const tpl = renderClientRefundEmailHTML({
            lang: shopLang,
            clientName,
            establishmentName: String((b as any).establishmentName || (shop as any).name || "IzyGlam"),
            productName: String((b as any).productName || ""),
            start: (b as any).start,
            price: String((b as any).price || ""),
            bookingId: String((b as any)._id),
          });

          await sendEmail({
            to: clientEmail,
            subject: tpl.subject,
            text: tpl.text,
            html: tpl.html,
            replyTo: "support@izyglam.com",
          });
        }

        adminRows.push(adminRowHtml(b, (client as any)?.email || "email inconnu"));

        logger.info({
          msg: "shop.block.booking_refunded_cancelled",
          bookingId: String((b as any)._id),
          paymentIntentId,
          refundId,
        });

      } catch (err: any) {
        logger.error({
          msg: "shop.block.booking_error",
          bookingId: String((b as any)._id),
          errorMessage: err?.message,
          stack: err?.stack,
        });
        // On continue pour traiter les autres bookings
      }
    }

    // 3) Bloquer le shop (après traitement bookings)
    (shop as any).active = false;
    (shop as any).status = "blocked";
    // Optionnel: on garde une trace dans flags
    const flags = Array.isArray((shop as any).flags) ? (shop as any).flags : [];
    if (!flags.includes("blocked_by_admin")) flags.push("blocked_by_admin");
    (shop as any).flags = flags;

    await shop.save();

    // 4) Email admin recap
    const now = new Date();
    const recap = renderAdminBlockRecapEmailHTML({
      shopName: String((shop as any).name || "Shop"),
      shopId: String((shop as any)._id),
      reason,
      dateTime: now.toISOString(),
      rowsHtml: adminRows.join("") || "",
    });

    await sendEmail({
      to: adminEmail,
      subject: recap.subject,
      text: recap.text,
      html: recap.html,
      replyTo: "support@izyglam.com",
    });

    logger.info({ msg: "shop.block.success", shopId: id, refunded: adminRows.length });

    return res.json({
      ok: true,
      shopId: id,
      refundedBookingsCount: adminRows.length,
    });

  } catch (error: any) {
    logger.error({
      msg: "shop.block.error",
      shopId: id,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Erreur lors du blocage de la boutique." });
  }
};

function normalizeHandle(input: string): string {
  const raw = (input || "").trim().replace(/^@+/, ""); // enlève @@@
  if (!raw) return "";

  // enlève accents
  const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // garde uniquement a-z 0-9 . _
  const cleaned = noAccents
    .toLowerCase()
    .replace(/\s+/g, "")              // supprime espaces
    .replace(/[^a-z0-9._]/g, "");     // supprime le reste

  // évite "...." ou "__" en début/fin
  return cleaned.replace(/^[._]+|[._]+$/g, "");
}

async function generateUniqueHandle(base: string, excludeShopId?: string) {
  let candidate = normalizeHandle(base);
  if (!candidate) candidate = "shop";

  // petite limite de sécurité (tu peux ajuster)
  candidate = candidate.slice(0, 30);

  let i = 0;
  while (true) {
    const finalHandle = i === 0 ? candidate : `${candidate}${i + 1}`;

    const query: any = { handle: finalHandle };
    if (excludeShopId) query._id = { $ne: excludeShopId };

    const exists = await ShopModel.exists(query);
    if (!exists) return finalHandle;

    i++;
    if (i > 200) throw new Error("Unable to generate unique handle");
  }
}

const getShopByHandle = async (req: express.Request, res: express.Response) => {
  logger.info({ msg: "shop.getByHandle.start", route: req.originalUrl, method: req.method, params: req.params });

  try {
    const handle = String(req.params.handle || "").trim();
    if (!handle) return res.status(400).json({ message: "Handle invalide" });

    const shop: any = await ShopModel.findOne({ handle }).lean();
    if (!shop) return res.status(404).json({ message: "Boutique non trouvée" });

    // Valeur par défaut
    let twilioPhoneNumber: string | null = null;

    // ✅ Si shop premium => récupérer le twilioPhoneNumber du user associé
    if (shop.isPremium === true) {
      const userId = String(shop.idUser || "").trim();

      if (mongoose.isValidObjectId(userId)) {
        const user: any = await UserModel.findById(userId).select({ twilioPhoneNumber: 1 }).lean();
        twilioPhoneNumber = user?.twilioPhoneNumber ? String(user.twilioPhoneNumber) : null;
      }
    }

    // ✅ Renvoie shop + champ additionnel (sans toucher la DB)
    return res.json({
      ...shop,
      twilioPhoneNumber,
    });
  } catch (error: any) {
    logger.error({
      msg: "shop.getByHandle.error",
      errorMessage: error?.message,
      stack: error?.stack,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

const suggestHandle = async (req: express.Request, res: express.Response) => {
  try {
    const { name, handle } = req.body || {};
    const base = handle || name;

    if (!base) return res.status(400).json({ message: "name ou handle requis" });

    const suggested = await generateUniqueHandle(base);
    return res.json({ handle: suggested });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Erreur serveur" });
  }
};

const isHandleAvailable = async (req: express.Request, res: express.Response) => {
  try {
    const handle = normalizeHandle(String(req.query.handle || ""));
    if (!handle) return res.status(400).json({ message: "handle requis" });

    const exists = await ShopModel.exists({ handle });
    return res.json({ handle, available: !exists });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Erreur serveur" });
  }
};

module.exports = {
  getShopsByBoss,
  getShopsAllCount,
  createShop,
  getAllShops,
  getAllShopsAdmin,
  getShopsNearby,
  getShopsByPostalCodes,
  getShopById,
  updateShopById,
  deleteShopById,
  getServicesByShop,
  getShopsByUserId,
  uploadGalleryImages,
  getGalleryImages,
  updateVerificationDocs,
  getShopsByIds,
  addShopReview,
  incrementImpression,
  updateShopDisplayTime,
  bulkUpdateShopStats,
  processShopImage,
  searchShopsWithServices,
  validateVerificationDoc,
  getIzyGlamDescription,
  uploadServiceImageAI,
  getIzyGlamProductDescription,
  getShopsByPostalCodesWithCategories,
  uploadVerificationDocs,
  getShopVerificationStatus,
  blockShopAndRefundBookings,
  generateUniqueHandle,
  getShopByHandle,
  isHandleAvailable,
  suggestHandle,
};
