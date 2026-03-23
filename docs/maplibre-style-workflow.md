# MapLibre Style Workflow

This app already supports remote vector style URLs through:

- `EXPO_PUBLIC_MAP_VECTOR_STYLE_LIGHT_URL`
- `EXPO_PUBLIC_MAP_VECTOR_STYLE_DARK_URL`
- `EXPO_PUBLIC_BASEMAP_STYLE_URL`
- `EXPO_PUBLIC_MAP_VECTOR_STYLE_URL`

The current defaults live in [src/components/maps/queue-map-apple-theme.ts](/home/derpcat/projects/queue-nativewind-styling/src/components/maps/queue-map-apple-theme.ts).

## Recommended workflow

1. Open the target style in Maputnik.
2. Adjust land, water, roads, labels, and density there instead of hardcoding visual tweaks in app code.
3. Publish the edited style JSON to a stable URL.
4. Point the app env vars at that hosted style.
5. Keep app-side map styling focused on interaction overlays only:
   - selected zone outline
   - selected zone fill
   - focused pin
   - editing affordances

## Suggested style direction

- Reduce non-essential label density.
- Keep water and land contrast gentle.
- Avoid saturated road colors.
- Preserve strong contrast for selected zones only.
- Keep base map neutral so the zone overlay reads first.

## Why this is the right split

Maputnik is a style editor, not a runtime dependency. Using it offline/in tooling keeps the app lighter and makes style changes reproducible without shipping editor code in production.
