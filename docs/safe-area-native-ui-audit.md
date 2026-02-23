# Safe Area and Native UI Audit (Expo SDK 54)

Date: 2026-02-19  
Scope: `Queue/src/app/(tabs)` and shared inset hook

## What was fixed

1. Standardized tab-safe bottom spacing in `Queue/src/hooks/use-native-tab-layout.ts`.
2. Added a new `bottomOverlayInset` (tab-safe bottom + extra breathing room) for floating controls.
3. Updated floating buttons that were clipping under the native tab bar:
   - `Queue/src/app/(tabs)/map.tsx` (`selectFab`)
   - `Queue/src/app/(tabs)/jobs/index.tsx` (`archiveFab`)
4. Stopped FAB/content collision when archive sheet is open:
   - `Queue/src/app/(tabs)/jobs/index.tsx` hides FAB while archive overlay is visible.
5. Fixed calendar sync-error banner clipping under tab bar:
   - `Queue/src/app/(tabs)/calendar/index.tsx` now anchors banner using `bottomOverlayInset`.
6. Fixed top-notch/status-bar overlap in shared parallax header:
   - `Queue/src/components/parallax-scroll-view.tsx` now uses safe-area top inset.
7. Disabled NativeTabs automatic content insets for all tab triggers and kept one manual inset system:
   - `Queue/src/app/(tabs)/_layout.tsx` (`disableAutomaticContentInsets` on each trigger).

## Why clipping happened

`react-native-safe-area-context` bottom inset only represents hardware/gesture safe area.  
Native tabs add additional UI height above that inset. Anchoring overlays to only `insets.bottom` can place controls under the tab bar.

## Current spacing model

- `safeBottomInset`: hardware/gesture inset only.
- `bottomInset`: `safeBottomInset + native tab bar height estimate`.
- `bottomOverlayInset`: `bottomInset + overlay gap` for FAB-like controls.

This keeps scroll content and floating controls from fighting the tab bar.

### NativeTabs constraint note

Expo Router NativeTabs on SDK 54 does not expose runtime tab-bar height to JS.  
To avoid clipping on modern iOS/Android tab styles, the shared hook now uses conservative tab-height estimates:

- iOS (legacy): `52`
- iOS (modern): `64`
- Android: `64`

## Duplicate / unnecessary patterns found

1. Repeated per-screen bottom spacing logic (`paddingBottom` / `bottom`) across tabs.
   - Mitigation: centralize in `useNativeTabLayout` (partially completed by this change).
2. Mixed use of `useSafeAreaInsets()` and `useNativeTabLayout()` for top/bottom in same screens.
   - Recommendation: use `useNativeTabLayout` for tab-aware layout, and raw `useSafeAreaInsets()` only when explicitly needed (for custom status scrims).
3. Multiple floating action buttons re-implement similar offset behavior.
   - Recommendation: create a shared `FloatingActionAnchor` style/helper that consumes `bottomOverlayInset`.
4. Similar local chip components exist in multiple tabs (for example jobs/profile variants).
   - Recommendation: extract a shared chip primitive to avoid parallel UI drift.

## Frontend Pass Findings (Prioritized)

1. High: tab-safe overlays and banners previously used plain fixed bottoms.
   - Status: fixed for jobs/map/calendar in this pass.
2. High: archive FAB overlapped archive sheet actions and could block touches.
   - Status: fixed in this pass by hiding FAB when sheet is open.
3. Medium: parallax header ignored top inset and could render under notch/status.
   - Status: fixed in this pass.
4. Medium: NativeTabs automatic content insets + manual insets can double-apply spacing and create blank strips.
   - Status: fixed in this pass (disabled automatic per trigger).
5. Medium: duplicated UI primitives (chips/controls) increase maintenance risk.
   - Status: pending cleanup refactor.
6. Low: several exported helpers/types are currently unused and can be trimmed once confirmed.
   - Source: `knip` run.

## Deletion Candidates (From Knip)

Potential dead exports/types to validate before removal:
- `src/constants/zones.ts`: `findZoneById`, `ZoneOption`
- `src/i18n/index.ts`: `getDeviceLanguage`, `isRtlLanguage`
- `src/constants/zones-map.ts`: `PIKUD_ZONE_FEATURES`, `PIKUD_ZONE_INDEX`, `ISRAEL_MAP_BOUNDS`, `getZoneFeature`, `ZoneIndexEntry`
- `src/lib/notification-permissions.ts`: `hasGrantedNotificationPermission`
- `src/components/themed-text.tsx`: `ThemedTextProps`
- `src/components/themed-view.tsx`: `ThemedViewProps`
- `src/lib/theme-preference.ts`: `ThemePreference`
- `src/lib/device-calendar-sync.ts`: `DeviceCalendarProvider`, `DeviceCalendarSyncEvent`

Note: remove in small batches and run lint/typecheck after each batch.

## Expo-native guideline checks

1. `SafeAreaProvider` is present at app root (`Queue/src/app/_layout.tsx`) which is correct.
2. Tab screens mostly use `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` which aligns with native expectations.
3. Native tabs are used (`expo-router/unstable-native-tabs`) which matches SDK 54 direction.

## Two viable approaches

1. Implemented now (recommended for SDK 54):
   - Keep manual tab-aware inset model in shared hook.
   - Use `bottomInset` for content and `bottomOverlayInset` for floating controls.
2. Future upgrade path (SDK 55+):
   - Use NativeTabs automatic content inset behavior and per-tab `disableAutomaticContentInsets` only where needed.
   - Minimize manual inset arithmetic and keep only explicit overlay offsets.

## Principle check

1. KISS: one shared inset source reduces per-screen guesswork.
2. DRY: less repeated bottom-offset logic.
3. YAGNI: no large navigation rewrite; only targeted spacing fixes.
4. SOLID: layout responsibility moved into a dedicated hook.
