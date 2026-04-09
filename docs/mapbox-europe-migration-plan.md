# Map / Boundary Migration Plan

## Current architecture

The current app already has the right product model:

- studios resolve into a polygon by GPS
- instructors subscribe to selected areas
- map shows polygon overlays
- realtime matching happens by area identifiers

That means the move from Israel to Europe is a `boundary-data migration`, not a product rewrite.

## What the code does today

- Native map uses `@maplibre/maplibre-react-native`
- Zone rendering uses `GeoJSONSource`
- Israel polygons are loaded from local static files under `assets/data/pikud-haoref/*`
- Point-in-polygon resolution happens in app code in `src/lib/location-zone.ts` and `src/constants/zones-map.ts`
- The map component already accepts `zoneGeoJson` and `zoneIdProperty`, which is a good abstraction seam

## What this means

### Good news

- Your current Israel system is custom already, so your product model is not tied to Pikud HaOref specifically.
- You can replace the source polygons with Europe-first boundaries and keep most of the UX logic.

### Constraint

- `Mapbox Boundaries` is not a drop-in replacement for the current stack.
- Your app currently runs on `MapLibre`, not the Mapbox native SDK.
- Official Mapbox Boundaries usage is documented against Mapbox SDK/style flows, not your current `MapLibre` package.

## Practical options

### Option A: Keep current architecture, swap data

Use your existing map stack and replace Israel GeoJSON with Europe boundary GeoJSON for one launch market.

Best for:

- fastest path
- least rewrite risk
- proving the market in one city/country

Tradeoffs:

- raw GeoJSON can become heavy at scale
- less elegant than vector tiles for large geographic coverage

### Option B: Move to vector tiles, keep your own boundary system

Convert your custom boundary data into vector tiles and render them as tiled sources.

Best for:

- scaling to bigger regions
- smoother map performance
- preserving your own polygon model

Tradeoffs:

- more infra work
- source generation and hosting needed

### Option C: Adopt Mapbox Boundaries for Europe

Use Mapbox postal/admin boundaries for Europe and join your app state onto their `mapbox_id`.

Best for:

- cleaner official country/postcode datasets
- less manual geography maintenance

Tradeoffs:

- likely wants Mapbox-native SDK flows
- not a direct fit with current `MapLibre` implementation
- licensing / cost / SDK migration must be checked first

## Recommendation

### Phase 1

Do `not` start with a Mapbox SDK rewrite.

Start by proving the Europe model with:

- current `MapLibre` setup
- one country
- one boundary dataset
- same area-selection logic

### Phase 2

If performance or coverage becomes a real issue:

- move from raw GeoJSON to vector tiles
- decide whether to use:
  - your own custom tilesets
  - or Mapbox Boundaries plus SDK migration

## Technical checkpoints

1. Introduce a generic `BoundaryProvider` model
   - `israel-pikud`
   - `country-postcode`
   - `custom-city-zones`

2. Separate product identifiers from geometry source
   - app should store a stable `zoneId`
   - map source can be GeoJSON, vector tile, or Mapbox boundary ID mapping

3. Keep the current UX contract
   - tap polygon to subscribe
   - GPS resolves studio into area
   - studios visible on map
   - filter by area / zip

4. Avoid binding the backend to raw geometry
   - backend should care about `zoneId`, not polygons

## Direct answer to the main question

Yes, Mapbox can support the kind of system you have now:

- clickable polygon regions
- area IDs
- zip/postcode support
- GPS point-to-boundary resolution
- coloring and selecting regions on map

But the exact way you have it today is `custom GeoJSON on MapLibre`.

So the cleanest near-term path is:

- keep the current custom model
- replace Israel boundaries with Europe boundaries
- only later decide whether to migrate to vector tiles or Mapbox-native products

## Immediate next decisions

1. Pick first launch geography:
   - UK postcode areas
   - Netherlands postal/neighborhood boundaries
   - Germany postcode/admin boundaries

2. Pick boundary source strategy:
   - static GeoJSON first
   - or vector tiles immediately

3. Define a generic app-side shape:
   - `zoneId`
   - `displayName`
   - `countryCode`
   - `zip/postcode`
   - `geometrySource`
