# Map Backbone Plan (Phase 1)

## Goal

Ship a fast, cost-aware, professional onboarding map flow for Israel zones using bundled Pikud HaOref polygon assets.

## Decisions

- SDK: `@maplibre/maplibre-react-native` (single map stack).
- Data source: seeded from `yuvadm/pakarlib`.
- Offline-first assets: bundle `all.geojson` + `zone-index.json` in app assets.
- Scope guard: onboarding selection flow only (no route navigation or live traffic in v1).

## Implemented

- Removed duplicate map SDKs (`expo-maps`, `@rnmapbox/maps`).
- Added MapLibre Expo config plugin in `app.json`.
- Added zone index generation in `scripts/data/seed-pikud-haoref.mjs`.
- Added map helpers in `src/constants/zones-map.ts`.
- Added onboarding-native map component:
  - `src/components/maps/pikud-zones-map.native.tsx`
  - `src/components/maps/pikud-zones-map.web.tsx` fallback
- Wired onboarding search dropdown + polygon selection map in `src/app/onboarding.tsx`.

## Next (Phase 2)

1. Add optional online basemap style presets (light/hybrid), with local fallback.
2. Persist map UI preferences (style preset, last zone focus) in Convex per user.
3. Add offline pack prefetch for selected zoom range if larger map context is needed.
