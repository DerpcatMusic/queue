# London Vector Boundary Pipeline

Goal:
- selectable London borough polygons
- cheap delivery
- upgrade path to wider Europe without changing app code

## Runtime contract

The app now supports two London runtime modes through the same provider:

1. `remoteGeojson` fallback
2. `vectorTiles` when `EXPO_PUBLIC_LONDON_BOUNDARY_TILES_URL_TEMPLATE` is set

The active provider is:
- `gb-london-boroughs`

The expected vector source properties are:
- layer: `boundaries` by default
- promoted feature id: `id`

Environment variables:

```bash
EXPO_PUBLIC_BOUNDARY_PROVIDER_ID=gb-london-boroughs
EXPO_PUBLIC_LONDON_BOUNDARY_TILES_URL_TEMPLATE=https://tiles.example.com/london-boroughs/{z}/{x}/{y}.pbf
EXPO_PUBLIC_LONDON_BOUNDARY_SOURCE_LAYER=boundaries
```

## Recommended source stack

1. Source admin boundaries from Overture `division_area`
2. Build London-only borough tiles
3. Package to PMTiles for cheap storage/distribution
4. Expose standard `{z}/{x}/{y}.pbf` URLs through CDN/worker
5. Feed that URL template to the app

Why:
- cheap at low scale
- no Mapbox Boundaries enterprise dependency
- app can later swap London to Europe-wide boundaries without changing selection logic

## London first cut

For the first London production tileset, borough-level admin polygons are enough:
- human-readable
- low selection cardinality
- stable IDs
- sufficient for city/district instructor coverage

Do not block on postcode polygons.

## Build path

### Option A: start from current London borough GeoJSON

Input:
- `assets/data/europe/london-boroughs.json`

Build MBTiles with Tippecanoe:

```bash
tippecanoe \
  --output=london-boroughs.mbtiles \
  --named-layer=boundaries \
  --maximum-zoom=11 \
  --minimum-zoom=5 \
  --extend-zooms-if-still-dropping \
  --drop-densest-as-needed \
  assets/data/europe/london-boroughs.json
```

Convert MBTiles to PMTiles:

```bash
pmtiles convert london-boroughs.mbtiles london-boroughs.pmtiles
```

### Option B: rebuild from Overture divisions

Preferred later, once we expand beyond London:
- query Overture `division_area`
- filter to London boroughs
- normalize properties to:
  - `id`
  - `name`
  - `countryCode`
  - `city`
  - `source`
- tile it the same way

## Hosting

Native RNMapbox should consume normal vector tile URLs.

Important:
- PMTiles is the storage/archive format
- native app should not depend on browser-only PMTiles protocol handlers
- serve tiles as standard Z/X/Y PBF via worker or edge service

Practical options:
1. Cloudflare R2 + Worker
2. S3 + lightweight tile gateway
3. cheap hosted tile service if pricing stays predictable

## Feature requirements for tiles

Every polygon feature must include:
- `id`
- `name`
- `countryCode`

Recommended:
- `city`
- `parentId`
- `postcode` when available later

The app expects:
- layer name `boundaries`
- feature id property `id`

## Why this is the right path

This keeps the product model stable:
- instructor selects boundaries
- backend stores `boundaryId`
- jobs/studios resolve to one canonical boundary

Geometry delivery can evolve independently:
- local JSON
- remote GeoJSON
- vector tiles

The app code should not care once the provider contract is stable.
