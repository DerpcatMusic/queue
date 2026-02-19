import { findZoneIdForCoordinate } from "@/constants/zones-map";
import { Platform } from "react-native";

export type ResolvedLocation = {
  address: string;
  latitude: number;
  longitude: number;
  zoneId: string;
};

type LocationModule = typeof import("expo-location");

let locationModulePromise: Promise<LocationModule> | null = null;

async function getLocationModule() {
  if (Platform.OS === "web") {
    throw new Error("Location lookup is not supported on web.");
  }

  if (!locationModulePromise) {
    locationModulePromise = import("expo-location");
  }

  return locationModulePromise;
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
  const lineOne = [parts.name, parts.streetNumber, parts.street]
    .filter(Boolean)
    .join(" ")
    .trim();
  const lineTwo = [parts.city, parts.subregion, parts.region, parts.postalCode]
    .filter(Boolean)
    .join(", ")
    .trim();
  return [lineOne, lineTwo].filter(Boolean).join(" • ").trim();
}

async function ensureForegroundPermission(location: LocationModule) {
  const existingPermission = await location.getForegroundPermissionsAsync();
  if (existingPermission.status === "granted") {
    return;
  }

  if (existingPermission.canAskAgain === false) {
    throw new Error("Location permission is required.");
  }

  const requestedPermission = await location.requestForegroundPermissionsAsync();
  if (requestedPermission.status !== "granted") {
    throw new Error("Location permission is required.");
  }
}

function resolveZoneOrThrow(latitude: number, longitude: number): string {
  const zoneId = findZoneIdForCoordinate({ latitude, longitude });
  if (!zoneId) {
    throw new Error("Address is outside supported Pikud Haoref zones.");
  }
  return zoneId;
}

export async function resolveAddressToZone(addressInput: string): Promise<ResolvedLocation> {
  const address = addressInput.trim();
  if (!address) {
    throw new Error("Address is required.");
  }

  const location = await getLocationModule();
  const geocoded = await location.geocodeAsync(address);
  const first = geocoded[0];
  if (!first) {
    throw new Error("Address not found.");
  }

  const zoneId = resolveZoneOrThrow(first.latitude, first.longitude);
  return {
    address,
    latitude: first.latitude,
    longitude: first.longitude,
    zoneId,
  };
}

export async function resolveCurrentLocationToZone(): Promise<ResolvedLocation> {
  const location = await getLocationModule();
  await ensureForegroundPermission(location);

  const position = await location.getCurrentPositionAsync({
    accuracy: location.Accuracy.Balanced,
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const zoneId = resolveZoneOrThrow(latitude, longitude);

  const reverse = await location.reverseGeocodeAsync({ latitude, longitude });
  const label =
    formatAddress(reverse[0] ?? {}) ||
    `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  return {
    address: label,
    latitude,
    longitude,
    zoneId,
  };
}
