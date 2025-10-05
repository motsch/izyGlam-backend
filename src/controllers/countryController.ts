import { Request, Response } from "express";
import Country from "../models/country";
import LanguageModel from "../models/language";
import { logger } from "../utils/logger";

// Helper: parse boolean proprement à partir de string/boolean
const toBool = (v: any): boolean | undefined => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (["true", "1", "yes", "y"].includes(s)) return true;
    if (["false", "0", "no", "n"].includes(s)) return false;
  }
  return undefined;
};

// -- util: éviter de logguer des secrets par erreur
function sanitize(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  const forbidden = ["password", "pwd", "token", "card", "cvv", "cvc", "iban", "authorization", "api_key", "apikey"];
  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      if (forbidden.includes(k.toLowerCase())) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    });
  };
  deep(clone);
  return clone;
}

// CREATE
export const createCountry = async (req: Request, res: Response) => {
  try {
    const { name, translation, active, languages } = req.body;

    if (!name || !translation) {
      logger.warn({
        msg: "createCountry bad request",
        route: "POST /api/country",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
      });
      return res.status(400).json({ message: "Champs requis: name, translation." });
    }

    // Nettoyage basique des langues
    const langs: string[] = Array.isArray(languages)
      ? languages
          .filter((l: any) => typeof l === "string")
          .map((l: string) => l.trim().toLowerCase())
      : [];

    const doc = await Country.create({
      name: name.trim(),
      translation: translation.trim(),
      active: toBool(active) ?? false,
      languages: langs,
    });

    logger.info({
      msg: "createCountry success",
      route: "POST /api/country",
      method: req.method,
      url: req.originalUrl,
      countryId: doc?._id?.toString(),
      body: sanitize(req.body),
    });

    return res.status(201).json(doc);
  } catch (err: any) {
    logger.error({
      msg: "createCountry failed",
      route: "POST /api/country",
      method: req.method,
      url: req.originalUrl,
      body: sanitize(req.body),
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// READ ALL (avec filtres simples ?active=true/false & recherche par nom)
export const getCountries = async (req: Request, res: Response) => {
  try {
    const { active, q } = req.query;

    const filter: any = {};
    const activeBool = toBool(active);
    if (typeof activeBool === "boolean") filter.active = activeBool;

    if (q && typeof q === "string" && q.trim()) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: "i" } },
        { translation: { $regex: q.trim(), $options: "i" } },
        { languages: { $elemMatch: { $regex: `^${q.trim().toLowerCase()}`, $options: "i" } } },
      ];
    }

    const items = await Country.find(filter).sort({ name: 1 });

    logger.info({
      msg: "getCountries success",
      route: "GET /api/country",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      count: items.length,
    });

    return res.json(items);
  } catch (err: any) {
    logger.error({
      msg: "getCountries failed",
      route: "GET /api/country",
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// READ ONE
export const getCountryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await Country.findById(id);
    if (!doc) {
      logger.warn({
        msg: "getCountryById not found",
        route: "GET /api/country/:id",
        method: req.method,
        url: req.originalUrl,
        countryId: id,
      });
      return res.status(404).json({ message: "Pays introuvable." });
    }

    logger.info({
      msg: "getCountryById success",
      route: "GET /api/country/:id",
      method: req.method,
      url: req.originalUrl,
      countryId: id,
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "getCountryById failed",
      route: "GET /api/country/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// UPDATE (name, translation, active, languages)
export const updateCountry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, translation, active, languages } = req.body;

    const updates: any = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof translation === "string") updates.translation = translation.trim();

    const activeBool = toBool(active);
    if (typeof activeBool === "boolean") updates.active = activeBool;

    if (Array.isArray(languages)) {
      updates.languages = languages
        .filter((l: any) => typeof l === "string")
        .map((l: string) => l.trim().toLowerCase());
    }

    const doc = await Country.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!doc) {
      logger.warn({
        msg: "updateCountry not found",
        route: "PUT /api/country/:id",
        method: req.method,
        url: req.originalUrl,
        countryId: id,
        body: sanitize(req.body),
      });
      return res.status(404).json({ message: "Pays introuvable." });
    }

    logger.info({
      msg: "updateCountry success",
      route: "PUT /api/country/:id",
      method: req.method,
      url: req.originalUrl,
      countryId: id,
      body: sanitize(req.body),
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "updateCountry failed",
      route: "PUT /api/country/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// DELETE
export const deleteCountry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await Country.findByIdAndDelete(id);
    if (!doc) {
      logger.warn({
        msg: "deleteCountry not found",
        route: "DELETE /api/country/:id",
        method: req.method,
        url: req.originalUrl,
        countryId: id,
      });
      return res.status(404).json({ message: "Pays introuvable." });
    }

    logger.info({
      msg: "deleteCountry success",
      route: "DELETE /api/country/:id",
      method: req.method,
      url: req.originalUrl,
      countryId: id,
    });

    return res.json({ message: "Pays supprimé avec succès." });
  } catch (err: any) {
    logger.error({
      msg: "deleteCountry failed",
      route: "DELETE /api/country/:id",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// ACTIVER/DÉSACTIVER rapidement (endpoint dédié)
export const setCountryActive = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // on accepte active dans body ou query
    const activeSource = (req.body as any)?.active ?? (req.query as any)?.active;
    const activeBool = toBool(activeSource);

    if (typeof activeBool !== "boolean") {
      logger.warn({
        msg: "setCountryActive bad request (active invalid)",
        route: "PATCH /api/country/:id/active",
        method: req.method,
        url: req.originalUrl,
        body: sanitize(req.body),
        query: req.query,
      });
      return res.status(400).json({ message: "Paramètre 'active' invalide (true/false)." });
    }

    const doc = await Country.findByIdAndUpdate(id, { active: activeBool }, { new: true });
    if (!doc) {
      logger.warn({
        msg: "setCountryActive not found",
        route: "PATCH /api/country/:id/active",
        method: req.method,
        url: req.originalUrl,
        countryId: id,
      });
      return res.status(404).json({ message: "Pays introuvable." });
    }

    logger.info({
      msg: "setCountryActive success",
      route: "PATCH /api/country/:id/active",
      method: req.method,
      url: req.originalUrl,
      countryId: id,
      active: activeBool,
    });

    return res.json(doc);
  } catch (err: any) {
    logger.error({
      msg: "setCountryActive failed",
      route: "PATCH /api/country/:id/active",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: sanitize(req.body),
      query: req.query,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// Helper pour échapper un nom dans une RegExp
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /country/name/:name/languages
 * Options:
 *   - ?includeInactive=true  -> inclut aussi les langues inactives
 *
 * Réponse:
 * {
 *   countryId: string,
 *   name: string,
 *   languages: Array<{ _id, code, name, flag, trad, active }>,
 *   missingCodes: string[]   // codes présents dans Country.languages mais absents de Language
 * }
 */
export const getLanguagesByCountryName = async (req: Request, res: Response) => {
  try {
    const raw = (req.params.name || "").trim();
    if (!raw) {
      logger.warn({
        msg: "getLanguagesByCountryName bad request (name missing)",
        route: "GET /api/country/name/:name/languages",
        method: req.method,
        url: req.originalUrl,
        params: req.params,
      });
      return res.status(400).json({ message: "Paramètre 'name' requis." });
    }

    const includeInactive =
      typeof req.query.includeInactive === "string"
        ? ["true", "1", "yes", "y"].includes(req.query.includeInactive.toLowerCase().trim())
        : false;

    // Match exact insensible à la casse sur le champ 'name' puis fallback sur 'translation'
    const nameRegex = new RegExp(`^${escapeRegExp(raw)}$`, "i");

    let country = await Country.findOne({ name: nameRegex }).lean();
    if (!country) {
      country = await Country.findOne({ translation: nameRegex }).lean();
    }

    if (!country) {
      logger.warn({
        msg: "getLanguagesByCountryName not found",
        route: "GET /api/country/name/:name/languages",
        method: req.method,
        url: req.originalUrl,
        searchedName: raw,
      });
      return res.status(404).json({ message: `Pays '${raw}' introuvable.` });
    }

    const codes = Array.isArray(country.languages)
      ? [...new Set(country.languages.map((c: any) => String(c).trim().toLowerCase()))]
      : [];

    if (codes.length === 0) {
      logger.info({
        msg: "getLanguagesByCountryName no codes",
        route: "GET /api/country/name/:name/languages",
        method: req.method,
        url: req.originalUrl,
        countryId: country._id?.toString(),
        codesCount: 0,
      });
      return res.json({
        countryId: country._id,
        name: country.name,
        languages: [],
        missingCodes: [],
      });
    }

    // Filtre sur Language.code IN codes + active si demandé
    const langFilter: any = { code: { $in: codes } };
    if (!includeInactive) {
      langFilter.active = true;
    }

    const langs = await LanguageModel.find(langFilter).lean();

    // Ordonner selon l'ordre des codes dans country.languages
    const orderMap = new Map<string, number>();
    codes.forEach((c, idx) => orderMap.set(c, idx));

    const sortedLangs = langs
      .map((l: any) => ({ ...l, code: String(l.code).toLowerCase() }))
      .sort((a: any, b: any) => {
        const ia = orderMap.get(a.code) ?? Number.MAX_SAFE_INTEGER;
        const ib = orderMap.get(b.code) ?? Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    // Déterminer les codes manquants en base Language (pour seed i18n)
    const foundCodes = new Set(sortedLangs.map((l: any) => l.code));
    const missingCodes = codes.filter((c) => !foundCodes.has(c));

    logger.info({
      msg: "getLanguagesByCountryName success",
      route: "GET /api/country/name/:name/languages",
      method: req.method,
      url: req.originalUrl,
      countryId: country._id?.toString(),
      includeInactive,
      returned: sortedLangs.length,
      missing: missingCodes.length,
    });

    return res.json({
      countryId: country._id,
      name: country.name,
      languages: sortedLangs, // objets complets Language
      missingCodes,
    });
  } catch (err: any) {
    logger.error({
      msg: "getLanguagesByCountryName failed",
      route: "GET /api/country/name/:name/languages",
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};
