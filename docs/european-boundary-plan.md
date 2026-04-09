# European Boundary Polygon Selection — Architecture Plan

## 1. IMMEDIATE BUG: Why Polygons Are Invisible

### Root Cause
The `native-map-sdk.native.tsx` wrapper's `createTypedLayer()` function passes styles 
via the `style` prop (camelCase). This IS the correct @rnmapbox/maps v10 API.

**But the actual proven issue** is that `@rnmapbox/maps` v10's `cloneReactChildrenWithProps()` 
in `node_modules/@rnmapbox/maps/lib/module/utils/index.js:57-59` explicitly skips 
`React.Fragment` children without injecting `sourceID`. Layers must be DIRECT children 
of the source component.

The current code in `queue-map-boundary-generic.tsx` uses direct JSX children (no Fragment).
If polygons are STILL invisible, the issue must be in the `style` prop transformation.

### Debug Checklist
1. Add `console.log` inside `createTypedLayer` to verify `style` object contents
2. Verify `mapLoadState` reaches "ready" 
3. Verify `activeBoundarySource` is defined (not undefined)
4. Test with raw `@rnmapbox/maps` components (bypass wrapper) to isolate the issue

### Quick Test: Bypass the wrapper
Replace `queue-map-boundary-generic.tsx` with RAW @rnmapbox/maps imports for one test:

```tsx
import { ShapeSource, FillLayer, LineLayer } from "@rnmapbox/maps";

// Direct, no wrapper:
<ShapeSource id="test-source" shape={geojsonData}>
  <FillLayer
    id="test-fill"
    style={{ fillColor: "#506600", fillOpacity: 0.3 }}
  />
</ShapeSource>
```

If THIS works → the wrapper is the problem. If not → Mapbox setup is wrong.

---

## 2. Data Sources for European Boundaries

### Option A: Overture Maps (FREE, recommended)
- **Source**: `s3://overturemaps-us-west-2/release/2026-03-18.0/theme=divisions/type=division_area/*`
- **Format**: GeoParquet on S3
- **License**: ODbL (open, attribution required)
- **Coverage**: Global, 5.5M+ features
- **Subtypes for driving instructors**:

| Subtype | Description | Europe Example | Use For |
|---------|-------------|---------------|---------|
| `locality` | Cities/towns | Berlin, Lyon, Warsaw | Primary selection |
| `borough` | City districts | London boroughs, Paris arrondissements | Metro areas |
| `localadmin` | Admin areas | Paris commune | Countries with this level |
| `county` | Sub-region | Landkreise (DE), départements (FR) | Rural fallback |
| `region` | States/provinces | Île-de-France, Bavaria | Too large, skip |

**Pipeline**: 
```
Overture S3 (GeoParquet) → DuckDB query (filter country + subtype) 
→ GeoJSON → tippecanoe → PMTiles → Host on R2/CDN
```

**Example DuckDB query for France localities:**
```sql
LOAD spatial; LOAD httpfs;
SET s3_region='us-west-2';
COPY (
  SELECT id, names.primary as name, subtype, geometry
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-03-18.0/theme=divisions/type=division_area/*')
  WHERE country = 'FR'
    AND subtype IN ('locality','borough','localadmin')
) TO 'france-boundaries.geojson' WITH (FORMAT GDAL, DRIVER 'GeoJSON', SRS 'EPSG:4326');
```

### Option B: Eurostat NUTS / GISCO (FREE)
- **Source**: `https://gisco-services.ec.europa.eu/distribution/v2/nuts/`
- **Format**: GeoJSON, Shapefile, TopoJSON
- **License**: CC-BY (open)
- **Levels**: NUTS0 (country) → NUTS1 (region) → NUTS2 (province) → NUTS3 (department)
- **Problem**: NUTS3 is TOO LARGE for driving instructor selection (covers entire metropolitan areas)
- **Best use**: NUTS3 as parent grouping, not primary selection level

### Option C: geoBoundaries (FREE)
- **Source**: `https://www.geoboundaries.org/`
- **Format**: GeoJSON, per-country downloads
- **License**: CC BY 4.0
- **Levels**: ADM0 through ADM4 (varies by country)
- **Problem**: Inconsistent levels across countries, some countries only go to ADM2
- **Best use**: Fallback for countries not covered by Overture

### Option D: OpenStreetMap via OpenMapTiles (FREE)
- **Source**: `https://data.maptiler.com/downloads/` or self-hosted
- **Format**: Vector tiles (MBTiles/PMTiles), source-layer: `boundary`
- **Fields**: `admin_level` (2=country, 4=state, 6=county, 8=municipality)
- **Problem**: `admin_level` meaning varies by country; boundary lines (not polygons)
- **Best use**: Basemap boundary display, NOT polygon selection

### Option E: Mapbox Boundaries (PAID)
- **Cost**: Annual subscription (enterprise pricing, $10K+ typical)
- **Coverage**: 5M+ boundaries, expertly curated
- **Levels**: admin-0 through admin-4, postal codes, statistical areas
- **Pros**: Best quality, consistent schema, vector tiles served for you
- **Cons**: Expensive, vendor lock-in
- **Verdict**: Not worth it for startup phase

### RECOMMENDATION: Overture Maps + PMTiles
- Free, global coverage, consistent schema
- `locality` + `borough` subtypes give the right granularity for driving instructors
- Convert to PMTiles for efficient streaming (only loads tiles in viewport)

---

## 3. Architecture: Vector Tile Streaming + Selection

### Current System (Static GeoJSON)
```
[Bundled JSON file] → [ShapeSource] → [FillLayer/LineLayer] → [Map]
  Problem: All 33 London boroughs loaded at once. Won't scale to 50K+ European boundaries.
```

### Proposed System (PMTiles Streaming)
```
[PMTiles on R2/CDN] → [VectorSource] → [FillLayer/LineLayer] → [Map]
                         ↑
                    Only loads tiles visible in viewport
                    sourceLayer: "boundaries"
                    Selection state stored as boundary IDs in Convex
```

### PMTiles + @rnmapbox/maps v10 Integration

PMTiles can be served via HTTP Range Requests. MapLibre GL Native (which @rnmapbox/maps v10 
uses under the hood) supports PMTiles natively via the tile URL template:

```tsx
<Mapbox.VectorSource
  id="europe-boundaries"
  url="pmtiles://https://cdn.example.com/europe-boundaries.pmtiles"
>
  <Mapbox.FillLayer
    id="boundary-fill"
    sourceLayerID="boundaries"           // ← THE source layer name
    style={{
      fillColor: '#506600',
      fillOpacity: [
        'case',
        ['in', ['get', 'id'], ['literal', selectedBoundaryIds]],
        0.28,   // selected
        0.08,   // unselected (edit mode)
      ],
    }}
  />
</Mapbox.VectorSource>
```

### Per-Country Provider Architecture

```typescript
// providers/europe/france.ts
export const FRANCE_LOCALITY_PROVIDER: BoundaryProviderDefinition = {
  id: "fr-localities",
  label: "France communes",
  countryCode: "FR",
  geometry: {
    kind: "vectorTiles",
    sourceId: "fr-boundaries",
    sourceLayer: "localities",
    tileUrlTemplates: ["https://cdn.queue.app/boundaries/fr-localities.pmtiles"],
    promoteId: "id",
  },
  capabilities: {
    supportsPolygonSelection: true,
    supportsVectorTiles: true,
    supportsSearch: true,
  },
  selectionMode: "polygon",
  selectionStorage: "boundaries",
  viewport: { countryCode: "FR", bbox: { sw: [-5.2, 41.3], ne: [9.6, 51.1] }, zoom: 5 },
  labelPropertyCandidates: ["name", "id"],
};
```

### Instructor Country Selection Flow

1. Instructor opens map → geolocated to current position
2. System determines country from coordinates (reverse geocode or viewport)
3. Loads the matching country's boundary provider
4. Vector tiles stream in as instructor pans/zooms
5. Tap a polygon to select/deselect
6. Save selected boundary IDs to Convex

---

## 4. Data Pipeline: Overture → PMTiles

### Step 1: Extract from Overture (per country)
```bash
# Install DuckDB with spatial extension
pip install duckdb

# Extract France localities + boroughs
duckdb << 'SQL'
LOAD spatial; LOAD httpfs;
SET s3_region='us-west-2';
COPY (
  SELECT 
    id,
    names.primary as name,
    subtype,
    geometry
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-03-18.0/theme=divisions/type=division_area/*')
  WHERE country = 'FR'
    AND subtype IN ('locality','borough','localadmin')
) TO 'france-boundaries.geojson' WITH (FORMAT GDAL, DRIVER 'GeoJSON');
SQL
```

### Step 2: Convert to PMTiles
```bash
# Install tippecanoe
brew install tippecanoe  # macOS
# or: sudo apt install tippecanoe  # Linux

# Generate PMTiles with appropriate zoom levels
tippecanoe -o france-boundaries.pmtiles \
  --layer=boundaries \
  --minimum-zoom=6 \
  --maximum-zoom=14 \
  --simplification=10 \
  --drop-fraction-as-needed \
  --extend-zooms-if-still-dropping \
  france-boundaries.geojson
```

### Step 3: Upload to R2/CDN
```bash
aws s3 cp france-boundaries.pmtiles s3://queue-boundaries/ \
  --endpoint-url=https://<account>.r2.cloudflarestorage.com \
  --content-type=application/x-pmtiles
```

### Step 4: Verify
```bash
# PMTiles is accessible via HTTP Range Requests
curl -I https://cdn.queue.app/boundaries/france-boundaries.pmtiles
# Should return: Accept-Ranges: bytes, Content-Length: <size>
```

### Countries to Prioritize (Phase 1)
1. **UK** — London boroughs (already have), expand to other cities
2. **France** — Communes (35K+ localities)
3. **Germany** — Gemeinden (11K+ municipalities)
4. **Spain** — Municipios (8K+)
5. **Italy** — Comuni (7K+)
6. **Netherlands** — Gemeenten (345)

---

## 5. Implementation Phases

### Phase 0: Fix the current rendering bug (THIS WEEK)
- Bypass native-map-sdk wrapper for boundary layers, use raw @rnmapbox/maps
- OR fix the wrapper's style prop transformation
- Verify with console.log that styles reach Mapbox correctly

### Phase 1: Build the data pipeline (Week 1-2)
- Write DuckDB extraction scripts for top 6 countries
- Convert to PMTiles with tippecanoe
- Upload to Cloudflare R2
- Test vector tile rendering in the app

### Phase 2: Provider architecture (Week 2-3)
- Create per-country provider configs
- Build country auto-detection from GPS coordinates
- Implement VectorSource + sourceLayerID rendering
- Update selection storage to handle arbitrary boundary IDs

### Phase 3: UX improvements (Week 3-4)
- Progressive disclosure: show localities at zoom 8+, boroughs at zoom 12+
- Search within boundaries
- City-level bulk select (select all boroughs in a city)
- Selection summary panel

### Phase 4: Scale to full Europe (Month 2+)
- Extract remaining EU countries
- Handle edge cases: tiny countries, city-states (Monaco, Luxembourg)
- Multi-country selection for instructors near borders
