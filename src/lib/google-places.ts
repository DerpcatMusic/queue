import { Platform } from "react-native";

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

const AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
const OSM_AUTOCOMPLETE_URL = "https://nominatim.openstreetmap.org/search";

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
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
  return true;
}

/// Fetches autocomplete predictions for the given input.
export async function fetchPlaceAutocomplete(
  input: string,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  if (!GOOGLE_PLACES_API_KEY) {
    const response = await fetch(
      `${OSM_AUTOCOMPLETE_URL}?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(trimmed)}`,
      {
        headers: {
          "Accept-Language": Platform.OS === "web" ? "en" : "en",
        },
      },
    );
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as Array<{
      place_id?: number;
      lat?: string;
      lon?: string;
      name?: string;
      display_name?: string;
    }>;

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

  const token = getOrCreateSessionToken();

  const response = await fetch(AUTOCOMPLETE_URL, {
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
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
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
  };

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
}

/// Fetches the coordinates for a given place ID.
export async function fetchPlaceCoordinates(
  placeId: string,
): Promise<PlaceCoordinates | null> {
  if (!placeId) {
    return null;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return fallbackPlaceCache.get(placeId) ?? null;
  }

  const token = getOrCreateSessionToken();
  resetPlacesSession();

  const url = `${PLACE_DETAILS_URL}/${placeId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "location,formattedAddress",
      ...(token ? { "X-Goog-Session-Token": token } : {}),
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    location?: { latitude: number; longitude: number };
    formattedAddress?: string;
  };

  if (!data.location) {
    return null;
  }

  return {
    latitude: data.location.latitude,
    longitude: data.location.longitude,
    formattedAddress: data.formattedAddress ?? "",
  };
}
