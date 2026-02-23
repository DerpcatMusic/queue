# Expo Location Implementation Notes

Date: 2026-02-19

## Why `Cannot find native module 'ExpoLocation'` happens

This error means the JavaScript bundle can see `expo-location`, but the installed Android binary does not include the native module.

Common causes:

1. `expo-location` was added/changed after the current dev client was installed.
2. You are running `expo start --dev-client` with an old Android app binary.

## Required recovery steps

1. Remove the installed Android app if module mismatch persists:
   - `adb uninstall com.derpcat.queue`
2. Rebuild/reinstall the Android app binary (dev build):
   - `bunx expo run:android`
3. Then start Metro for the dev client:
   - `bun run android`

If using EAS dev builds, create/install a fresh dev build after native dependency/plugin changes.

## Added safeguards in app code

1. `src/lib/location-zone.ts`
   - Classifies location failures into typed error codes (`native_module_missing`, `permission_blocked`, `services_disabled`, etc.).
   - Adds runtime preflight (`checkLocationRuntimeSupport`) by calling `getProviderStatusAsync` with timeout.
2. `src/app/_layout.tsx`
   - Runs location preflight on native startup and shows deterministic rebuild guidance when native module is missing.
3. `scripts/android/doctor-windows.ps1`
   - Verifies Android package install and app version match on connected devices.
   - Prints explicit rebuild instructions when stale binaries are detected.

## Current app flow

Location and geocoding are centralized in `src/lib/location-zone.ts`:

1. Request foreground location permission.
2. For GPS:
   - Try high-accuracy foreground position (`Accuracy.Highest`) with timeout.
   - If high-accuracy request times out, fallback to `getLastKnownPositionAsync`.
3. For reverse geocoding:
   - Use `reverseGeocodeAsync` and normalize address formatting.
   - Cache reverse-geocode results by rounded coordinate key.
4. For address geocoding:
   - Use `geocodeAsync` and cache resolved addresses.
5. Map coordinates to zone via `findZoneIdForCoordinate(...)` from `src/constants/zones-map.ts`.
6. Return `{ address, latitude, longitude, zoneId }`.

## Resolver API contract

1. UI screens use `src/hooks/use-location-resolution.ts` for all location actions.
2. Each resolver call returns a structured result:
   - `ok: true` with resolved location data
   - `ok: false` with typed error code + message
3. This avoids stale state/race conditions when reading error codes after failed async calls.

## Deleted half-implementations

1. Removed duplicate profile GPS/address execution path and migrated profile to the shared resolver hook.
2. Removed web onboarding "demo pin" fallback that injected fake coordinates.
3. Centralized location error-to-translation mapping via `src/lib/location-error-message.ts`.

## Expo docs alignment (SDK 54)

Implementation aligns to Expo SDK 54 docs:

1. Permission flow uses `requestForegroundPermissionsAsync`.
2. Provider/service checks use `getProviderStatusAsync` and `hasServicesEnabledAsync`.
3. Position retrieval uses `getCurrentPositionAsync` with explicit accuracy.
4. Reverse geocoding uses `reverseGeocodeAsync` (foreground, user-triggered).
5. Native module changes require a new development build install.

Reference docs:

- `https://docs.expo.dev/versions/latest/sdk/location/`
- `https://docs.expo.dev/develop/development-builds/use-development-builds/`

## Zone-link behavior now

1. Instructor onboarding: detected GPS/address zone is auto-added to selected teaching zones.
2. Studio onboarding/profile: address or GPS resolves and stores the zone directly.
3. Instructor profile settings: detected zone auto-enables `includeDetectedZone` for save.
