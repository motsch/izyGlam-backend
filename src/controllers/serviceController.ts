import ServiceModel from "../models/service";
import ShopModel from "../models/shop";
import ServiceTemplateModel from "../models/serviceTemplate";
import * as express from "express";
import { Request, Response } from 'express';
import { logger } from "../utils/logger";

// Étendre l'interface Request pour inclure la propriété 'files'
interface MulterRequest extends Request {
  file: Express.Multer.File; // Correctement typé
}

// Créer un nouveau service
const createService = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.create.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      // ⚠️ attention aux secrets dans req.body
      bodyKeys: Object.keys(req.body || {}),
    });
    console.log("📥 Données reçues pour création de service :", req.body);

    const newService = new ServiceModel(req.body);
    await newService.save();

    logger.info({
      msg: "service.create.success",
      id: newService._id?.toString(),
    });
    console.log("✅ Nouveau service enregistré :", newService);
    res.status(201).json(newService);
  } catch (error: any) {
    console.error("❌ Erreur lors de la création du service :", error);
    logger.error({
      msg: "service.create.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Erreur de validation",
        details: error.message,
      });
    }

    res.status(500).json({
      message: "Impossible de créer le service",
      error: error.message,
    });
  }
};


// Récupérer tous les services
const getAllServices = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.list.start",
      route: req.originalUrl,
      method: req.method,
      query: req.query,
    });
    const services = await ServiceModel.find();
    logger.info({
      msg: "service.list.success",
      count: services.length,
    });
    res.json(services);
  } catch (error) {
    logger.error({
      msg: "service.list.error",
      route: req.originalUrl,
      method: req.method,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Impossible de récupérer les services" });
  }
};

// Récupérer un service par son ID
const getServiceById = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.get.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });
    const { id } = req.params;
    const service = await ServiceModel.findById(id);
    if (service) {
      logger.info({ msg: "service.get.success", id });
      res.json(service);
    } else {
      logger.warn({ msg: "service.get.not_found", id });
      res.status(404).json({ message: "Service non trouvé" });
    }
  } catch (error) {
    logger.error({
      msg: "service.get.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Impossible de récupérer le service" });
  }
};

// Mettre à jour un service par son ID
const updateServiceById = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.update.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      bodyKeys: Object.keys(req.body || {}),
    });
    const { id } = req.params;
    const updatedService = await ServiceModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedService) {
      logger.info({ msg: "service.update.success", id });
      res.json(updatedService);
    } else {
      logger.warn({ msg: "service.update.not_found", id });
      res.status(404).json({ message: "Service non trouvé" });
    }
  } catch (error) {
    logger.error({
      msg: "service.update.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Impossible de mettre à jour le service" });
  }
};

// Supprimer un service par son ID
const deleteServiceById = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.delete.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });
    const { id } = req.params;
    const deletedService = await ServiceModel.findByIdAndDelete(id);
    if (deletedService) {
      logger.info({ msg: "service.delete.success", id });
      res.json({ message: "Service supprimé avec succès" });
    } else {
      logger.warn({ msg: "service.delete.not_found", id });
      res.status(404).json({ message: "Service non trouvé" });
    }
  } catch (error) {
    logger.error({
      msg: "service.delete.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Impossible de supprimer le service" });
  }
};

// Récupérer tous les services proposés par un shop
const getServicesByShop = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.byShop.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });
    const { id } = req.params;

    let services = await ServiceModel.find({
      shopId: id,
      blocked: { $ne: true },
      $or: [
        { flags: { $exists: false } },
        { flags: { $size: 0 } }
      ],
    });



    if (services.length > 0) {
      logger.info({ msg: "service.byShop.success", shopId: id, count: services.length });
      return res.json(services);
    }

    console.log("Aucun service trouvé, on cherche un template…");
    logger.warn({ msg: "service.byShop.none_found_try_template", shopId: id });

    const shop = await ShopModel.findById(id);
    if (!shop) {
      logger.warn({ msg: "service.byShop.shop_not_found", shopId: id });
      return res.status(404).json({ message: "Boutique introuvable" });
    }

    let template = await ServiceTemplateModel.findOne({ type: shop.type, active: true });

    if (!template) {
      console.log("Pas de template du même type, on en prend un actif au hasard");
      logger.warn({ msg: "service.byShop.template_same_type_not_found_use_any_active", shopType: shop.type });
      template = await ServiceTemplateModel.findOne({ active: true });
    }

    if (!template) {
      logger.error({ msg: "service.byShop.no_active_template", shopId: id });
      return res.status(500).json({ message: "Aucun template de service actif disponible pour créer un service" });
    }

    // 👇 On définit une couleur par défaut si absente
    const color = template.color || "#ff4081"; // Rose IzyGlam si non défini

    const newService = new ServiceModel({
      name: template.name,
      description: template.description,
      image: template.image,
      type: template.type,
      price: template.price,
      duration: template.duration,
      color: color,
      shopId: id,
    });

    await newService.save();

    logger.info({
      msg: "service.byShop.created_from_template",
      shopId: id,
      templateId: template._id?.toString(),
      serviceId: newService._id?.toString(),
    });
    console.log("Service créé automatiquement à partir du template");
    res.json([newService]);

  } catch (error) {
    console.error("Erreur dans getServicesByShop :", error);
    logger.error({
      msg: "service.byShop.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
      stack: (error as any)?.stack,
    });
    res.status(500).json({ message: "Erreur lors de la récupération ou de la création des services." });
  }
};



// Récupérer tous les services proposés par un shop
const getServicesByShopAdmin = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.byShop.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });
    const { id } = req.params;

    let services = await ServiceModel.find({ shopId: id });

    if (services.length > 0) {
      logger.info({ msg: "service.byShop.success", shopId: id, count: services.length });
      return res.json(services);
    }

    console.log("Aucun service trouvé, on cherche un template…");
    logger.warn({ msg: "service.byShop.none_found_try_template", shopId: id });

    const shop = await ShopModel.findById(id);
    if (!shop) {
      logger.warn({ msg: "service.byShop.shop_not_found", shopId: id });
      return res.status(404).json({ message: "Boutique introuvable" });
    }

    let template = await ServiceTemplateModel.findOne({ type: shop.type, active: true });

    if (!template) {
      console.log("Pas de template du même type, on en prend un actif au hasard");
      logger.warn({ msg: "service.byShop.template_same_type_not_found_use_any_active", shopType: shop.type });
      template = await ServiceTemplateModel.findOne({ active: true });
    }

    if (!template) {
      logger.error({ msg: "service.byShop.no_active_template", shopId: id });
      return res.status(500).json({ message: "Aucun template de service actif disponible pour créer un service" });
    }

    // 👇 On définit une couleur par défaut si absente
    const color = template.color || "#ff4081"; // Rose IzyGlam si non défini

    const newService = new ServiceModel({
      name: template.name,
      description: template.description,
      image: template.image,
      type: template.type,
      price: template.price,
      duration: template.duration,
      color: color,
      shopId: id,
    });

    await newService.save();

    logger.info({
      msg: "service.byShop.created_from_template",
      shopId: id,
      templateId: template._id?.toString(),
      serviceId: newService._id?.toString(),
    });
    console.log("Service créé automatiquement à partir du template");
    res.json([newService]);

  } catch (error) {
    console.error("Erreur dans getServicesByShop :", error);
    logger.error({
      msg: "service.byShop.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
      stack: (error as any)?.stack,
    });
    res.status(500).json({ message: "Erreur lors de la récupération ou de la création des services." });
  }
};

// Créer plusieurs services en une seule requête
const createMultipleServices = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.createMany.start",
      route: req.originalUrl,
      method: req.method,
      count: Array.isArray(req.body) ? req.body.length : undefined,
      bodyType: Array.isArray(req.body) ? "array" : typeof req.body,
    });
    const servicesArray = req.body; // Attends un tableau d'objets de services
    if (!Array.isArray(servicesArray)) {
      logger.warn({ msg: "service.createMany.invalid_body" });
      return res.status(400).json({ message: "Veuillez fournir un tableau de services." });
    }

    const newServices = await ServiceModel.insertMany(servicesArray);
    logger.info({
      msg: "service.createMany.success",
      created: newServices.length,
    });
    res.status(201).json(newServices);
  } catch (error) {
    logger.error({
      msg: "service.createMany.error",
      route: req.originalUrl,
      method: req.method,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Impossible de créer les services" });
  }
};



// Upload images to a service's gallery
const uploadGalleryImages = async (req: MulterRequest, res: Response) => {
  try {
    logger.info({
      msg: "service.gallery.upload.start",
      route: (req as any).originalUrl,
      method: (req as any).method,
      params: (req as any).params,
      fileMeta: req.file ? {
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      } : null,
    });
    const { id } = req.params;
    const file = req.file;  // Récupérer les fichiers uploadés via Multer
    console.log("id Gallery ===> " + id)
    console.log("file Gallery ===> " + file)
    if (!file) {
      logger.warn({ msg: "service.gallery.upload.no_file", id });
      return res.status(400).json({ message: "Aucune image uploadée" });
    }

    const service = await ServiceModel.findById(id);
    if (!service) {
      logger.warn({ msg: "service.gallery.upload.service_not_found", id });
      return res.status(404).json({ message: "Service non trouvée" });
    }

    // Extraire les noms des fichiers
    const imagePaths = `/uploads/images/articles/${file.filename}`;
    console.log("imagePaths : " + imagePaths);

    // Ajouter les chemins des fichiers à la galerie
    if (!service.image) {
      service.image = 'default.png';
    }
    service.image = imagePaths;
    console.log("shop.galleryImages : " + service.image);
    // Sauvegarder les chemins des fichiers dans la base de données
    await service.updateOne({ image: service.image });

    logger.info({
      msg: "service.gallery.upload.success",
      id,
      image: service.image,
    });
    res.status(200).json({ message: "Images uploadées avec succès", image: service.image });
  } catch (error: any) {
    console.error("Erreur upload image :", error);
    logger.error({
      msg: "service.gallery.upload.error",
      route: (req as any).originalUrl,
      method: (req as any).method,
      params: (req as any).params,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: "Erreur lors de l'upload de l'image du service",
      error: error.message,
    });
  }

};


// Get all gallery images for a specific shop
const getGalleryImages = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.gallery.get.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });
    const { id } = req.params;
    console.log("id ShopGallery : " + id);
    // Trouver le shop par son ID
    const service = await ServiceModel.findById(id);
    if (!service || !service.image) {
      logger.warn({ msg: "service.gallery.get.not_found", id });
      return res.status(404).json({ message: "Service ou image de la prestation non trouvée" });
    }

    logger.info({ msg: "service.gallery.get.success", id, hasImage: !!service.image });
    // Retourner les images de la galerie
    res.status(200).json({ image: service.image });
  } catch (error) {
    logger.error({
      msg: "service.gallery.get.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Erreur lors de la récupération des images de la prestation" });
  }
};

// Delete all services by shop ID
const deleteAllServicesByShop = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({
      msg: "service.deleteAllByShop.start",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
    });
    const { shopId } = req.params;
    const deletedServices = await ServiceModel.deleteMany({ shopId: shopId });

    logger.info({
      msg: "service.deleteAllByShop.result",
      shopId,
      deletedCount: deletedServices.deletedCount,
    });

    if (deletedServices.deletedCount > 0) {
      res.status(200).json({ message: `${deletedServices.deletedCount} services supprimés avec succès pour la boutique ${shopId}` });
    } else {
      logger.warn({ msg: "service.deleteAllByShop.none_found", shopId });
      res.status(404).json({ message: "Aucun service trouvé pour cette boutique" });
    }
  } catch (error) {
    logger.error({
      msg: "service.deleteAllByShop.error",
      route: req.originalUrl,
      method: req.method,
      params: req.params,
      errorMessage: (error as any)?.message,
    });
    res.status(500).json({ message: "Erreur lors de la suppression des services de la boutique" });
  }
};


// Petit helper CSV (sans lib externe)
function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Si contient ; " \n -> on quote et on échappe "
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const exportServicesCsvByShop = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    if (!shopId) return res.status(400).json({ message: "shopId manquant" });

    const services = await ServiceModel
      .find({ shopId })
      .sort({ createdAt: 1 })
      .select("name description description_original image type price duration color")
      .lean();

    // ⚠️ IMPORTANT : headers = même ordre et mêmes colonnes que les rows
    const headers = [
      "name",
      "description",
      "description_original",
      "price",
      "duration",
      "type",
      "color",
      "image",
    ];

    const lines: string[] = [];
    lines.push(headers.join(";"));

    for (const s of services) {
      const row = [
        csvEscape(s.name ?? ""),
        csvEscape(s.description ?? ""),
        csvEscape(s.description_original ?? ""),
        csvEscape(s.price ?? ""),
        csvEscape(s.duration ?? ""),
        csvEscape(s.type ?? "service"),
        csvEscape(s.color ?? "#ff4081"),
        csvEscape(s.image ?? ""),
      ];

      lines.push(row.join(";"));
    }

    const csvContent = "\uFEFF" + lines.join("\n");
    const filename = `services_${shopId}_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error("exportServicesCsvByShop error:", err);
    return res.status(500).json({ message: "Erreur export CSV" });
  }
};







// CSV helpers
function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}
function parseCsv(content: string, separator = ";") {
  // Parser simple (supporte guillemets "...")
  const rows: string[][] = [];
  let cur = "";
  let inQuotes = false;
  const row: string[] = [];

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    rows.push([...row]);
    row.length = 0;
  };

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (ch === '"') {
      // double quote => échappement
      const next = content[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === separator) {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      // gérer \r\n
      if (ch === "\r" && content[i + 1] === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  // dernière cellule/ligne
  pushCell();
  // éviter d'ajouter une ligne vide finale
  if (row.some((c) => c.trim() !== "")) pushRow();

  return rows;
}

function toNumber(value: string, field: string) {
  if (value === undefined || value === null) return NaN;
  const v = value.toString().trim().replace(",", "."); // support virgule
  const n = Number(v);
  return n;
}

const importServicesCsvByShop = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    if (!shopId) return res.status(400).json({ message: "shopId manquant" });

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "Fichier CSV manquant (field: csv)" });

    const raw = file.buffer.toString("utf-8").replace(/^\uFEFF/, "");

    const rows = parseCsv(raw, ";");
    if (rows.length < 2) {
      return res.status(400).json({ message: "CSV vide ou sans lignes de données" });
    }

    const headers = rows[0].map(normalizeHeader);

    const required = ["name", "description", "description_original", "price", "duration"];
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length) {
      return res.status(400).json({
        message: "Colonnes manquantes dans le CSV",
        missing,
        expected: required,
      });
    }

    const idx = (col: string) => headers.indexOf(col);
    const has = (col: string) => headers.includes(col);

    const toInsert: any[] = [];
    const errors: { line: number; error: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const line = rows[i];
      if (!line || line.every((c) => (c ?? "").trim() === "")) continue;

      // ✅ erreurs par ligne (sinon une erreur “contamine” tout le fichier)
      const rowErrors: string[] = [];

      const name = (line[idx("name")] ?? "").trim();
      const description = (line[idx("description")] ?? "").trim();
      const description_original = (line[idx("description_original")] ?? "").trim();

      const priceRaw = (line[idx("price")] ?? "").trim();
      const durationRaw = (line[idx("duration")] ?? "").trim();

      const price = toNumber(priceRaw, "price");
      const duration = toNumber(durationRaw, "duration");

      // colonnes optionnelles si présentes dans le CSV
      const typeRaw = has("type") ? (line[idx("type")] ?? "").trim() : "";
      const colorRaw = has("color") ? (line[idx("color")] ?? "").trim() : "";
      const imageRaw = has("image") ? (line[idx("image")] ?? "").trim() : "";

      if (!name) rowErrors.push("name vide");
      if (!description) rowErrors.push("description vide");
      if (!description_original) rowErrors.push("description_original vide");
      if (!Number.isFinite(price)) rowErrors.push(`price invalide: "${priceRaw}"`);
      if (!Number.isFinite(duration)) rowErrors.push(`duration invalide: "${durationRaw}"`);

      if (rowErrors.length) {
        for (const e of rowErrors) errors.push({ line: i + 1, error: e });
        continue;
      }

      toInsert.push({
        shopId, // ✅ important : rattacher au shop
        name,
        description,
        description_original,
        price,
        duration,

        type: typeRaw || "service",     // ✅ schema obligatoire
        color: colorRaw || "#ff4081",
        image: imageRaw || undefined,
      });
    }

    if (errors.length) {
      return res.status(400).json({
        message: "CSV invalide (erreurs de validation)",
        errors,
      });
    }

    if (!toInsert.length) {
      return res.status(400).json({ message: "Aucune ligne valide à importer" });
    }

    // ✅ insertion
    const inserted = await ServiceModel.insertMany(toInsert, { ordered: true });

    return res.status(200).json({
      message: "Import CSV OK",
      insertedCount: inserted.length,
    });
  } catch (err) {
    console.error("importServicesCsvByShop error:", err);
    return res.status(500).json({ message: "Erreur import CSV" });
  }
};



module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateServiceById,
  deleteServiceById,
  exportServicesCsvByShop,
  getServicesByShop,
  getServicesByShopAdmin,
  createMultipleServices,
  uploadGalleryImages,
  getGalleryImages,
  deleteAllServicesByShop,
  importServicesCsvByShop,
};
