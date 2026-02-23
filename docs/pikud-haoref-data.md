# Pikud HaOref Zone Data

This project seeds high-resolution zone metadata and polygon geometry from:
- Source polygons: `https://github.com/yuvadm/pakarlib` (`all.geojson`, ~1400+ areas)
- Official naming/time overlays: `https://www.oref.org.il/districts/*.json`

## Seed Command

```bash
bun run seed:pikud-haoref
```

## Generated Outputs

- `src/constants/zones.generated.ts`
  - App-friendly zone options list (`id`, English/Hebrew labels, alert seconds).
- `assets/data/pikud-haoref/all.geojson`
  - Full split-level alert area GeoJSON (`ראשון לציון - מזרח/מערב` style).
- `assets/data/pikud-haoref/city-polygons.json`
  - City-level dissolved polygons for zoomed-out rendering/labels.
- `assets/data/pikud-haoref/districts.json`
- `assets/data/pikud-haoref/cities.json`
- `assets/data/pikud-haoref/zone-index.json`
  - Fast lookup index for mobile map rendering:
  - `id -> featureIndex + bbox + center + seconds`
  - Includes global Israel bounds (`sw`, `ne`) for camera constraints.
- `assets/data/pikud-haoref/meta.json`
  - Generation timestamp and counts.

## Notes

- `src/constants/zones.ts` re-exports the generated options and helper lookups.
- `src/constants/zones-map.ts` exposes GeoJSON + zone index helpers for map components.
- Regenerate when upstream zone definitions change.
