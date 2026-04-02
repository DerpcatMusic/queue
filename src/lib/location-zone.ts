import { Platform } from "react-native";

import i18n from "@/i18n";
import { FetchRequestError, fetchJsonWithPolicy } from "@/lib/fetch-json";

export type ResolvedLocation = {
  address: string;
  latitude: number;
  longitude: number;
  zoneId: string;
  city?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
};

export type CurrentLocationSample = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  sampledAt: number;
  source: "current" | "last_known";
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
const ADDRESS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const addressResolutionCache = new Map<string, { data: ResolvedLocation; timestamp: number }>();
const reverseAddressCache = new Map<
  string,
  {
    data: {
      formattedAddress: string;
      city?: string;
      street?: string;
      streetNumber?: string;
      postalCode?: string;
    };
    timestamp: number;
  }
>();
const WEB_GEOCODER_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const WEB_GEOCODER_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const WEB_GEOCODER_TIMEOUT_MS = 12000;

function isFetchTimeout(error: unknown): boolean {
  return error instanceof FetchRequestError && error.code === "timeout";
}

function createLocationError(code: LocationResolveErrorCode, message: string) {
  return new LocationResolveError(code, message);
}

function locationMessage(key: string) {
  return i18n.t(key);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        createLocationError("timeout", locationMessage("profile.settings.errors.locationTimeout")),
      );
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

  const message =
    error instanceof Error
      ? error.message
      : locationMessage("profile.settings.errors.locationResolveFailed");

  const lowered = message.toLowerCase();
  if (lowered.includes("timeout")) {
    return createLocationError(
      "timeout",
      locationMessage("profile.settings.errors.locationTimeout"),
    );
  }

  if (lowered.includes("denied")) {
    return createLocationError(
      "permission_denied",
      locationMessage("profile.settings.errors.locationPermissionDenied"),
    );
  }

  if (lowered.includes("cannot find native module") && lowered.includes("expolocation")) {
    return createLocationError(
      "native_module_missing",
      locationMessage("profile.settings.errors.locationNativeMissing"),
    );
  }

  return createLocationError(
    "unknown",
    locationMessage("profile.settings.errors.locationResolveFailed"),
  );
}

async function getLocationModule() {
  if (!locationModulePromise) {
    locationModulePromise = import("expo-location").catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : locationMessage("profile.settings.errors.locationResolveFailed");
      throw createLocationError(
        "native_module_missing",
        `${locationMessage("profile.settings.errors.locationNativeMissing")} (${message})`,
      );
    });
  }

  return locationModulePromise;
}

async function geocodeAddressOnWeb(address: string): Promise<{
  latitude: number;
  longitude: number;
  city?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
}> {
  try {
    const url = `${WEB_GEOCODER_SEARCH_URL}?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;
    const results = await fetchJsonWithPolicy<
      Array<{
        lat?: string;
        lon?: string;
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
      {
        headers: {
          "Accept-Language": "he,en",
        },
      },
      { timeoutMs: WEB_GEOCODER_TIMEOUT_MS, retries: 1 },
    );

    const first = results[0];
    const latitude = Number.parseFloat(first?.lat ?? "");
    const longitude = Number.parseFloat(first?.lon ?? "");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw createLocationError(
        "address_not_found",
        locationMessage("profile.settings.errors.locationAddressNotFound"),
      );
    }

    const addr = first?.address;
    const city = addr?.city ?? addr?.town ?? addr?.village;
    const street = addr?.road;
    const streetNumber = addr?.house_number;
    const postalCode = addr?.postcode;

    return {
      latitude,
      longitude,
      ...(city !== undefined ? { city } : {}),
      ...(street !== undefined ? { street } : {}),
      ...(streetNumber !== undefined ? { streetNumber } : {}),
      ...(postalCode !== undefined ? { postalCode } : {}),
    };
  } catch (error) {
    if (isFetchTimeout(error)) {
      throw createLocationError(
        "timeout",
        locationMessage("profile.settings.errors.locationTimeout"),
      );
    }
    if (error instanceof FetchRequestError && error.code === "http") {
      throw createLocationError(
        "address_not_found",
        locationMessage("profile.settings.errors.locationAddressNotFound"),
      );
    }
    throw error;
  }
}

async function reverseGeocodeOnWeb(
  latitude: number,
  longitude: number,
): Promise<{
  formattedAddress: string;
  city?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
}> {
  try {
    const url = `${WEB_GEOCODER_REVERSE_URL}?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}&addressdetails=1`;
    const data = await fetchJsonWithPolicy<{
      display_name?: string;
      address?: {
        road?: string;
        footway?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        postcode?: string;
      };
    }>(
      url,
      {
        headers: {
          "Accept-Language": "he,en",
        },
      },
      { timeoutMs: WEB_GEOCODER_TIMEOUT_MS, retries: 1 },
    );
    const addr = data.address;
    const city = addr?.city ?? addr?.town ?? addr?.village;
    const street = addr?.road ?? addr?.footway;
    const streetNumber = addr?.house_number;
    const postalCode = addr?.postcode;
    return {
      formattedAddress:
        data.display_name?.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      ...(city !== undefined ? { city } : {}),
      ...(street !== undefined ? { street } : {}),
      ...(streetNumber !== undefined ? { streetNumber } : {}),
      ...(postalCode !== undefined ? { postalCode } : {}),
    };
  } catch {
    return { formattedAddress: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` };
  }
}

async function getCurrentCoordinatesOnWeb(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw createLocationError(
      "unsupported_platform",
      locationMessage("profile.settings.errors.locationUnsupportedPlatform"),
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
            reject(
              createLocationError(
                "permission_denied",
                locationMessage("profile.settings.errors.locationPermissionDenied"),
              ),
            );
            return;
          }
          if (error.code === error.TIMEOUT) {
            reject(
              createLocationError(
                "timeout",
                locationMessage("profile.settings.errors.locationTimeout"),
              ),
            );
            return;
          }
          reject(
            createLocationError(
              "services_disabled",
              locationMessage("profile.settings.errors.locationResolveFailed"),
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

async function getCurrentPositionSampleOnWeb(): Promise<CurrentLocationSample> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw createLocationError(
      "unsupported_platform",
      locationMessage("profile.settings.errors.locationUnsupportedPlatform"),
    );
  }

  return await withTimeout(
    new Promise<CurrentLocationSample>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : 999,
            sampledAt: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
            source: "current",
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(
              createLocationError(
                "permission_denied",
                locationMessage("profile.settings.errors.locationPermissionDenied"),
              ),
            );
            return;
          }
          if (error.code === error.TIMEOUT) {
            reject(
              createLocationError(
                "timeout",
                locationMessage("profile.settings.errors.locationTimeout"),
              ),
            );
            return;
          }
          reject(
            createLocationError(
              "services_disabled",
              locationMessage("profile.settings.errors.locationResolveFailed"),
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
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  postalCode?: string | null;
}) {
  const streetLine = [parts.streetNumber, parts.street].filter(Boolean).join(" ").trim();
  const cityLine = [parts.city, parts.postalCode].filter(Boolean).join(", ").trim();
  return [streetLine, cityLine].filter(Boolean).join(" | ");
}

async function ensureForegroundPermission(location: LocationModule) {
  const existingPermission = await location.getForegroundPermissionsAsync();
  if (existingPermission.status === "granted") {
    return;
  }

  if (existingPermission.canAskAgain === false) {
    throw createLocationError(
      "permission_blocked",
      locationMessage("profile.settings.errors.locationPermissionBlocked"),
    );
  }

  const requestedPermission = await location.requestForegroundPermissionsAsync();
  if (requestedPermission.status !== "granted") {
    if (requestedPermission.canAskAgain === false) {
      throw createLocationError(
        "permission_blocked",
        locationMessage("profile.settings.errors.locationPermissionBlocked"),
      );
    }
    throw createLocationError(
      "permission_denied",
      locationMessage("profile.settings.errors.locationPermissionDenied"),
    );
  }
}

async function resolveZoneOrThrow(latitude: number, longitude: number): Promise<string> {
  const findZoneIdForCoordinate = await getFindZoneIdForCoordinate();
  const zoneId = findZoneIdForCoordinate({ latitude, longitude });
  if (!zoneId) {
    throw createLocationError(
      "outside_supported_zone",
      locationMessage("profile.settings.errors.locationOutsideSupportedZone"),
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
            locationMessage("profile.settings.errors.locationUnsupportedPlatform"),
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
      throw createLocationError(
        "address_not_found",
        locationMessage("profile.settings.errors.addressRequired"),
      );
    }
    const normalizedAddress = address.toLowerCase();
    const cachedEntry = addressResolutionCache.get(normalizedAddress);
    if (cachedEntry && Date.now() - cachedEntry.timestamp <= ADDRESS_CACHE_TTL_MS) {
      return cachedEntry.data;
    }

    const geocoded =
      Platform.OS === "web"
        ? await geocodeAddressOnWeb(address)
        : await (async () => {
            const location = await getLocationModule();
            const result = await withTimeout(location.geocodeAsync(address), 12000);
            const first = result[0];
            if (!first) {
              throw createLocationError(
                "address_not_found",
                locationMessage("profile.settings.errors.locationAddressNotFound"),
              );
            }
            return { latitude: first.latitude, longitude: first.longitude };
          })();

    const zoneId = await resolveZoneOrThrow(geocoded.latitude, geocoded.longitude);
    // Structured address fields are only available on web geocoder (native geocode returns coords only)
    const geocodedWithAddress = geocoded as {
      latitude: number;
      longitude: number;
      city?: string;
      street?: string;
      streetNumber?: string;
      postalCode?: string;
    };
    const resolved: ResolvedLocation = {
      address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      zoneId,
      ...(geocodedWithAddress.city !== undefined ? { city: geocodedWithAddress.city } : {}),
      ...(geocodedWithAddress.street !== undefined ? { street: geocodedWithAddress.street } : {}),
      ...(geocodedWithAddress.streetNumber !== undefined
        ? { streetNumber: geocodedWithAddress.streetNumber }
        : {}),
      ...(geocodedWithAddress.postalCode !== undefined
        ? { postalCode: geocodedWithAddress.postalCode }
        : {}),
    };
    addressResolutionCache.set(normalizedAddress, { data: resolved, timestamp: Date.now() });
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
    let city: string | undefined;
    let street: string | undefined;
    let streetNumber: string | undefined;
    let postalCode: string | undefined;
    const cacheKey = toCoordinateCacheKey(input.latitude, input.longitude);

    if (input.includeAddress !== false) {
      const cachedEntry = reverseAddressCache.get(cacheKey);
      if (cachedEntry && Date.now() - cachedEntry.timestamp <= ADDRESS_CACHE_TTL_MS) {
        address = cachedEntry.data.formattedAddress;
        city = cachedEntry.data.city;
        street = cachedEntry.data.street;
        streetNumber = cachedEntry.data.streetNumber;
        postalCode = cachedEntry.data.postalCode;
      } else {
        if (Platform.OS === "web") {
          const result = await reverseGeocodeOnWeb(input.latitude, input.longitude);
          address = result.formattedAddress;
          city = result.city;
          street = result.street;
          streetNumber = result.streetNumber;
          postalCode = result.postalCode;
        } else {
          const location = await getLocationModule();
          const reverse = await withTimeout(
            location.reverseGeocodeAsync({
              latitude: input.latitude,
              longitude: input.longitude,
            }),
            12000,
          );
          const region = reverse[0];
          if (region) {
            address =
              formatAddress(region) ||
              `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
            city = region.city ?? undefined;
            street = region.street ?? undefined;
            streetNumber = region.streetNumber ? String(region.streetNumber) : undefined;
            postalCode = region.postalCode ?? undefined;
          }
        }
        reverseAddressCache.set(cacheKey, {
          data: {
            formattedAddress: address,
            ...(city !== undefined ? { city } : {}),
            ...(street !== undefined ? { street } : {}),
            ...(streetNumber !== undefined ? { streetNumber } : {}),
            ...(postalCode !== undefined ? { postalCode } : {}),
          },
          timestamp: Date.now(),
        });
      }
    }

    return {
      address,
      latitude: input.latitude,
      longitude: input.longitude,
      zoneId,
      ...(city !== undefined ? { city } : {}),
      ...(street !== undefined ? { street } : {}),
      ...(streetNumber !== undefined ? { streetNumber } : {}),
      ...(postalCode !== undefined ? { postalCode } : {}),
    };
  } catch (error) {
    throw normalizeLocationResolveError(error);
  }
}

async function getBestCurrentLocationSample(location: LocationModule): Promise<CurrentLocationSample> {
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
      accuracyMeters:
        typeof precisePosition.coords.accuracy === "number" ? precisePosition.coords.accuracy : 999,
      sampledAt: typeof precisePosition.timestamp === "number" ? precisePosition.timestamp : Date.now(),
      source: "current",
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
      accuracyMeters: typeof lastKnown.coords.accuracy === "number" ? lastKnown.coords.accuracy : 300,
      sampledAt: typeof lastKnown.timestamp === "number" ? lastKnown.timestamp : Date.now(),
      source: "last_known",
    };
  }

  throw preciseError;
}

export async function captureCurrentLocationSample(): Promise<CurrentLocationSample> {
  try {
    if (Platform.OS === "web") {
      return await getCurrentPositionSampleOnWeb();
    }

    const location = await getLocationModule();
    await ensureForegroundPermission(location);

    const servicesEnabled = await location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw createLocationError(
        "services_disabled",
        locationMessage("profile.settings.errors.locationServicesDisabled"),
      );
    }

    return await getBestCurrentLocationSample(location);
  } catch (error) {
    throw normalizeLocationResolveError(error);
  }
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
        locationMessage("profile.settings.errors.locationServicesDisabled"),
      );
    }

    const { latitude, longitude } = await getBestCurrentLocationSample(location);

    return await resolveCoordinatesToZone({
      latitude,
      longitude,
      includeAddress: true,
    });
  } catch (error) {
    throw normalizeLocationResolveError(error);
  }
}
