# H3 Resolution 7 Matching Review

## Scope

This reviews the current boundary and zone implementation in this repo, maps it to official H3 capabilities, and evaluates whether an H3 resolution 7 design will hold up in Convex at roughly 100k users.

## Current implementation in this repo

### Instructor onboarding and coverage

Today, instructor onboarding writes:

- `instructorProfiles` with address and optional lat/lng in [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:269)
- selected sports in `instructorSports` in [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:435)
- selected zones in `instructorZones` in [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:444)
- mirrored boundary subscriptions in `instructorBoundarySubscriptions` in [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:481)
- a materialized sport x zone read model in `instructorCoverage` in [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:491)

The onboarding path is in [convex/onboarding.ts](/home/derpcat/projects/queue/convex/onboarding.ts:130). It still treats `zones` as the primary instructor coverage input and only mirrors those zones into boundary subscriptions.

The materialization step is in [convex/lib/instructorCoverage.ts](/home/derpcat/projects/queue/convex/lib/instructorCoverage.ts:1). It explicitly builds the Cartesian product of `instructorSports x instructorZones`.

### Studio and job location model

Studios and branches store both legacy and newer location fields:

- `zone`
- optional `boundaryProvider`
- optional `boundaryId`
- optional `latitude` and `longitude`

See:

- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:511) for `studioProfiles`
- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:611) for `studioBranches`
- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:674) for `jobs`

Studio onboarding still accepts `zone` as required input and treats `boundaryId` as additive in [convex/onboarding.ts](/home/derpcat/projects/queue/convex/onboarding.ts:297).

### Matching path today

The app currently runs two spatial matching systems in parallel:

1. Legacy zone matching
2. Boundary ID matching

Instructor open-job lookup in [convex/jobs.ts](/home/derpcat/projects/queue/convex/jobs.ts:960) does both:

- query by `by_sport_boundary_status_postedAt`
- query by `by_sport_zone_status_postedAt`

Home stats in [convex/homeRead.ts](/home/derpcat/projects/queue/convex/homeRead.ts:199) still depend on `coveragePairs` of `{ sport, zone }`.

### Problems the current model already shows

This matches the issues you described:

- It is not granular enough for Europe because `zone` is a coarse catalog concept.
- It is hard to explain because the product now has `zone`, `boundary`, and `lat/lng` all at once.
- It duplicates writes and read logic because both legacy and newer spatial keys are active.
- It materializes `sport x area`, which is manageable for a small zone list but becomes dangerous if the area primitive fans out.

## Official H3 capabilities that matter here

Official H3 sources used:

- H3 core stats: https://h3geo.org/docs/core-library/restable/
- H3 indexing overview: https://h3geo.org/docs/3.x/highlights/indexing/
- H3 JavaScript binding docs: https://github.com/uber/h3-js

### What H3 gives you

From the official docs:

- `latLngToCell(lat, lng, res)` maps a point to a cell.
- `gridDisk(cell, k)` returns all cells within a k-ring around a center cell.
- `polygonToCells(polygon, res)` fills a polygon with cells.
- each hexagon has 7 children at the next resolution.

For resolution 7 specifically:

- total cells globally: `98,825,162`
- average hexagon area: `5.161293360 km²`
- average edge length: `1.406475763 km`
- min cell area: `3.126836030 km²`
- max cell area: `6.227445905 km²`

That last point matters: even at one fixed resolution, H3 cell area is not uniform everywhere. It is uniform enough for marketplace matching, but not exact enough to claim that one cell radius means one fixed metric radius.

## Mapping H3 against the current implementation

### What gets simpler

If you switch to one canonical spatial key, the current dual system disappears:

- studio branch address -> one canonical `h3CellR7`
- studio job -> inherits branch `h3CellR7`
- instructor address -> one canonical anchor `h3CellR7`
- instructor working radius -> expanded into a coverage set

That is easier to explain than:

- instructor chooses zones
- zones mirror into boundaries
- studio stores zone and maybe boundary
- matching queries both zone and boundary indexes

### What should stay out of the match key

You should still keep raw coordinates privately for:

- check-in distance verification
- rerunning H3 assignments after algorithm changes
- analytics and debugging

But they should stop being part of the primary matching contract.

### What should not be stored as a single array field

For Convex, the expanded instructor radius should not live as a large `hexes: string[]` blob on the profile.

That would be weak for:

- indexed lookup by one studio hex
- partial updates
- future sport-aware denormalization

Following the repo's existing Convex style, the right shape is a separate materialized table with one row per covered cell.

## Recommended Convex model

### Canonical location fields

Add one canonical H3 field to the location-bearing records:

- `studioProfiles.locationCellR7`
- `studioBranches.locationCellR7`
- `jobs.locationCellR7`
- `instructorProfiles.anchorCellR7`

Keep `latitude` and `longitude` private and optional for operational uses.

### Instructor radius settings

Store the instructor intent separately from the materialized coverage:

- `anchorCellR7`
- `workingRadiusKm`
- `coverageResolution = 7`
- `coverageUpdatedAt`

### Materialized coverage table

Recommended new table:

- `instructorHexCoverage`
  - `instructorId`
  - `cellR7`
  - `gridDistance`
  - `notificationsEnabled`
  - `updatedAt`

Recommended indexes:

- `by_cellR7`
- `by_instructorId`
- optionally `by_cellR7_notificationsEnabled`

Do not start with `sport` in this table unless profiling proves you need it.

### Why not prejoin sport immediately

Your current `instructorCoverage` table is `sport x zone`.

If you replace `zone` with `cellR7`, prejoining sport explodes row count quickly. With H3, the spatial fan-out is much larger than with a manual zone picker. The safer baseline is:

- one table for instructor-to-cell coverage
- one table for instructor-to-sport capability
- intersect after loading candidates

If later you measure that a single dense city cell returns too many instructors, then add a second read model:

- `instructorSportHexCoverage`
  - `sport`
  - `cellR7`
  - `instructorId`

But that should be a measured optimization, not the first schema.

## Matching flow with inverted lookup

Your proposed inverted lookup is the right mental model:

1. studio branch address is geocoded
2. branch gets one `locationCellR7`
3. instructor address is geocoded
4. instructor selects radius in km
5. system computes `gridDisk(anchorCellR7, k)` and materializes rows in `instructorHexCoverage`
6. when a studio posts a lesson, query `instructorHexCoverage` by the job's `locationCellR7`
7. fetch candidate instructors
8. filter by sport, notification settings, compliance, and availability

That is much cleaner than the current zone-plus-boundary hybrid.

## 100k-user scale in Convex

## Important constraint

Resolution 7 is fine as a canonical point cell.

Resolution 7 is not automatically fine as a materialized radius system for large instructor radii.

The risk is row explosion, not lookup correctness.

### Disk size growth

For a hex grid, a full k-disk contains:

- `1 + 3k(k + 1)` cells

That formula is standard hex-grid geometry. The H3 docs define `gridDisk`; the exact disk cardinality formula here is an inference from hex-grid structure.

Using the official res 7 average edge length of `1.406475763 km`, approximate radius behavior looks like this:

| Radius km | Approx k | Covered cells |
| --- | ---: | ---: |
| 2 | 2 | 19 |
| 3 | 3 | 37 |
| 5 | 4 | 61 |
| 7 | 5 | 91 |
| 10 | 8 | 217 |
| 15 | 11 | 397 |
| 20 | 15 | 721 |
| 25 | 18 | 1027 |
| 30 | 22 | 1519 |

This is approximate because:

- H3 cell size varies by geography
- grid distance is topological, not exact metric distance

### What 100k instructors means

If 100k instructors each materialize only hex coverage rows:

| Average covered cells per instructor | Total coverage rows |
| ---: | ---: |
| 19 | 1.9M |
| 37 | 3.7M |
| 91 | 9.1M |
| 169 | 16.9M |
| 271 | 27.1M |

If you also prejoin sports and assume 2 sports per instructor:

| Average covered cells per instructor | Total sport x hex rows |
| ---: | ---: |
| 19 | 3.8M |
| 37 | 7.4M |
| 91 | 18.2M |
| 169 | 33.8M |
| 271 | 54.2M |

### Convex implication

At 100k users, this is workable if:

- average instructor radius stays small
- you materialize `instructor -> hex` only
- jobs query one indexed hex at a time

This gets risky if:

- you allow 15km to 30km radii broadly
- you prejoin `sport x hex` by default
- you keep the legacy zone system in parallel during steady state

### Read behavior

The good news is that the inverted query itself is index-friendly:

- one job has one `locationCellR7`
- query coverage rows by that single cell
- candidate set depends on local density, not total user count

That is exactly the kind of access pattern Convex handles well.

### Write behavior

The expensive path is instructor onboarding and radius edits:

- changing address changes anchor cell
- changing radius rewrites the whole coverage set

That means you want:

- one mutation that computes desired cells
- diff old vs new coverage rows
- insert and delete only the delta

That is the same pattern this repo already uses in [convex/lib/instructorCoverage.ts](/home/derpcat/projects/queue/convex/lib/instructorCoverage.ts:1).

## Recommendation

### Strong recommendation

Use H3 resolution 7 as the canonical point-based spatial key.

Do not use the current zone-plus-boundary hybrid as the long-term model.

### Conditional recommendation

Do use materialized `instructorHexCoverage` in Convex if your allowed working radius is kept modest.

Good fit:

- dense urban matching
- instructors covering roughly 2km to 10km
- one-to-one branch/job location assignment

Bad fit without extra optimization:

- broad suburban and regional radii
- many instructors choosing 15km to 30km
- default `sport x hex` denormalization

## Recommended rollout

1. Add canonical `locationCellR7` fields to studio profiles, branches, jobs, and instructor profiles.
2. Backfill H3 cells from existing lat/lng where present.
3. Add `workingRadiusKm` for instructors.
4. Create `instructorHexCoverage` as the only new materialized read model.
5. Switch job matching to `locationCellR7 -> instructorHexCoverage`.
6. Keep legacy `zone` only as a temporary compatibility field.
7. Remove zone-based matching after parity is proven.

## Final judgment

The H3 direction is correct.

The part that needs tightening is this:

- `resolution 7 everywhere` is a good canonical indexing choice
- `resolution 7 materialized radius coverage for arbitrary large radii` is not automatically safe at 100k users

If you cap radii or keep typical radii small, the model is simpler than the current one and should work well in Convex.

If you expect large radii in Europe, then you should either:

- cap radius aggressively, or
- move to a multi-resolution coverage strategy later

For this repo, the best next step is not more boundary complexity. It is replacing `zone` with one canonical `locationCellR7` and one materialized `instructorHexCoverage` table, then measuring real coverage row counts before adding any `sport x hex` read model.
