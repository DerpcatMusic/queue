# H3 Geospatial Indexing — Design Spec

**Date**: 2026-04-13
**Status**: Draft
**Replaces**: Zone-based matching, `@convex-dev/geospatial` beta component, boundary subscriptions

## Problem

Queue operates a sports marketplace across Europe. The current geospatial system uses a triple approach:
1. Zone strings (Israel-specific `pikud` districts) — doesn't generalize to Europe
2. `@convex-dev/geospatial` beta component — separate data store, beta status, README-only docs
3. Boundary subscriptions — Israel-specific, not applicable for European expansion

This doesn't scale to Europe where administrative boundaries are irregular and non-uniform.

## Solution

Replace all three systems with H3 (Uber's hexagonal grid) at Resolution 7. H3 converts lat/lng coordinates into short string indexes that work as native Convex B-tree index keys, enabling compound filtering by sport + location + status in a single index.

## Design Decisions

### Why H3 over native Convex geospatial
- Native compound indexes (`by_sport_h3_status`) — no separate data store to sync
- No beta dependency
- No manual data denormalization between geo store and main tables
- Full Convex reactivity works naturally
- Stable, well-documented library (h3-js v4.4.0, Apache 2.0)

### Why Resolution 7
- Cell area: ~5.16 km², edge: ~1.22 km, diameter: ~2.44 km
- Neighborhood-scale — appropriate for sports marketplace commuting distances
- Small enough for precise matching, large enough to keep query counts manageable

### Why not Resolution 6
- Cells are ~36 km² — too coarse for urban European neighborhoods
- Would miss precision instructors expect for local matching

### Radius cap decision
- Max `workRadiusKm` reduced from 50 to **40 km** (update `locationRadius.ts`)
- At 40km, k=33, ~3367 cells — acceptable for Convex actions, no compaction needed initially
- Compaction (`compactCells()`) can be added as a future optimization if needed

## Schema Changes

### Add to `jobs` table
```typescript
h3Index: v.string()  // Res 7 H3 cell string, e.g. "87184bc28ffffff"
```

**New indexes:**
```
.index("by_sport_h3_status_postedAt", ["sport", "h3Index", "status", "postedAt"])
```

**Remove:**
- Fields: `zone`, `boundaryProvider`, `boundaryId`
- Indexes: `by_zone_and_status`, `by_sport_zone_status_postedAt`, `by_boundary_and_status`, `by_sport_boundary_status_postedAt`

### Add to `studioBranches` table
```typescript
h3Index: v.optional(v.string())  // Computed from branch lat/lng
```

**Remove:**
- Fields: `zone`, `boundaryProvider`, `boundaryId`
- Indexes: `by_zone`, `by_boundary`

### Add to `studioProfiles` table
```typescript
h3Index: v.optional(v.string())  // Copied from primary branch's h3Index
```

**Remove:**
- Fields: `zone`, `boundaryProvider`, `boundaryId`
- Indexes: `by_zone`, `by_boundary`

### Add to `instructorProfiles` table
```typescript
h3Index: v.optional(v.string())  // Computed from profile lat/lng, updated on address change
```
**New index:**
```
.index("by_h3_index", ["h3Index"])
```

If `latitude` or `longitude` is undefined, `h3Index` is set to `undefined`. Instructors with no location simply see no jobs and receive no notifications — this is correct behavior.

Existing fields `latitude`, `longitude`, `workRadiusKm` (min 1, max 40, default 15 km) remain unchanged.

### Tables to drop entirely
- `instructorZones`
- `instructorCoverage`
- `instructorGeoCoverage`
- `instructorBoundarySubscriptions`
- `boundaries`

### Files to remove
- `convex/instructorZones.ts`
- `convex/boundaries.ts`
- `convex/pikud-zones.generated.ts`
- `convex/lib/boundaries.ts`
- `convex/lib/geospatial.ts`
- `convex/lib/instructorCoverage.ts`

### Files to modify (update zone/boundary references)
- `convex/lib/domainValidation.ts` — remove `isKnownZoneId` and zone-related functions
- `convex/lib/instructorEligibility.ts` — remove zone-based eligibility checks

### Component removal
- Remove `@convex-dev/geospatial` from `convex/components.ts`
- Remove from `convex/convex.config.ts`
- Remove from `package.json`

## Write Path

### H3 computation guard
All H3 computation must validate coordinates before calling `latLngToCell`:
```typescript
function safeH3Index(lat: number | undefined, lng: number | undefined): string | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return latLngToCell(lat, lng, 7);
}
```

### Branch H3 computation
When a studio branch's `latitude`/`longitude` is created or updated:
```typescript
const h3Index = safeH3Index(branch.latitude, branch.longitude);
// Store on branch document
```

This happens in the branch create/update mutation. The H3 is computed once and cached on the document.

After updating a branch's `h3Index`, also update the parent `studioProfiles.h3Index` if this is the primary branch.

### Instructor profile H3 computation
When an instructor's `latitude`/`longitude` changes (profile address update):
```typescript
const h3Index = safeH3Index(profile.latitude, profile.longitude);
// Patch instructorProfiles with h3Index
```

### Job creation
When a studio creates a job:
```typescript
const branch = await ctx.db.get(job.branchId);
if (!branch.h3Index) {
  throw new ConvexError("Branch must have a location before posting jobs");
}
await ctx.db.insert("jobs", {
  ...jobFields,
  h3Index: branch.h3Index,
  postedAt: Date.now(),
});
```

Job creation is rejected if the branch has no H3 index (no coordinates). This is intentional — a job without a location is unfindable.

## Read Path

### Saved mode (home address)
When an instructor opens the job board from their saved location:

1. Client passes `instructorId` to the query
2. Server loads instructor profile → `latitude`, `longitude`, `workRadiusKm`
3. If profile has no `latitude`/`longitude`, return empty array
4. Server computes k-ring: `k = Math.ceil(workRadiusKm / 1.22)`
5. Server runs `Promise.all` across sports × cells:
```typescript
const H3_RES7_EDGE_KM = 1.22;

const centerHex = latLngToCell(lat, lng, 7);
const k = Math.ceil(workRadiusKm / H3_RES7_EDGE_KM);
const hexCells = gridDisk(centerHex, k);
const limitPerHex = Math.max(Math.ceil(totalLimit / hexCells.length), 5);

const jobsBySport = await Promise.all(
  sports.map(sport =>
    Promise.all(
      hexCells.map(hex =>
        ctx.db.query("jobs")
          .withIndex("by_sport_h3_status_postedAt", q =>
            q.eq("sport", sport).eq("h3Index", hex).eq("status", "open")
          )
          .order("desc")
          .take(limitPerHex)
      )
    )
  )
);
```

6. Flatten and sort by `postedAt`. Deduplication by job ID is technically unnecessary (each job has exactly one `h3Index`) but included as a defensive measure using a `Map<Id, Doc>`.
7. Return to client

### Live GPS mode
When an instructor uses the map with live GPS:

1. Client computes `latLngToCell(gpsLat, gpsLng, 7)` locally
2. Compare to last queried cell — if same, skip
3. If cell changed, compute `gridDisk` client-side, pass hex array to Convex query
4. Convex query uses the provided hex array instead of computing from saved profile
5. Results sorted client-side by Haversine distance

The hex-cell debounce means re-queries only happen when the instructor moves ~1.2km. Between re-queries, Convex reactivity handles new jobs appearing in already-queried hexes.

### Distance sorting
All distance calculation happens client-side using Haversine (via `geolib` or inline). The server only does spatial bucketing via H3. This keeps server compute minimal.

## Radius Handling

### Continuous slider (1–40 km)
`MAX_WORK_RADIUS_KM` updated to 40 in `locationRadius.ts`. The instructor's `workRadiusKm` maps to k-ring count:

| Radius | k = ceil(R/1.22) | Cells (1+3k(k+1)) | Notes |
|--------|-------------------|---------------------|-------|
| 1 km   | 1                 | 7                   | Single neighborhood |
| 5 km   | 5                 | 91                  | Small city |
| 10 km  | 9                 | 271                 | City-scale |
| 15 km  | 13                | 547                 | Metro area (default) |
| 20 km  | 17                | 919                 | Large metro |
| 30 km  | 25                | 1951                | Regional |
| 40 km  | 33                | 3367                | Max, rural |

**Decision**: Start without compaction. All cells queried at Res 7. Convex `Promise.all` handles thousands of indexed lookups efficiently. Compaction can be added as a future optimization if the cell count becomes a bottleneck.

## Notifications

### Job posted → notify instructors
When a studio posts a job, a Convex action triggers:

1. Get the job's `h3Index` and `sport`
2. Compute the maximum notification radius: `k_max = Math.ceil(MAX_WORK_RADIUS_KM / 1.22)` = 33
3. Compute `gridDisk(jobH3, k_max)` — all cells within 40km
4. Query `instructorProfiles` by `by_h3_index` for each cell
5. For each found instructor, check sport match via `instructorSports` table
6. Filter for notification eligibility (notifications enabled, has push token)
7. Send push notifications in batches

Performance considerations:
- Notifications run in a Convex **action** (higher compute budget, not reactive)
- 3367 cell queries × typically 0-5 instructors per cell in most areas
- Dense cities may have 20-50 instructors per cell — batch and paginate
- This runs once per job posted, not per user session
- If the action times out, split into multiple actions paginating through the cell ring

### Align with max radius
The notification k-ring uses the same `MAX_WORK_RADIUS_KM = 40` as the app slider. Instructors with a 40km radius will receive notifications for all jobs within that range.

## Data Migration

### Phase 1: Add H3 fields (non-breaking)
1. Add `h3Index` to `jobs`, `studioBranches`, `studioProfiles`, `instructorProfiles`
2. Add new indexes (`by_sport_h3_status_postedAt`, `by_h3_index`)
3. Run migration to backfill H3 from existing lat/lng
4. Deploy new code that writes H3 on all new records
5. Both old zone-based and new H3 paths coexist during this phase
6. **Verification step**: Count records where `h3Index` is undefined — must be 0 for branches with coordinates before proceeding

### Phase 2: Switch read path
1. Update `getAvailableJobsForInstructor` to use H3 queries
2. Update `getMyInstructorHomeStatsRead` to use H3 queries
3. Update notification system to use H3 queries
4. Test thoroughly
5. **Rollback**: Simply redeploy old read-path code — both zone and h3Index fields coexist

### Phase 3: Remove old system
1. Remove zone/boundary fields from schema
2. Drop old tables (`instructorZones`, `instructorCoverage`, `instructorGeoCoverage`, `instructorBoundarySubscriptions`, `boundaries`)
3. Remove old files
4. Remove `@convex-dev/geospatial` dependency
5. Update `domainValidation.ts` to remove zone-related functions

## Client-Side Requirements

### Install h3-js
```bash
bun add h3-js
```

### Client compatibility
h3-js uses WASM (Emscripten). Expo/React Native may require Metro config for WASM support. If WASM is problematic in the Expo environment:
- **Fallback**: Do all H3 computation server-side. Client sends raw GPS coords, server computes hex and returns results. The hex-cell debounce still works by computing the cell server-side and comparing to the last known cell.
- **Alternative**: Use a native H3 module for React Native if available.

Investigate h3-js compatibility with Expo before implementation. If issues arise, shift all H3 computation to the server.

### Client utilities needed
```typescript
// Compute instructor's hex from GPS
const myHex = latLngToCell(gpsLat, gpsLng, 7);

// Compute watch zone for live map
const watchZone = gridDisk(myHex, kForRadius(radiusKm));

// Convert hex to polygon for map overlay
const boundary = cellToBoundary(hex);
```

### Slider behavior
- Existing radius slider updated: max 40km (down from 50km)
- Client displays hex grid overlay on map as radius changes
- Debounce: only save to profile after 500ms of no slider movement
- Live preview: hex grid renders locally using `cellToBoundary`

## Key Files to Modify

### Backend (Convex)
- `convex/schema.ts` — add/remove fields and indexes
- `convex/lib/geospatial.ts` → replace with H3 helpers (safeH3Index, queryJobsByH3)
- `convex/lib/instructorCoverage.ts` → delete
- `convex/lib/boundaries.ts` → delete
- `convex/lib/locationRadius.ts` — update MAX_WORK_RADIUS_KM to 40
- `convex/lib/domainValidation.ts` — remove zone-related functions
- `convex/lib/instructorEligibility.ts` — remove zone-based eligibility checks
- `convex/jobs.ts` — update `getAvailableJobsForInstructor`, job creation
- `convex/homeRead.ts` — update home stats queries (currently uses zone-based coverage pairs and geospatial.nearest)
- `convex/instructorZones.ts` → delete
- `convex/boundaries.ts` → delete
- `convex/notificationsCore.ts` — update notification targeting
- `convex/components.ts` — remove geospatial component
- `convex/convex.config.ts` — remove geospatial component

### Frontend
- Map tab: add H3 hex overlay for radius preview
- Instructor profile: update radius/settings UI (max 40km)
- Job board: update to use H3-based queries
- Remove zone selection UI
