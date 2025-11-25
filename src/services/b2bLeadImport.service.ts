import { logger } from "../utils/logger";
import B2BLeadModel from "../models/b2bLead";
import {
  searchPlacesByPostalCode,
  getPlaceDetails,
} from "./googlePlacesService";

const DEFAULT_LIMIT_PER_CP = Number(
  process.env.B2B_PLACES_LIMIT_PER_POSTAL_CODE || 20
);

function getPostalCodesFromEnv(): string[] {
  const raw = process.env.B2B_POSTAL_CODES || "";
  return raw
    .split(",")
    .map((cp) => cp.trim())
    .filter((cp) => cp.length > 0);
}

export async function importB2BLeadsFromGooglePlaces() {
  const postalCodes = getPostalCodesFromEnv();

  if (postalCodes.length === 0) {
    logger.warn({
      msg: "importB2BLeadsFromGooglePlaces: no postal codes defined",
    });
    return;
  }

  logger.info({
    msg: "importB2BLeadsFromGooglePlaces started",
    postalCodes,
    limitPerPostalCode: DEFAULT_LIMIT_PER_CP,
  });

  for (const cp of postalCodes) {
    try {
      const places = await searchPlacesByPostalCode(cp, DEFAULT_LIMIT_PER_CP);

      logger.info({
        msg: "Google Places returned results",
        postalCode: cp,
        count: places.length,
      });

      for (const place of places) {
        try {
          const details = await getPlaceDetails(place.place_id);

          const companyName = place.name;
          const address = details.address || place.formatted_address;
          const postalCode = details.postalCode || cp;
          const city = details.city;
          const website = details.website;
          const phone = details.phoneNumber;

          // Comme on n'a pas d'email, on ne remplit PAS contactEmail.
          // On pourra l'ajouter plus tard quand on enrichira les données.
          const update = {
            companyName,
            address,
            postalCode,
            city,
            country: "FR",
            website,
            contactPhone: phone,
            status: "new",
            source: "api",
          };

          // On évite les doublons (même companyName + postalCode)
          const lead = await B2BLeadModel.findOneAndUpdate(
            { companyName, postalCode },
            { $set: update },
            { new: true, upsert: true }
          );

          logger.info({
            msg: "B2B lead upserted from Google Places",
            postalCode: cp,
            leadId: lead?._id?.toString(),
            companyName,
          });
        } catch (error: any) {
          logger.error({
            msg: "Failed to upsert B2B lead from place",
            postalCode: cp,
            placeId: place.place_id,
            errorName: error?.name,
            errorMessage: error?.message,
            stack: error?.stack,
          });
        }
      }
    } catch (error: any) {
      logger.error({
        msg: "Error while processing postal code in importB2BLeadsFromGooglePlaces",
        postalCode: cp,
        errorName: error?.name,
        errorMessage: error?.message,
        stack: error?.stack,
      });
    }
  }

  logger.info({
    msg: "importB2BLeadsFromGooglePlaces finished",
  });
}
