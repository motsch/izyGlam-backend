import ShopModel from "../models/shop";
import ServiceTemplateModel from "../models/serviceTemplate";
import ServiceModel from "../models/service";
import * as express from "express";
import { Request, Response } from 'express';
import axios from 'axios';
import path from "path";
import fs from "fs";
import UserModel from "../models/user"; // Assure-toi d’avoir bien importé ça en haut
import serviceModel from "../models/service";


// Étendre l'interface Request pour inclure la propriété 'files'
interface MulterRequest extends Request {
  files: Express.Multer.File[]; // Correctement typé
}

const getShopsAllCount = async (
  req: express.Request,
  res: express.Response) => {
  try {
    const shops = await ShopModel.find()
    const shopsCount = shops.length;
    res.status(200).json(shopsCount);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer le nombre d'utilisateurs" });
  }
};

const getShopsByIds = async (req: any, res: express.Response) => {
  try {
    // const { shopIds } = req.params;

    const shopIds = req.body.shopIds;
    console.log("shopIds : " + shopIds);
    const shops = await ShopModel.find({ _id: { $in: shopIds } });
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des shops favoris' });
  }
}

// Créer une nouvelle boutique (shop)
const createShop = async (req: express.Request, res: express.Response) => {
  try {
    console.log("IN CREATE SHOP");
    const body = req.body;

    // Étape 1 – Création de la boutique
    const newShop = new ShopModel(body);
    await newShop.save();

    // Étape 2 – Recherche des templates du bon type
    let templates = await ServiceTemplateModel.find({ type: newShop.type, active: true });

    // Si aucun, on prend n'importe quels templates actifs
    if (templates.length === 0) {
      console.log("Aucun template du type trouvé, fallback vers des templates actifs génériques");
      templates = await ServiceTemplateModel.find({ active: true });
    }

    // Étape 3 – Clonage des services à partir des templates
    const servicesToCreate = templates.map((template) => {
      return new ServiceModel({
        name: template.name,
        description: template.description,
        image: template.image,
        type: template.type,
        price: template.price,
        duration: template.duration,
        color: template.color || "#ff4081", // fallback si jamais
        shopId: newShop._id,
      });
    });

    // Étape 4 – Sauvegarde des services
    const createdServices = await ServiceModel.insertMany(servicesToCreate);

    // Étape 5 – On peut renvoyer la boutique + les services
    res.status(201).json({
      shop: newShop,
      services: createdServices,
    });
  } catch (error) {
    console.error("Erreur dans createShop :", error);
    res.status(500).json({ message: "Impossible de créer la boutique et ses services." });
  }
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Créer une nouvelle boutique (shop)
export const getIzyGlamProductDescription = async (req: express.Request, res: express.Response) => {
  try {
    console.log("IN PRODUCT DESCRIPTION IZYGLAM");

    const { product } = req.body;

    if (!product.type) {
      return res.status(400).json({ message: "Le type de salon est requis." });
    }
    if (!product._id) {
      return res.status(400).json({ message: "L'ID du produit est requis." });
    }

    const prompt = product.description
      ? `Tu es un expert en communication pour une plateforme de salons de beauté à domicile. Pour la prestation ${product.name}, on souhaite revoir la description: "${product.description}". Si une description est viable, reformule-la pour qu'elle soit professionnelle, engageante, sympathique et vendeuse, tout en gardant un ton humain. Sinon, crée-la de 0. Maximum 40 mots. Pas de symboles bizarres, d'étoile ou autre.`
      : `Tu es un expert en communication pour une plateforme de salons de beauté à domicile. Génére une description de prestation originale, professionnelle, engageante et sympathique pour une prestation portant ce nom: "${product.name}". Ajoute une touche de personnalité unique à chaque fois. Maximum 40 mots. Pas de symboles bizarres, d'étoile ou autre.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Le salon est toujours géré par une seule personne. Les descriptions ne parlent donc pas d\'une équipe, mais d\'un professionnel.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    ); let formattedDescription = response.data.choices[0].message?.content?.trim() || '';
    // Retire les guillemets simples ou doubles en début et fin
    formattedDescription = formattedDescription.replace(/^["']|["']$/g, '');

    // 1️⃣ Récupérer le produit dans MongoDB
    const newProduct = await serviceModel.findById(product._id);
    if (!newProduct) {
      return res.status(404).json({ message: "Produit introuvable." });
    }

    // 2️⃣ Mettre à jour la description
    newProduct.description = formattedDescription;

    // 3️⃣ Sauvegarder en base
    await newProduct.save();

    // 🔹 Retourner directement le document
    res.status(200).json(newProduct);
  } catch (error: any) {
    console.error("Erreur dans getIzyGlamDescription :", error?.response?.data || error);
    res.status(500).json({ message: "Impossible de générer la description." });
  }
};

// Créer une nouvelle boutique (shop)
export const getIzyGlamDescription = async (req: express.Request, res: express.Response) => {
  try {
    console.log("IN DESCRIPTION IZYGLAM");

    const { product } = req.body;

    if (!product.type) {
      return res.status(400).json({ message: "Le type de salon est requis." });
    }

    const prompt = product.description
      ? `Tu es un expert en communication pour une plateforme de salons de beauté à domcile. Voici une description pour ce salon de type "${product.type}". La description est : "${product.description}". Si une description est viable, refomule la pour qu'elle soit professionnelle, engageante, sympathique et vendeuse, tout en gardant un ton humain. Sinon créer là de 0. C'est une description à la premiere personne (On utilise le "je"). Maximum 60 mots. Pas de symboles bizarres, d'étoile ou autre.`
      : `Tu es un expert en communication pour une plateforme de salons de beauté à domicile. Génére une description originale, professionnelle, engageante et sympathique pour un salon de type "${product.type}". Ajoute une touche de personnalité unique à chaque fois. C'est une description à la premiere personne (On utilise le "je"). Maximum 60 mots. Pas de symboles bizarres, d'étoile ou autre.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en rédaction pour une plateforme comme IzyGlam, spécialisée dans les salons de beauté.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const formattedDescription = response.data.choices[0].message?.content?.trim() || '';

    res.status(200).json({ formattedDescription });
  } catch (error: any) {
    console.error("Erreur dans getIzyGlamDescription :", error?.response?.data || error);
    res.status(500).json({ message: "Impossible de générer la description." });
  }
};



/**
 * Remplace l'image d'un Service par une image générée via OpenAI.
 * Body attendu: { product: { type: string, description?: string }, size?: "1024x1024"|"1792x1024"|"1024x1792" }
 * Route suggérée: POST /services/:id/image/ai
 */
export const uploadServiceImageAI = async (req: Request, res: Response) => {
  try {
    const { product, size } = req.body || {};
    const id = product?._id;

    if (!id) return res.status(400).json({ message: "Paramètre id manquant." });
    if (!product?.type) return res.status(400).json({ message: "product.type est requis." });
    if (!OPENAI_API_KEY) return res.status(500).json({ message: "OPENAI_API_KEY manquant." });

    const service = await ServiceModel.findById(id);
    if (!service) return res.status(404).json({ message: "Service non trouvé." });

    const clientGender = "femme"; // ou "homme"

    const prompt = `
Tu es un·e directeur·ice artistique. Crée une photo ultra réaliste et professionnelle pour représenter ce service de beauté à domicile, dans le style des visuels produits d'Uber Eats (présentation irrésistible, mise en avant claire du sujet, éclairage parfait, réalisme maximal).
Produit: ${product.name}.
Style: photo haute définition, éclairage naturel et harmonieux, ambiance chaleureuse et premium, couleurs fidèles, mise en scène soignée.
La scène montre un professionnel en train de réaliser la prestation sur un·e client·e ${clientGender}, dans un intérieur cosy et lumineux.
Une attention particulière doit être portée à la position et au réalisme des bras et des mains, avec une interaction naturelle et précise entre le professionnel et le/la client·e (aucune distorsion ou doigts supplémentaires).
Sujet: "${product.type}" à domicile.
${product.description ? `Description du produit: ${product.description}` : ""}
`.trim();

    const allowedSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    const finalSize = allowedSizes.includes(size) ? size : "1536x1024";

    // 1) Génération
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
      const status = e?.response?.status || 502;
      const msg = e?.response?.data?.error?.message || e?.message || "Erreur OpenAI Images";
      return res.status(status).json({ message: msg });
    }

    const item = aiResp?.data?.data?.[0];
    if (!item) {
      console.error("OpenAI images payload inattendu:", JSON.stringify(aiResp?.data, null, 2));
      return res.status(502).json({ message: "Payload image invalide (data[0] manquant)." });
    }

    // 2) Écriture fichier : gère base64 OU URL
    const dir = path.resolve(process.cwd(), "uploads", "images", "articles");
    await fs.promises.mkdir(dir, { recursive: true });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const absPath = path.join(dir, filename);

    if (item.b64_json) {
      // Cas base64 (ce que tu vois dans tes logs)
      const buffer = Buffer.from(item.b64_json, "base64");
      await fs.promises.writeFile(absPath, buffer);
    } else if (item.url) {
      // Cas URL (ancien comportement)
      const imgResp = await axios.get(item.url, { responseType: "arraybuffer" });
      await fs.promises.writeFile(absPath, imgResp.data);
    } else {
      console.error("Ni b64_json ni url dans la réponse:", JSON.stringify(item, null, 2));
      return res.status(502).json({ message: "OpenAI n'a pas retourné d'image (ni b64 ni url)." });
    }

    const publicPath = `/uploads/images/articles/${filename}`;

    // 3) Supprime l’ancienne si interne
    if (service.image?.startsWith("/uploads/images/articles/")) {
      try {
        const oldAbs = path.resolve(process.cwd(), service.image.slice(1));
        await fs.promises.unlink(oldAbs);
      } catch { /* ignore */ }
    }

    // 4) MAJ service
    service.image = publicPath;
    await service.save();

    return res.status(200).json({
      message: "Image générée et mise à jour avec succès",
      image: publicPath,
      service
    });

  } catch (error: any) {
    console.error("Erreur uploadServiceImageAI :", error?.response?.data || error);
    return res.status(500).json({
      message: "Erreur génération image",
      error: error?.message || "unknown",
    });
  }
};



// Récupérer toutes les boutiques
const getAllShops = async (req: express.Request, res: express.Response) => {
  try {
    const shops = await ShopModel.find();
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les boutiques" });
  }
};

// Fonction de calcul de distance (formule de Haversine)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Rayon de la Terre en km
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
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ message: "Les coordonnées 'lat' et 'lon' sont requises" });
  }
  try {
    const clientLatitude = parseFloat(lat as string);
    const clientLongitude = parseFloat(lon as string);

    // On récupère toutes les boutiques
    const shops = await ShopModel.find();

    // On filtre les boutiques selon la distance
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

    res.json(shopsNearby);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération des boutiques à proximité" });
  }
}

const getShopsByPostalCodes = async (req: Request, res: Response) => {
  try {
    // On récupère `codes` depuis la query
    const { codes } = req.query;

    // On déclare un tableau final de codes postaux (string[])
    let postalCodes: string[] = [];

    // Si rien n'est fourni
    if (!codes) {
      return res.status(400).json({ message: "Les codes postaux sont requis" });
    }

    // 1) Si `codes` est une simple string (ex: "?codes=75001,75002")
    if (typeof codes === "string") {
      postalCodes = codes.split(",").map((code) => code.trim());
    }
    // 2) Si `codes` est déjà un tableau (ex: "?codes=75001&codes=75002")
    else if (Array.isArray(codes)) {
      // Attention : codes peut être (string | ParsedQs)[], donc on transforme en string[]
      postalCodes = codes.map((code) => String(code).trim());
    }

    // À ce stade, postalCodes est un tableau de chaînes
    const shops = await ShopModel.find();

    // On filtre par rapport à un champ deliveryPostalCodes
    // (assure-toi d'avoir ce champ dans le modèle ou de l'ajouter si besoin)
    const shopsByPostalCodes = shops.filter((shop) => {
      if (!shop.deliveryPostalCodes || !Array.isArray(shop.deliveryPostalCodes)) {
        return false;
      }
      return shop.deliveryPostalCodes.some((deliveryCode: string) =>
        postalCodes.includes(deliveryCode)
      );
    });

    res.json(shopsByPostalCodes);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des boutiques par codes postaux" });
  }
};


// Récupérer une boutique par son ID
const getShopById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log("ID : " + id)
    const shop = await ShopModel.findById(id);
    if (shop) {
      res.json(shop);
    } else {
      res.status(404).json({ message: "Boutique non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer la boutique" });
  }
};

// Mettre à jour une boutique par son ID
const updateShopById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updatedShop = await ShopModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedShop) {
      res.json(updatedShop);
    } else {
      res.status(404).json({ message: "Boutique non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de mettre à jour la boutique" });
  }
};

// Supprimer une boutique par son ID
const deleteShopById = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    const deletedShop = await ShopModel.findByIdAndDelete(id);

    if (!deletedShop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    const employeeId = deletedShop.idUser;
    const employee = await UserModel.findById(employeeId);

    if (employee && employee.managerId) {
      // Suppression du lien boss → employé
      await UserModel.findByIdAndUpdate(employee.managerId, {
        $pull: { employeesIds: employee._id },
      });

      // Suppression du lien employé → boss
      employee.managerId = undefined;
      await employee.save();
    }

    res.json({ message: "Boutique supprimée avec succès" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Impossible de supprimer la boutique" });
  }
};


// Récupérer tous les services proposés par une boutique
const getServicesByShop = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    // const services = await ServiceModel.find({ shopId: id });
    const services = await ServiceModel.find({ shopId: id });
    // const services = await ServiceModel.find();
    console.log("shopId shopController : " + id)
    if (services.length > 0) {
      console.log("Service length > 0")
      res.json(services);
    } else {
      res.status(404).json({ message: "Aucun service trouvé pour cette boutique" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les services pour cette boutique" });
  }
};

// Récupérer toutes les boutiques associées à un userId
const getShopsByUserId = async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    console.log(userId)
    const shops = await ShopModel.find({ idUser: userId });

    if (shops.length > 0) {
      console.log("shops to find 66666666666666      :::::::: " + shops)
      res.json(shops);
    } else {
      res.status(404).json({ message: "Aucune boutique trouvée pour cet utilisateur" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer les boutiques pour cet utilisateur" });
  }
};

// Upload images to a shop's gallery
const uploadGalleryImages = async (req: MulterRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files;  // Récupérer les fichiers uploadés via Multer

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "Aucune image uploadée" });
    }

    const shop = await ShopModel.findById(id);
    if (!shop) {
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    // Extraire les noms des fichiers
    const imagePaths = files.map(file => `/uploads/images/gallery/${file.filename}`);
    console.log("imagePaths : " + imagePaths);

    // Ajouter les chemins des fichiers à la galerie
    if (!shop.galleryImages) {
      shop.galleryImages = [];
    }
    shop.galleryImages.push(...imagePaths);
    console.log("shop.galleryImages : " + shop.galleryImages);
    // Sauvegarder les chemins des fichiers dans la base de données
    await shop.updateOne({ galleryImages: shop.galleryImages });

    res.status(200).json({ message: "Images uploadées avec succès", galleryImages: shop.galleryImages });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de l'upload des images" });
  }
};


// Get all gallery images for a specific shop
const getGalleryImages = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log("id ShopGallery : " + id);
    // Trouver le shop par son ID
    const shop = await ShopModel.findById(id);
    if (!shop || !shop.galleryImages) {
      return res.status(404).json({ message: "Boutique ou galerie non trouvée" });
    }

    // Retourner les images de la galerie
    res.status(200).json({ galleryImages: shop.galleryImages });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération des images de la galerie" });
  }
};


// Annuler une réservation en mettant à jour son statut à "cancelled"
const addShopReview = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params; // Shop ID from the request parameters
    const review = req.body; // Review details (rating, comment, user) from the request body
    //console.log("req.body : " + JSON.stringify(req.body));
    console.log("review : " + JSON.stringify(req.body));
    // Add the review to the shop's reviews array
    const updatedShop = await ShopModel.findByIdAndUpdate(
      id,
      { $push: { reviews: review } }, // Use $push to add the review to the reviews array
      { new: true } // Return the updated document
    );
    // console.log("updatedShop : " + updatedShop);
    if (updatedShop) {
      res.json({ message: "Avis ajouté avec succès", shop: updatedShop });
    } else {
      res.status(404).json({ message: "Shop non trouvée" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Impossible d'ajouter votre avis" });
  }
};

const bulkUpdateShopStats = async (req: express.Request, res: express.Response) => {
  try {
    const { stats } = req.body; // stats = [{ shopId, impressions: X, duree_affichage: Y }, ...]

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
    res.json({ message: "Mises à jour des statistiques effectuées" });

  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la mise à jour des stats", error });
  }
};

const incrementImpression = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log(`📢 Tentative d'incrémentation d'impression pour la boutique ${id}`);

    const shop = await ShopModel.findById(id);
    if (!shop) {
      console.error(`❌ Boutique introuvable : ${id}`);
      return res.status(404).json({ message: "Boutique non trouvée" });
    }

    shop.impressions += 1;
    await shop.save();

    console.log(`✅ Impression mise à jour avec succès pour ${id}`);
    res.json({ message: "Impression mise à jour", shop });
  } catch (error) {
    console.error("❌ Erreur dans incrementImpression :", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour des impressions", error });
  }
};


const updateShopDisplayTime = async (req: express.Request, res: express.Response) => {
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
    res.json({ message: "Temps d'affichage mis à jour", shop });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la mise à jour du temps d'affichage", error });
  }
};

const searchShopsWithServices = async (req: express.Request, res: express.Response) => {
  try {
    const { postalCode, query } = req.query;

    if (!postalCode || !query) {
      return res.status(400).json({ message: "postalCode et query sont requis" });
    }

    const lowerQuery = query.toString().toLowerCase();

    const results = await ShopModel.aggregate([
      {
        $match: {
          deliveryPostalCodes: postalCode,
        }
      },
      {
        $lookup: {
          from: 'services', // nom exact de la collection Mongo
          localField: '_id',
          foreignField: 'shopId',
          as: 'services'
        }
      },
      {
        $addFields: {
          matchedServices: {
            $filter: {
              input: '$services',
              as: 'service',
              cond: {
                $regexMatch: {
                  input: { $toLower: '$$service.name' },
                  regex: lowerQuery
                }
              }
            }
          }
        }
      },
      {
        $match: {
          $or: [
            { name: { $regex: query.toString(), $options: 'i' } },
            { 'matchedServices.0': { $exists: true } }
          ]
        }
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
          services: '$matchedServices'
        }
      }
    ]);

    res.status(200).json(results);
  } catch (error) {
    console.error("Erreur dans searchShopsWithServices :", error);
    res.status(500).json({ message: "Erreur lors de la recherche des boutiques", error });
  }
};

const getShopsByBoss = async (req: express.Request, res: express.Response) => {
  try {
    const token = req.header("Authorization");
    if (!token) {
      return res.status(401).json({ message: "Token manquant" });
    }

    const decoded: any = require("jsonwebtoken").verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    // Récupérer le boss
    const boss = await UserModel.findById(bossId);
    if (!boss || boss.role !== "boss") {
      return res.status(403).json({ message: "Accès interdit : rôle non autorisé" });
    }

    // Si pas d'employés
    if (!boss.employeesIds || boss.employeesIds.length === 0) {
      return res.status(200).json([]);
    }

    // Récupérer les shops des employés
    const shops = await ShopModel.find({ idUser: { $in: boss.employeesIds } });
    res.status(200).json(shops);
  } catch (error) {
    console.error("Erreur dans getShopsByBoss :", error);
    res.status(500).json({ message: "Erreur serveur", error });
  }
};



module.exports = {
  getShopsByBoss,
  getShopsAllCount,
  createShop,
  getAllShops,
  getShopsNearby,
  getShopsByPostalCodes,
  getShopById,
  updateShopById,
  deleteShopById,
  getServicesByShop,
  getShopsByUserId,
  uploadGalleryImages,
  getGalleryImages,
  getShopsByIds,
  addShopReview,
  incrementImpression,
  updateShopDisplayTime,
  bulkUpdateShopStats,
  searchShopsWithServices,
  getIzyGlamDescription,
  uploadServiceImageAI,
  getIzyGlamProductDescription,
};
