# Kilometer Radius Location Architecture

## Decision

Do **not** use polygons, boroughs, or country-specific administrative boundaries as the core matching engine for Queue.

Use:

- **exact point location** for studios / branches / jobs
- **exact kilometer radius** for instructor willingness-to-work
- a **geospatial candidate index** to make matching fast
- an **exact distance filter** as the final truth

This makes the product model match the business model:

- a studio is a point
- an instructor is a point plus a maximum travel radius
- a match exists when `distance(instructorBase, jobLocation) <= instructorRadiusKm`

That is the cleanest system for Europe.

## Why Polygons And Boroughs Should Not Be The Core

They still make sense for:

- labels
- map overlays
- onboarding hints
- analytics
- marketing copy

They do **not** make sense as the primary matching primitive.

### Reasons

1. They are not what the product actually means.

Queue is not matching “inside Hackney” or “inside Rishon West”.
It is matching “can this instructor realistically get there?”

That is a distance / travel problem, not an admin-boundary problem.

2. Europe is inconsistent by country.

The current repo already shows the system strain:

- Israel legacy zones
- boundary providers
- studio `zone`
- optional `boundaryId`
- lat/lng stored anyway

Relevant files:

- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:444)
- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:453)
- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:511)
- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:611)
- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:674)

3. They create border bugs.

An instructor 150m over a borough boundary can be a better match than one 4km away in the same borough.

4. They complicate the UX.

Today the app still thinks in “coverage zones” and “detected zone”:

- [src/app/(app)/(instructor-tabs)/instructor/profile/location.tsx](/home/derpcat/projects/queue/src/app/(app)/(instructor-tabs)/instructor/profile/location.tsx:156)
- [src/components/sheets/profile/instructor/instructor-location-sheet.tsx](/home/derpcat/projects/queue/src/components/sheets/profile/instructor/instructor-location-sheet.tsx:252)
- [src/components/map-tab/map-tab/use-map-tab-controller.tsx](/home/derpcat/projects/queue/src/components/map-tab/map-tab/use-map-tab-controller.tsx:76)

That is harder to explain than:

- “Set your base location”
- “Set how far you’re willing to travel”

## Product Model

### Instructor UX

The instructor should configure:

1. `base location`
2. `work radius in km`
3. `sports`

That is all.

### What they see in Expo

Use a map with:

- a draggable center pin
- a radius slider or stepped control
- a circle overlay
- a simple summary

Example summary:

- `Base: Rishon LeZion`
- `Radius: 8 km`
- `Typical area: Rishon, Holon, Nes Ziona`

The last line is a hint only. It must not drive matching.

### Recommended radius UI

Do not give a free numeric input first.

Use stepped presets:

- `3 km`
- `5 km`
- `8 km`
- `12 km`
- `20 km`
- `30 km`

Then optionally allow a fine slider within the selected band if needed later.

Why:

- easier to understand
- easier to test
- easier to clamp
- cleaner analytics

### Default

Default new instructors to `8 km`.

Reasoning:

- small enough to avoid “Rishon to Tel Aviv” spam
- large enough to cover “Rishon to Holon / Nes Ziona” style willingness
- works as a Europe-friendly middle ground

## The Purest Backend Architecture

## Source of truth

The source of truth should be exact geometry, not H3 cells.

Store:

- instructor base `latitude` / `longitude`
- instructor `workRadiusKm`
- studio branch `latitude` / `longitude`
- job `latitude` / `longitude`

Matching truth:

- exact haversine / geodesic distance

Indexing truth:

- replaceable accelerator layer

This separation matters.

If you ever replace H3, geohash, S2, or Convex geospatial, your product meaning stays the same.

## Recommended Convex data model

### Instructor profile

Add canonical matching fields to `instructorProfiles`:

- `baseLatitude`
- `baseLongitude`
- `workRadiusKm`
- `locationUpdatedAt`
- `locationLabel`
- `locationEngineVersion`

Keep existing address fields for UX and display.

Illustrative schema shape:

```ts
instructorProfiles: defineTable({
  // existing fields...
  baseLatitude: v.optional(v.number()),
  baseLongitude: v.optional(v.number()),
  workRadiusKm: v.optional(v.number()),
  locationLabel: v.optional(v.string()),
  locationUpdatedAt: v.optional(v.number()),
  locationEngineVersion: v.optional(v.string()),
})
```

### Studio branches

The canonical match point should be the branch, not the studio HQ.

Add or standardize:

- `latitude`
- `longitude`
- `locationLabel`
- `locationUpdatedAt`
- `locationEngineVersion`

### Jobs

When a studio posts a job, snapshot the branch point onto the job:

- `jobLatitude`
- `jobLongitude`
- `locationLabel`

This avoids branch edits changing historical or in-flight match semantics.

### Sport-aware service area rows

Create a new table:

- `instructorServiceAreas`
  - `instructorId`
  - `sport`
  - `baseLatitude`
  - `baseLongitude`
  - `workRadiusKm`
  - `notificationsEnabled`
  - `updatedAt`

Indexes:

- `by_instructor_sport`
- `by_sport`
- and geospatial index integration for location lookup

Illustrative schema shape:

```ts
instructorServiceAreas: defineTable({
  instructorId: v.id("instructorProfiles"),
  sport: v.string(),
  baseLatitude: v.number(),
  baseLongitude: v.number(),
  workRadiusKm: v.number(),
  notificationsEnabled: v.boolean(),
  updatedAt: v.number(),
})
  .index("by_instructor_sport", ["instructorId", "sport"])
  .index("by_sport", ["sport"])
```

This follows Convex best practices better than storing large arrays on a user document.

Why:

- Convex recommends back-reference / scalable relationship structures for growing relations
- Convex cannot index an array field for reverse membership lookup in the way this feature needs
- one row per `instructor x sport` scales much better than one row per `instructor x hex`

Official Convex relationship guidance:

- arrays are not indexable for reverse lookup
- arrays have an 8192 entry limit
- Convex recommends scalable back-reference structures for growth

Source:

- https://stack.convex.dev/relationship-structures-let-s-talk-about-schemas

## Primary execution engine

### Option A: Convex geospatial component plus exact distance filter

This is the cleanest architecture **if** you are comfortable with the component’s beta status.

Official package:

- `@convex-dev/geospatial`
- https://www.npmjs.com/package/@convex-dev/geospatial

The official package description says:

- it efficiently stores and queries points on the Earth’s surface
- supports nearest queries and max distance
- supports equality / `IN` style filtering
- has been tested up to about `1,000,000` points

That is enough headroom for `100k` users if modeled well.

### How to use it here

Index `instructorServiceAreas` points, not users directly.

Then on job post:

1. get job point
2. get sport
3. query nearby instructor service-area rows for that sport inside a **global max search radius**
4. exact-filter each row using the instructor’s own `workRadiusKm`
5. dedupe to instructors
6. filter for compliance / availability / notification settings

Suggested companion index row for jobs if you also want the jobs feed on the same model:

```ts
jobLocationIndex: defineTable({
  jobId: v.id("jobs"),
  sport: v.string(),
  status: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  startTime: v.number(),
  postedAt: v.number(),
})
  .index("by_job", ["jobId"])
  .index("by_sport_status", ["sport", "status"])
```

That keeps “find jobs near instructor” and “find instructors near job” symmetrical without reusing the old zone coverage tables.

### Why this is better than H3-as-truth

- exact km semantics
- no ring approximation
- no country-specific geometry
- no fanout materialization into hundreds of cells per instructor
- changing radius is a single-row update per sport, not a rebuild of a coverage lattice

## Matching flow

### Notifications

When a studio posts:

1. load branch snapshot point
2. query candidate `instructorServiceAreas` by sport and location
3. exact distance filter against each row’s `workRadiusKm`
4. notify matching instructors

### Instructor jobs page

The feed should use the same truth:

1. get instructor base point and radius
2. get instructor sports
3. query open jobs by sport near the instructor point, limited by the instructor radius or a server cap
4. exact distance filter
5. sort by posted time, then distance

That replaces the current dual-path `zone` + `boundary` logic in:

- [convex/jobs.ts](/home/derpcat/projects/queue/convex/jobs.ts:960)
- [convex/homeRead.ts](/home/derpcat/projects/queue/convex/homeRead.ts:199)
- [convex/lib/instructorCoverage.ts](/home/derpcat/projects/queue/convex/lib/instructorCoverage.ts:1)
- [convex/lib/instructorEligibility.ts](/home/derpcat/projects/queue/convex/lib/instructorEligibility.ts:1)

## Why not H3 as the primary engine

H3 is excellent, but for Queue it should be treated as an implementation option, not the product model.

### Official H3 constraints

From official H3 docs:

- `latLngToCell` maps a point to a cell
- `gridDisk` is a grid-hop operation, not a kilometer radius
- cell size varies by geography
- one fixed resolution does not equal one fixed real-world radius

Sources:

- https://h3geo.org/docs/api/indexing/
- https://h3geo.org/docs/api/traversal/
- https://h3geo.org/docs/core-library/restable/

Important official res 7 numbers:

- average area: `5.161293360 km²`
- min area: `3.126836030 km²`
- max area: `6.227445905 km²`
- average edge length: `1.406475763 km`

Source:

- https://h3geo.org/docs/core-library/restable/

### Implication

If the user says “I am willing to travel 8 km”, an H3 ring is only an approximation.

That is fine for candidate generation.
It is not ideal as the user-facing truth.

## Why H3 still matters

H3 is still the best fallback if you decide not to use the Convex geospatial component.

Use H3 as:

- candidate-generation accelerator
- debugging / map explanation layer
- optional clustering layer

But still keep exact point + exact radius as the source of truth.

## Alternatives

### Alternative 1: Exact km truth + Convex geospatial component

Status:

- **Recommended primary architecture**

Pros:

- exact product semantics
- small write amplification
- clean instructor UX
- no European admin-boundary dependency
- 100k point scale is comfortable relative to component claims

Cons:

- component is beta
- requires component integration work

### Alternative 2: Exact km truth + H3 candidate index + exact distance filter

Status:

- **Recommended fallback if you do not want a beta geospatial component**

Pros:

- proven H3 ecosystem
- no admin-boundary dependency
- source of truth still exact km

Cons:

- either many cell lookups per query, or many materialized rows per instructor
- more custom complexity in Convex
- easier to hit read-range limits if query strategy is naive

Official Convex docs warn that a single query or mutation has limits on `db.get` / `db.query` calls and too many index ranges:

- https://docs.convex.dev/functions/error-handling

That matters if you try to do many-cell fanout or many indexed lookups in one function.

### Alternative 3: Boroughs / polygons as matching truth

Status:

- **Reject**

Pros:

- human-readable
- useful as labels

Cons:

- wrong product abstraction
- bad border behavior
- inconsistent across Europe
- heavy maintenance burden

### Alternative 4: PostGIS outside Convex

Status:

- **Valid only if Convex geospatial proves insufficient**

Pros:

- exact spatial queries
- mature geospatial tooling

Cons:

- extra infra
- sync complexity
- breaks the simplicity of this repo’s current architecture

### Alternative 5: Geohash / S2

Status:

- **Not preferred**

Geohash:

- rectangular cells
- worse boundary behavior for this UX

S2:

- technically strong
- weaker JS / Expo familiarity and product ergonomics here

Neither beats “exact km truth + one good index”.

## Convex-specific guidance

From official Convex docs:

- use `withIndex`, not scan-heavy patterns
- avoid unbounded `.collect()`
- design specific index ranges
- use staged indexes on large tables

Sources:

- https://docs.convex.dev/understanding/best-practices/
- https://docs.convex.dev/database/reading-data/indexes/

Implications for this feature:

1. Do not keep the current “query by many zones and merge” pattern forever.
2. Do not store giant relation arrays on user documents.
3. Do not introduce an H3 design that requires hundreds of index probes per request.
4. If adding indexes to large production tables, use staged indexes.

## 100k-user scale

For `100k` users, exact point-plus-radius is not the problem.

The real scaling problems are:

- scan-heavy query plans
- too many indexed subqueries per request
- write-amplified materialization

### What stays cheap

- one service-area row per `instructor x sport`
- exact haversine filtering on a bounded candidate set
- branch/job point snapshots

### What gets expensive fast

- `sport x hex x radius fanout` materialization
- zone catalogs across countries
- polygon point-in-polygon in the hot path

## Edge cases

### 1. Border cases

Good:

- exact distance ignores admin borders

### 2. Road network reality

Distance is still not ETA.

Someone 8 km away across a river or a traffic choke point may still be a bad match.

Recommendation:

- v1: exact straight-line distance
- v2: optional commute score / ETA weighting for ranking, not eligibility

Do not block the architecture on ETA APIs.

### 3. Privacy

Instructor base location is sensitive.

Rules:

- keep exact base coordinates server-side only
- do not expose them to studios
- only expose rough area labels or generalized circles if needed

This repo already has location sensitivity concerns documented in security notes, so the new architecture should tighten, not expand, coordinate exposure.

### 4. Multi-branch studios

Use branch location, never studio profile HQ, for job matching.

### 5. No location yet

If an instructor or branch lacks coordinates:

- do not attempt exact matching
- keep them on legacy matching until migrated

### 6. Sport mismatch

Sport should filter before heavy work where possible.

That is why `instructorServiceAreas` should be sport-aware.

### 7. Radius abuse

Set a hard max radius.

Recommended max:

- `30 km`

This keeps candidate sets bounded and aligns with the product avoiding low-quality long-commute pings.

## Migration plan

### Phase 1: Add exact-km source of truth without changing live behavior

Add fields and new tables while leaving zone/boundary logic live.

1. add canonical lat/lng and `workRadiusKm`
2. add `instructorServiceAreas`
3. add job point snapshots
4. keep old `zone` / `boundary` writes

### Phase 2: Build new onboarding and profile UX behind a feature flag

Replace zone editing with:

- base pin
- radius presets
- circle preview

Leave the old map tab in place until parity is validated.

### Phase 3: Shadow matching

When a job opens:

- compute legacy matches
- compute new exact-km matches
- write both results into an audit table

Compare:

- candidate counts
- accepted-fill rate
- notification-open rate
- time-to-fill

### Phase 4: Switch reads first

Move:

- instructor jobs feed
- home badge counts

to the new engine before switching notifications.

### Phase 5: Switch notifications

After confidence is high:

- switch studio post fanout
- keep legacy in logs only for a short window

### Phase 6: Remove legacy architecture

Delete:

- instructor zone editing
- boundary subscription writes for matching
- `instructorCoverage`
- zone-based eligibility logic
- zone-based job indexes used only for matching

Only keep zones/boundaries if still needed for UI labels or historical Israel maps.

## Concrete recommendation

### Final choice

For Queue, the purest architecture is:

- **truth**: exact coordinates + exact kilometer radius
- **backend**: sport-aware service-area rows
- **index**: Convex geospatial component if accepted, H3 only as fallback accelerator
- **UX**: base pin + radius presets + circle preview
- **labels**: optional borough/city names only

### Short version

Do not redesign the app around boroughs.
Do not redesign the app around H3 either.

Redesign the app around the actual contract:

- “This is where I’m based.”
- “This is how far I’m willing to travel.”

Everything else is implementation detail.
