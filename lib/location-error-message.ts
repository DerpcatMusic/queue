import type { LocationResolveErrorCode } from "@/lib/location-zone";

const LOCATION_ERROR_KEY_BY_CODE: Record<
  Exclude<LocationResolveErrorCode, "unsupported_platform" | "unknown">,
  string
> = {
  native_module_missing: "locationNativeMissing",
  permission_denied: "locationPermissionDenied",
  permission_blocked: "locationPermissionBlocked",
  services_disabled: "locationServicesDisabled",
  timeout: "locationTimeout",
  address_not_found: "locationAddressNotFound",
  outside_supported_zone: "locationOutsideSupportedZone",
};

export function getLocationResolveErrorMessage(input: {
  code: LocationResolveErrorCode | null;
  fallbackMessage: string | null;
  fallbackKey: string;
  translationPrefix: string;
  t: (key: string) => string;
}) {
  const mappedKey =
    input.code && input.code in LOCATION_ERROR_KEY_BY_CODE
      ? LOCATION_ERROR_KEY_BY_CODE[
          input.code as Exclude<LocationResolveErrorCode, "unsupported_platform" | "unknown">
        ]
      : null;

  if (mappedKey) {
    return input.t(`${input.translationPrefix}.${mappedKey}`);
  }

  return (
    input.fallbackMessage ??
    input.t(`${input.translationPrefix}.${input.fallbackKey}`)
  );
}
