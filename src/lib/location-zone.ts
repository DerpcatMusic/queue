import { Platform } from "react-native";

import { FetchRequestError, fetchJsonWithPolicy } from "@/lib/fetch-json";

export type ResolvedLocation = {
  address: string;
  latitude: number;
  longitude: number;
  zoneId: string;
};

export type LocationResolveErrorCode =
  | "native_module_missing"
  | "permission_denied"
  | "permission_blocked"
  | "services_disabled"
  | "timeout"
  | "address_not_found"
  | "outside_supported_zone"
  | "unsupported_platform"
  | "unknown";

class LocationResolveError extends Error {
  code: LocationResolveErrorCode;

  constructor(code: LocationResolveErrorCode, message: string) {
    super(message);
    this.name = "LocationResolveError";
    this.code = code;
  }
}

export function isLocationResolveError(error: unknown): error is LocationResolveError {
  return error instanceof LocationResolveError;
}

type LocationModule = typeof import("expo-location");
type FindZoneIdForCoordinate = (point: { latitude: number; longitude: number }) => string | null;

let locationModulePromise: Promise<LocationModule> | null = null;
let findZoneIdForCoordinatePromise: Promise<FindZoneIdForCoordinate> | null = null;
const addressResolutionCache = new Map<string, ResolvedLocation>();
const reverseAddressCache = new Map<string, string>();
const WEB_GEOCODER_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const WEB_GEOCODER_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const WEB_GEOCODER_TIMEOUT_MS = 12000;

function isFetchTimeout(error: unknown): boolean {
  return error instanceof FetchRequestError && error.code === "timeout";
}

function createLocationError(code: LocationResolveErrorCode, message: string) {
  return new LocationResolveError(code, message);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createLocationError("timeout", "Location request timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function normalizeLocationResolveError(error: unknown): LocationResolveError {
  if (isLocationResolveError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown location error.";

  const lowered = message.toLowerCase();
  if (lowered.includes("timeout")) {
    return createLocationError("timeout", "Location request timed out.");
  }

  if (lowered.includes("denied")) {
    return createLocationError("permission_denied", "Location permission was denied.");
  }

  if (lowered.includes("cannot find native module") && lowered.includes("expolocation")) {
    return createLocationError(
      "native_module_missing",
      "Expo Location native module is unavailable. Rebuild and reinstall the dev client.",
    );
  }

  return createLocationError("unknown", message);
}

async function getLocationModule() {
  if (!locationModulePromise) {
    locationModulePromise = import("expo-location").catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown location module error";
      throw createLocationError(
        "native_module_missing",
        `Expo Location native module is unavailable. Rebuild/reinstall the Android app and relaunch the dev client. (${message})`,
      );
    });
  }

  return locationModulePromise;
}

async function geocodeAddressOnWeb(address: string): Promise<{
  latitude: number;
  longitude: number;
}> {
  try {
    const url = `${WEB_GEOCODER_SEARCH_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
    const results = await fetchJsonWithPolicy<
      Array<{
        lat?: string;
        lon?: string;
      }>
    >(
      url,
      {
        headers: {
          "Accept-Language": "en",
        },
      },
      { timeoutMs: WEB_GEOCODER_TIMEOUT_MS, retries: 1 },
    );

    const first = results[0];
    const latitude = Number.parseFloat(first?.lat ?? "");
    const longitude = Number.parseFloat(first?.lon ?? "");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw createLocationError("address_not_found", "Address not found.");
    }
    return { latitude, longitude };
  } catch (error) {
    if (isFetchTimeout(error)) {
      throw createLocationError("timeout", "Location request timed out.");
    }
    if (error instanceof FetchRequestError && error.code === "http") {
      throw createLocationError("address_not_found", "Address not found.");
    }
    throw error;
  }
}

async function reverseGeocodeOnWeb(latitude: number, longitude: number): Promise<string> {
  try {
    const url = `${WEB_GEOCODER_REVERSE_URL}?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;
    const data = await fetchJsonWithPolicy<{ display_name?: string }>(
      url,
      {
        headers: {
          "Accept-Language": "en",
        },
      },
      { timeoutMs: WEB_GEOCODER_TIMEOUT_MS, retries: 1 },
    );
    return data.display_name?.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  } catch {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
}

async function getCurrentCoordinatesOnWeb(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw createLocationError(
      "unsupported_platform",
      "Location lookup is not supported in this browser.",
    );
  }

  return await withTimeout(
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(createLocationError("permission_denied", "Location permission was denied."));
            return;
          }
          if (error.code === error.TIMEOUT) {
            reject(createLocationError("timeout", "Location request timed out."));
            return;
          }
          reject(
            createLocationError(
              "services_disabled",
              "Unable to determine current location from this browser.",
            ),
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 2 * 60 * 1000,
        },
      );
    }),
    18000,
  );
}

async function getFindZoneIdForCoordinate() {
  if (!findZoneIdForCoordinatePromise) {
    findZoneIdForCoordinatePromise = import("@/constants/zones-map").then(
      (module) => module.findZoneIdForCoordinate,
    );
  }
  return findZoneIdForCoordinatePromise;
}

function toCoordinateCacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
}

function formatAddress(parts: {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
}) {
  const lineOne = [parts.name, parts.streetNumber, parts.street].filter(Boolean).join(" ").trim();
  const lineTwo = [parts.city, parts.subregion, parts.region, parts.postalCode]
    .filter(Boolean)
    .join(", ")
    .trim();
  return [lineOne, lineTwo].filter(Boolean).join(" | ").trim();
}

async function ensureForegroundPermission(location: LocationModule) {
  const existingPermission = await location.getForegroundPermissionsAsync();
  if (existingPermission.status === "granted") {
    return;
  }

  if (existingPermission.canAskAgain === false) {
    throw createLocationError(
      "permission_blocked",
      "Location permission is blocked. Enable it in system settings.",
    );
  }

  const requestedPermission = await location.requestForegroundPermissionsAsync();
  if (requestedPermission.status !== "granted") {
    if (requestedPermission.canAskAgain === false) {
      throw createLocationError(
        "permission_blocked",
        "Location permission is blocked. Enable it in system settings.",
      );
    }
    throw createLocationError("permission_denied", "Location permission is required.");
  }
}

async function resolveZoneOrThrow(latitude: number, longitude: number): Promise<string> {
  const findZoneIdForCoordinate = await getFindZoneIdForCoordinate();
  const zoneId = findZoneIdForCoordinate({ latitude, longitude });
  if (!zoneId) {
    throw createLocationError(
      "outside_supported_zone",
      "Address is outside supported Pikud Haoref zones.",
    );
  }
  return zoneId;
}

export async function checkLocationRuntimeSupport(): Promise<{
  available: boolean;
  error?: LocationResolveError;
}> {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return {
          available: false,
          error: createLocationError(
            "unsupported_platform",
            "Location lookup is not supported in this browser.",
          ),
        };
      }
      return { available: true };
    }

    const location = await getLocationModule();
    await withTimeout(location.getProviderStatusAsync(), 5000);
    return { available: true };
  } catch (error) {
    return {
      available: false,
      error: normalizeLocationResolveError(error),
    };
  }
}

export async function resolveAddressToZone(addressInput: string): Promise<ResolvedLocation> {
  try {
    const address = addressInput.trim();
    if (!address) {
      throw createLocationError("address_not_found", "Address is required.");
    }
    const normalizedAddress = address.toLowerCase();
    const cached = addressResolutionCache.get(normalizedAddress);
    if (cached) {
      return cached;
    }

    const geocoded =
      Platform.OS === "web"
        ? await geocodeAddressOnWeb(address)
        : await (async () => {
            const location = await getLocationModule();
            const result = await withTimeout(location.geocodeAsync(address), 12000);
            const first = result[0];
            if (!first) {
              throw createLocationError("address_not_found", "Address not found.");
            }
            return first;
          })();

    const zoneId = await resolveZoneOrThrow(geocoded.latitude, geocoded.longitude);
    const resolved: ResolvedLocation = {
      address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      zoneId,
    };
    addressResolutionCache.set(normalizedAddress, resolved);
    return resolved;
  } catch (error) {
    throw normalizeLocationResolveError(error);
  }
}

export async function resolveCoordinatesToZone(input: {
  latitude: number;
  longitude: number;
  includeAddress?: boolean;
}): Promise<ResolvedLocation> {
  try {
    const zoneId = await resolveZoneOrThrow(input.latitude, input.longitude);

    let address = `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
    const cacheKey = toCoordinateCacheKey(input.latitude, input.longitude);

    if (input.includeAddress !== false) {
      const cachedReverseAddress = reverseAddressCache.get(cacheKey);
      if (cachedReverseAddress) {
        address = cachedReverseAddress;
      } else {
        if (Platform.OS === "web") {
          address = await reverseGeocodeOnWeb(input.latitude, input.longitude);
        } else {
          const location = await getLocationModule();
          const reverse = await withTimeout(
            location.reverseGeocodeAsync({
              latitude: input.latitude,
              longitude: input.longitude,
            }),
            12000,
          );
          address =
            formatAddress(reverse[0] ?? {}) ||
            `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
        }
        reverseAddressCache.set(cacheKey, address);
      }
    }

    return {
      address,
      latitude: input.latitude,
      longitude: input.longitude,
      zoneId,
    };
  } catch (error) {
    throw normalizeLocationResolveError(error);
  }
}

async function getBestCurrentCoordinates(location: LocationModule): Promise<{
  latitude: number;
  longitude: number;
}> {
  let preciseError: LocationResolveError | null = null;

  try {
    const precisePosition = await withTimeout(
      location.getCurrentPositionAsync({
        accuracy: location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      }),
      18000,
    );
    return {
      latitude: precisePosition.coords.latitude,
      longitude: precisePosition.coords.longitude,
    };
  } catch (error) {
    preciseError = normalizeLocationResolveError(error);
  }

  if (preciseError.code !== "timeout" && preciseError.code !== "unknown") {
    throw preciseError;
  }

  const lastKnown = await withTimeout(
    location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: 300,
    }),
    5000,
  );
  if (lastKnown) {
    return {
      latitude: lastKnown.coords.latitude,
      longitude: lastKnown.coords.longitude,
    };
  }

  throw preciseError;
}

export async function resolveCurrentLocationToZone(): Promise<ResolvedLocation> {
  try {
    if (Platform.OS === "web") {
      const { latitude, longitude } = await getCurrentCoordinatesOnWeb();
      return await resolveCoordinatesToZone({
        latitude,
        longitude,
        includeAddress: true,
      });
    }

    const location = await getLocationModule();
    await ensureForegroundPermission(location);

    const servicesEnabled = await location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw createLocationError(
        "services_disabled",
        "Location services are disabled on this device.",
      );
    }

    const { latitude, longitude } = await getBestCurrentCoordinates(location);

    return await resolveCoordinatesToZone({
      latitude,
      longitude,
      includeAddress: true,
    });
  } catch (error) {
    throw normalizeLocationResolveError(error);
  }
}
