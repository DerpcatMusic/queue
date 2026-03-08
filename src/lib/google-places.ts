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
    }>
  >(
    `${OSM_AUTOCOMPLETE_URL}?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(input)}`,
    {
      headers: {
        "Accept-Language": "en",
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

      const placeId = `osm:${item.place_id ?? display}`;
      fallbackPlaceCache.set(placeId, {
        latitude,
        longitude,
        formattedAddress: display,
      });

      const [mainText, ...rest] = display.split(", ");
      return {
        placeId,
        mainText: item.name?.trim() || mainText || display,
        secondaryText: rest.join(", "),
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
