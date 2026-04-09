# Global Vector Tiles Roadmap

## Goal

Let a user pan the map to another country and see selectable postcode / boundary tiles there, without being locked to Israel static GeoJSON.

## Product requirement

The global system must preserve the current behavior:

- studios can detect their current location
- a GPS point resolves into a boundary
- instructors can tap polygons on the map
- instructors can also select by zip/postcode
- studios are visible on the map
- matching continues to work by stable area IDs

## Direct answer

Yes, the system you have today can evolve into that.

But the architecture needs to shift from:

- `local static GeoJSON for one country`

to:

- `boundary provider abstraction`
- `stable boundary IDs in app data`
- `vector tile geometry source`
- `country-aware search / reverse geocoding / boundary lookup`

## Important constraint

Your app currently uses `@maplibre/maplibre-react-native`.

That means there are two distinct paths:

### Path 1: Stay on MapLibre and use your own vector tiles

This is the most controlled path.

- You generate or source postcode/admin boundary tiles
- host them as vector tiles
- render them through the map library as tiled sources
- keep your own area IDs

Pros:

- closest to your current architecture
- no forced Mapbox SDK migration
- easier to preserve your existing map behavior

Cons:

- you own more of the data pipeline

### Path 2: Move to Mapbox-native SDK + Boundaries

This is the official enterprise data path.

- use Mapbox Boundaries datasets
- use `mapbox_id` / `promoteId`
- join app state to those features

Pros:

- strong managed boundary product
- good worldwide coverage for admin/postal layers

Cons:

- larger SDK/runtime migration
- more lock-in
- licensing/cost review required

## Recommendation

Do not begin with a full SDK rewrite.

Instead:

1. generalize your app around providers and stable IDs
2. prove one non-Israel country
3. decide after that whether to:
   - keep custom vector tiles
   - or migrate to Mapbox Boundaries

## Required architecture

### 1. Stable boundary identity

Backend and matching should store:

- `boundaryId`
- `countryCode`
- `postcode?`
- `displayName`

The backend should not depend on raw polygon geometry.

### 2. Geometry source independence

The map should accept either:

- local `GeoJSON`
- vector tile source

without changing the matching model.

### 3. GPS resolution service

You need a country-aware resolver:

- lat/lng -> boundaryId
- lat/lng -> postcode
- address -> boundaryId

For global coverage, this should become a service boundary, not a local Israel-only utility.

### 4. Search layer

You want both:

- tap polygon on map
- search by postcode / area name

So the selected entity must always normalize back to the same `boundaryId`.

## What changes first in code

### Immediate

- add generic `BoundaryProvider` types
- stop treating `zones` as implicitly Israeli
- preserve existing Israel provider as one implementation

### Next

- teach map components to render a provider-backed source
- add vector-source rendering path beside `GeoJSONSource`
- add provider-specific press handling and label config

### Later

- country-switching and viewport-based provider loading
- zip/postcode search
- GPS resolution via global boundary service

## First implementation target

The smallest real milestone is:

- keep Israel as-is
- add one new provider contract for global postcode vector tiles
- do not yet switch production rendering

That gives you the seam needed for the real migration without breaking the working app.
