import { Platform } from "react-native";

import { fetchJsonWithPolicy } from "@/lib/fetch-json";

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
const OSM_AUTOCOMPLETE_URL = "https://nominatim.openstreetmap.org/search";
const OSM_AUTOCOMPLETE_TIMEOUT_MS = 8000;
const GOOGLE_AUTOCOMPLETE_TIMEOUT_MS = 7000;
const PLACE_DETAILS_TIMEOUT_MS = 8000;

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

export type PlaceCoordinates = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
};

let sessionToken: string | null = null;
const fallbackPlaceCache = new Map<string, PlaceCoordinates>();

function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getOrCreateSessionToken(): string {
  if (!sessionToken) {
    sessionToken = generateSessionToken();
  }
  return sessionToken;
}

/// Resets the session token after a place is selected.
export function resetPlacesSession(): void {
  sessionToken = null;
}

/// Returns `true` if the Google Places API key is configured.
export function isGooglePlacesConfigured(): boolean {
  return Boolean(GOOGLE_PLACES_API_KEY);
}

async function fetchOsmAutocomplete(input: string): Promise<PlacePrediction[]> {
  const data = await fetchJsonWithPolicy<
    Array<{
      place_id?: number;
      lat?: string;
      lon?: string;
      name?: string;
      display_name?: string;
      address?: {
        road?: string;
        footway?: string;
        path?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        postcode?: string;
      };
    }>
  >(
    `${OSM_AUTOCOMPLETE_URL}?format=jsonv2&limit=6&addressdetails=1&countrycodes=il&q=${encodeURIComponent(input)}`,
    {
      headers: {
        "Accept-Language": "he,en",
      },
    },
    { timeoutMs: OSM_AUTOCOMPLETE_TIMEOUT_MS, retries: 1 },
  );

  return data
    .map((item): PlacePrediction | null => {
      const latitude = Number.parseFloat(item.lat ?? "");
      const longitude = Number.parseFloat(item.lon ?? "");
      const display = item.display_name?.trim();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !display) {
        return null;
      }

      // Extract structured address parts from OSM addressdetails
      const addr = item.address;
      const city = addr?.city ?? addr?.town ?? addr?.village ?? undefined;
      const street = addr?.road ?? addr?.footway ?? addr?.path ?? undefined;
      const streetNumber = addr?.house_number ?? undefined;
      const postalCode = addr?.postcode ?? undefined;

      const placeId = `osm:${item.place_id ?? display}`;

      // Build a clean secondary text: city + postal code (not the full display_name)
      const secondaryParts = [city, postalCode].filter(Boolean);
      const secondaryText = secondaryParts.join(", ") || undefined;

      // mainText = street + number, or name, or first part of display
      const [firstPart] = display.split(", ");
      const mainText =
        street && streetNumber
          ? `${streetNumber} ${street}`
          : (item.name?.trim() ?? firstPart ?? display);

      // Only include optional fields when they have values (exactOptionalPropertyTypes)
      const cacheEntry: PlaceCoordinates = {
        latitude,
        longitude,
        formattedAddress: display,
        ...(city !== undefined ? { city } : {}),
        ...(street !== undefined ? { street } : {}),
        ...(streetNumber !== undefined ? { streetNumber } : {}),
        ...(postalCode !== undefined ? { postalCode } : {}),
      };
      fallbackPlaceCache.set(placeId, cacheEntry);

      return {
        placeId,
        mainText,
        secondaryText: secondaryText ?? "",
        fullText: display,
      };
    })
    .filter((item): item is PlacePrediction => item !== null);
}

/// Fetches autocomplete predictions for the given input.
export async function fetchPlaceAutocomplete(input: string): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  if (!GOOGLE_PLACES_API_KEY) {
    try {
      return await fetchOsmAutocomplete(trimmed);
    } catch {
      return [];
    }
  }

  const token = getOrCreateSessionToken();

  try {
    const data = await fetchJsonWithPolicy<{
      suggestions?: {
        placePrediction?: {
          placeId: string;
          text?: { text: string };
          structuredFormat?: {
            mainText?: { text: string };
            secondaryText?: { text: string };
          };
        };
      }[];
    }>(
      AUTOCOMPLETE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify({
          input: trimmed,
          sessionToken: token,
          includedRegionCodes: ["il"],
          languageCode: Platform.OS === "web" ? "en" : undefined,
        }),
      },
      { timeoutMs: GOOGLE_AUTOCOMPLETE_TIMEOUT_MS, retries: 1 },
    );

    if (!data.suggestions) {
      return [];
    }

    return data.suggestions
      .map((suggestion) => {
        const pred = suggestion.placePrediction;
        if (!pred?.placeId) return null;
        return {
          placeId: pred.placeId,
          mainText: pred.structuredFormat?.mainText?.text ?? "",
          secondaryText: pred.structuredFormat?.secondaryText?.text ?? "",
          fullText: pred.text?.text ?? "",
        };
      })
      .filter((item): item is PlacePrediction => item !== null);
  } catch {
    try {
      return await fetchOsmAutocomplete(trimmed);
    } catch {
      return [];
    }
  }
}

/// Fetches the coordinates for a given place ID.
export async function fetchPlaceCoordinates(placeId: string): Promise<PlaceCoordinates | null> {
  if (!placeId) {
    return null;
  }

  if (placeId.startsWith("osm:")) {
    return fallbackPlaceCache.get(placeId) ?? null;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return fallbackPlaceCache.get(placeId) ?? null;
  }

  const token = getOrCreateSessionToken();
  resetPlacesSession();

  const url = `${PLACE_DETAILS_URL}/${placeId}`;
  try {
    const data = await fetchJsonWithPolicy<{
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
    }>(
      url,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "location,formattedAddress",
          ...(token ? { "X-Goog-Session-Token": token } : {}),
        },
      },
      { timeoutMs: PLACE_DETAILS_TIMEOUT_MS, retries: 1 },
    );

    if (!data.location) {
      return null;
    }

    return {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      formattedAddress: data.formattedAddress ?? "",
    };
  } catch {
    return null;
  }
}

export type ZipCodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
};

/// Looks up Israeli addresses by postal code using OSM Nominatim.
/// Returns multiple results when a postal code spans multiple streets/cities.
export async function fetchPlaceByZipCode(zipCode: string): Promise<ZipCodeResult[]> {
  const cleaned = zipCode.replace(/\s+/g, "").trim();
  if (!cleaned || cleaned.length < 5) {
    return [];
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&countrycodes=il&postcode=${encodeURIComponent(cleaned)}`;
  try {
    const data = await fetchJsonWithPolicy<
      Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: {
          road?: string;
          house_number?: string;
          city?: string;
          town?: string;
          village?: string;
          postcode?: string;
        };
      }>
    >(
      url,
      { headers: { "Accept-Language": "he,en" } },
      { timeoutMs: OSM_AUTOCOMPLETE_TIMEOUT_MS, retries: 1 },
    );

    return data
      .map((item): ZipCodeResult | null => {
        const latitude = Number.parseFloat(item.lat ?? "");
        const longitude = Number.parseFloat(item.lon ?? "");
        const display = item.display_name?.trim();
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !display) {
          return null;
        }
        const addr = item.address;
        const city = addr?.city ?? addr?.town ?? addr?.village;
        const street = addr?.road;
        const streetNumber = addr?.house_number;
        const postalCode = addr?.postcode;
        return {
          latitude,
          longitude,
          formattedAddress: display,
          ...(city !== undefined ? { city } : {}),
          ...(street !== undefined ? { street } : {}),
          ...(streetNumber !== undefined ? { streetNumber } : {}),
          ...(postalCode !== undefined ? { postalCode } : {}),
        };
      })
      .filter((item): item is ZipCodeResult => item !== null);
  } catch {
    return [];
  }
}
