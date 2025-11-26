// src/services/googlePlacesService.ts
import axios from "axios";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY as string;

if (!GOOGLE_PLACES_API_KEY) {
  throw new Error("GOOGLE_PLACES_API_KEY is not set in environment");
}

const TEXT_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

export interface GooglePlaceSummary {
  place_id: string;
  name: string;
  formatted_address: string;
}

// Petit helper pour next_page_token
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Coeur de la recherche texte (utilisé par searchPlacesByText & searchPlacesByPostalCode)
 */
async function textSearch(
  query: string,
  limit: number
): Promise<GooglePlaceSummary[]> {
  const results: GooglePlaceSummary[] = [];
  let nextPageToken: string | undefined;
  let page = 0;

  do {
    if (nextPageToken) {
      // Google demande ~2s avant d'utiliser next_page_token
      await wait(2000);
    }

    const params: any = {
      query,
      key: GOOGLE_PLACES_API_KEY,
      language: "fr",
    };
    if (nextPageToken) params.pagetoken = nextPageToken;

    const { data } = await axios.get(TEXT_SEARCH_URL, { params });

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(
        `TextSearch error: status=${data.status}, message=${data.error_message}`
      );
    }

    const pageResults: GooglePlaceSummary[] = (data.results || []).map(
      (r: any) => ({
        place_id: r.place_id,
        name: r.name,
        formatted_address: r.formatted_address,
      })
    );

    for (const r of pageResults) {
      if (results.length >= limit) break;
      results.push(r);
    }

    nextPageToken =
      results.length < limit ? data.next_page_token : undefined;
    page += 1;
  } while (nextPageToken && results.length < limit && page < 3); // max 3 pages

  return results;
}

/**
 * Recherche générique par texte (utilisée par le service Pro leads)
 * ex: "coiffure à domicile 44000 France"
 */
export async function searchPlacesByText(
  query: string,
  limit: number
): Promise<GooglePlaceSummary[]> {
  return textSearch(query, limit);
}

/**
 * Recherche par code postal (utilisée par le service B2B leads)
 * On fait juste un Text Search "44000 France"
 */
export async function searchPlacesByPostalCode(
  postalCode: string,
  limit: number
): Promise<GooglePlaceSummary[]> {
  const query = `${postalCode} France`;
  return textSearch(query, limit);
}

/**
 * Détails d'un lieu (utilisé par B2B et Pro)
 */
export async function getPlaceDetails(placeId: string): Promise<{
  address?: string;
  postalCode?: string;
  city?: string;
  website?: string;
  phoneNumber?: string;
}> {
  const params = {
    place_id: placeId,
    key: GOOGLE_PLACES_API_KEY,
    language: "fr",
    fields:
      "name,formatted_address,website,international_phone_number,address_component",
  };

  const { data } = await axios.get(DETAILS_URL, { params });

  if (data.status !== "OK") {
    throw new Error(
      `PlaceDetails error: status=${data.status}, message=${data.error_message}`
    );
  }

  const r = data.result || {};
  const components: any[] = r.address_components || [];

  const postalComp = components.find((c) =>
    c.types.includes("postal_code")
  );
  const cityComp = components.find((c) =>
    c.types.includes("locality")
  );

  return {
    address: r.formatted_address,
    postalCode: postalComp?.long_name,
    city: cityComp?.long_name,
    website: r.website,
    phoneNumber: r.international_phone_number,
  };
}
