import axios from "axios";
import { logger } from "../utils/logger";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  logger.warn({
    msg: "GOOGLE_PLACES_API_KEY is not defined in environment variables",
  });
}

// extraction simple du CP dans l'adresse (pattern FR: 5 chiffres)
function extractPostalCode(address?: string): string | undefined {
  if (!address) return undefined;
  const match = address.match(/\b\d{5}\b/);
  return match ? match[0] : undefined;
}

// extrait une ville très simple depuis l'adresse (ça restera approximatif)
function extractCity(address?: string): string | undefined {
  if (!address) return undefined;
  // Exemple d'adresse : "12 Rue de Paris, 44000 Nantes, France"
  const parts = address.split(",");
  if (parts.length >= 2) {
    return parts[1].trim(); // "44000 Nantes" -> pas parfait mais suffisant pour début
  }
  return undefined;
}

export interface GooglePlaceResult {
  name: string;
  formatted_address?: string;
  place_id: string;
}

// Recherche des entreprises par code postal via Text Search
export async function searchPlacesByPostalCode(
  postalCode: string,
  limit: number
): Promise<GooglePlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    logger.error({
      msg: "searchPlacesByPostalCode: missing GOOGLE_PLACES_API_KEY",
    });
    return [];
  }

  try {
    const url = "https://maps.googleapis.com/maps/api/place/textsearch/json";

    // On cible des "entreprises" en général, par code postal, en France
    const params = {
      key: GOOGLE_PLACES_API_KEY,
      query: `entreprise ${postalCode} France`,
      language: "fr",
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      logger.warn({
        msg: "Google Places Text Search returned non-OK status",
        status: response.data.status,
        error_message: response.data.error_message,
        postalCode,
      });
    }

    const results: GooglePlaceResult[] = (response.data.results || []).map(
      (item: any) => ({
        name: item.name,
        formatted_address: item.formatted_address,
        place_id: item.place_id,
      })
    );

    // On tronque à "limit"
    return results.slice(0, limit);
  } catch (error: any) {
    logger.error({
      msg: "searchPlacesByPostalCode failed",
      postalCode,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return [];
  }
}

// Récupère les détails (site web, téléphone...) pour un place_id
export async function getPlaceDetails(placeId: string): Promise<{
  website?: string;
  phoneNumber?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}> {
  if (!GOOGLE_PLACES_API_KEY) {
    return {};
  }

  try {
    const url = "https://maps.googleapis.com/maps/api/place/details/json";

    const params = {
      key: GOOGLE_PLACES_API_KEY,
      place_id: placeId,
      language: "fr",
      fields:
        "name,formatted_address,website,formatted_phone_number,address_components",
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== "OK") {
      logger.warn({
        msg: "getPlaceDetails non-OK status",
        status: response.data.status,
        error_message: response.data.error_message,
        placeId,
      });
      return {};
    }

    const result = response.data.result;

    const address: string | undefined = result.formatted_address;
    const postalCode = extractPostalCode(address);
    const city = extractCity(address);

    return {
      website: result.website,
      phoneNumber: result.formatted_phone_number,
      address,
      postalCode,
      city,
    };
  } catch (error: any) {
    logger.error({
      msg: "getPlaceDetails failed",
      placeId,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return {};
  }
}
