// src/services/proLeadImport.service.ts
import { logger } from "../utils/logger";
import ProLeadModel from "../models/proLead";
import CategoryModel from "../models/category";
import CompanyModel from "../models/company";
import {
  searchPlacesByText,
  getPlaceDetails,
} from "./googlePlacesService";

// Limite de lieux par (CP + catégorie)
const PER_CAT_CP_LIMIT = Number(
  process.env.PRO_PLACES_PER_CAT_CP ||
    process.env.PRO_PLACES_LIMIT_PER_POSTAL_CODE ||
    20
);

// nb d'employés minimum pour considérer une entreprise “intéressante”
const MIN_EMPLOYEES = Number(process.env.PRO_MIN_EMPLOYEES || 20);

// Mots-clés pour forcer le “à domicile” dans la requête
const DOMICILE_KEYWORDS: string[] = [
  "à domicile",
  "a domicile",
  "domicile",
  "a la maison",
  "à la maison",
  "home service",
  "home services",
  "se déplace",
  "se deplace",
  "à votre domicile",
  "a votre domicile",
];

// On réutilise la même liste de CP que pour les leads B2B
function getPostalCodesFromEnv(): string[] {
  const raw = process.env.B2B_POSTAL_CODES || "";
  return raw
    .split(",")
    .map((cp) => cp.trim())
    .filter((cp) => cp.length > 0);
}

export async function importProLeadsFromGooglePlaces() {
  const postalCodes = getPostalCodesFromEnv();

  if (postalCodes.length === 0) {
    logger.warn({
      msg: "importProLeadsFromGooglePlaces: no postal codes defined",
    });
    return;
  }

  // 🔹 Catégories actives (coiffure, massage, etc.)
  const activeCategories = await CategoryModel.find({ active: true }).sort({
    position: 1,
  });

  if (!activeCategories.length) {
    logger.warn({
      msg: "importProLeadsFromGooglePlaces: no active categories",
    });
  }

  // 🔹 Entreprises “intéressantes” (assez d’employés)
  const eligibleCompanies = await CompanyModel.find({
    nbEmployees: { $gte: MIN_EMPLOYEES },
  });

  const matchedCompanyIds = eligibleCompanies.map((c) => c._id.toString());
  const estimatedEmployees = eligibleCompanies.reduce(
    (sum, c) => sum + (c.nbEmployees || 0),
    0
  );

  logger.info({
    msg: "importProLeadsFromGooglePlaces started",
    postalCodes,
    perCatCpLimit: PER_CAT_CP_LIMIT,
    activeCategories: activeCategories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      filter: c.filter,
    })),
    eligibleCompaniesCount: eligibleCompanies.length,
    estimatedEmployees,
    minEmployees: MIN_EMPLOYEES,
  });

  // ===== Boucle principale =====
  for (const cp of postalCodes) {
    for (const cat of activeCategories) {
      const baseKeyword = (cat.filter || cat.name || "").trim();
      if (!baseKeyword) continue;

      let totalForCatCp = 0;

      for (const domKw of DOMICILE_KEYWORDS) {
        if (totalForCatCp >= PER_CAT_CP_LIMIT) break;

        const remaining = PER_CAT_CP_LIMIT - totalForCatCp;
        const query = `${baseKeyword} ${domKw} ${cp} France`;

        logger.info({
          msg: "Pro import: TextSearch query",
          postalCode: cp,
          category: cat.name,
          query,
          remainingLimit: remaining,
        });

        let places: any[] = [];
        try {
          places = await searchPlacesByText(query, remaining);
        } catch (error: any) {
          logger.error({
            msg: "Error in searchPlacesByText",
            postalCode: cp,
            category: cat.name,
            query,
            errorName: error?.name,
            errorMessage: error?.message,
            stack: error?.stack,
          });
          continue;
        }

        logger.info({
          msg: "Pro import: Google Places returned results",
          postalCode: cp,
          category: cat.name,
          query,
          count: places.length,
        });

        for (const place of places) {
          try {
            const details = await getPlaceDetails(place.place_id);

            const name = place.name;
            const address = details.address || place.formatted_address;
            const postalCode = details.postalCode || cp;
            const city = details.city;
            const website = details.website;
            const phone = details.phoneNumber;

            // ====== Construction du document ProLead ======
            const update: any = {
              googlePlaceId: place.place_id,
              name,
              address,
              postalCode,
              city,
              country: "FR",
              website,
              contactPhone: phone,
              source: "api",
              status: "new",
              matchedCompanies: matchedCompanyIds,
              estimatedEmployees:
                estimatedEmployees > 0 ? estimatedEmployees : undefined,
              categoryId: cat._id.toString(),
              categoryName: cat.name,
              categoryFilter: cat.filter,
              // optionnel : tags pour debug/tri
              tags: [baseKeyword, domKw, cp],
            };

            // Upsert basé sur googlePlaceId -> pas de doublons
            const lead = await ProLeadModel.findOneAndUpdate(
              { googlePlaceId: place.place_id },
              { $set: update },
              { new: true, upsert: true }
            );

            totalForCatCp++;

            logger.info({
              msg: "Pro lead upserted from Google Places",
              postalCode: cp,
              category: cat.name,
              query,
              leadId: lead?._id?.toString(),
              name,
            });

            if (totalForCatCp >= PER_CAT_CP_LIMIT) break;
          } catch (error: any) {
            logger.error({
              msg: "Failed to upsert Pro lead from place",
              postalCode: cp,
              category: cat.name,
              query,
              placeId: place.place_id,
              errorName: error?.name,
              errorMessage: error?.message,
              stack: error?.stack,
            });
          }
        }
      } // fin boucle domKw
    } // fin boucle catégories
  } // fin boucle CP

  logger.info({
    msg: "importProLeadsFromGooglePlaces finished",
  });
}
