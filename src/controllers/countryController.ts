import { Request, Response } from "express";
import Country from "../models/country";
import LanguageModel from "../models/language";

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

// CREATE
export const createCountry = async (req: Request, res: Response) => {
  try {
    const { name, translation, active, languages } = req.body;

    if (!name || !translation) {
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

    return res.status(201).json(doc);
  } catch (err: any) {
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
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// READ ONE
export const getCountryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await Country.findById(id);
    if (!doc) return res.status(404).json({ message: "Pays introuvable." });
    return res.json(doc);
  } catch (err: any) {
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
    if (!doc) return res.status(404).json({ message: "Pays introuvable." });
    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// DELETE
export const deleteCountry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await Country.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ message: "Pays introuvable." });
    return res.json({ message: "Pays supprimé avec succès." });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};

// ACTIVER/DÉSACTIVER rapidement (endpoint dédié)
export const setCountryActive = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // on accepte active dans body ou query
    const activeSource = req.body?.active ?? req.query?.active;
    const activeBool = toBool(activeSource);

    if (typeof activeBool !== "boolean") {
      return res.status(400).json({ message: "Paramètre 'active' invalide (true/false)." });
    }

    const doc = await Country.findByIdAndUpdate(id, { active: activeBool }, { new: true });
    if (!doc) return res.status(404).json({ message: "Pays introuvable." });
    return res.json(doc);
  } catch (err: any) {
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
      return res.status(404).json({ message: `Pays '${raw}' introuvable.` });
    }

    const codes = Array.isArray(country.languages)
      ? [...new Set(country.languages.map((c: any) => String(c).trim().toLowerCase()))]
      : [];

    if (codes.length === 0) {
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
      .map(l => ({ ...l, code: String(l.code).toLowerCase() }))
      .sort((a, b) => {
        const ia = orderMap.get(a.code) ?? Number.MAX_SAFE_INTEGER;
        const ib = orderMap.get(b.code) ?? Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        // fallback lexicographique par nom
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    // Déterminer les codes manquants en base Language (pour seed i18n)
    const foundCodes = new Set(sortedLangs.map(l => l.code));
    const missingCodes = codes.filter(c => !foundCodes.has(c));

    return res.json({
      countryId: country._id,
      name: country.name,
      languages: sortedLangs, // objets complets Language
      missingCodes,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message ?? "Erreur serveur" });
  }
};