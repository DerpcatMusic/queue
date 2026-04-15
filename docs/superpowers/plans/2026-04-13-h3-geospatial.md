# H3 Geospatial Indexing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace zone-based + geospatial-component matching with H3 hexagonal grid indexing at Resolution 7, enabling Europe-wide sports marketplace job discovery.

**Architecture:** H3 converts lat/lng to Res 7 cell strings stored as Convex index keys. Jobs inherit H3 from their branch. Instructors query by computing `gridDisk` from their position + radius. Notifications find instructors via `by_h3_index` lookup in a Convex action.

**Tech Stack:** h3-js v4.4.0 (already in package.json), Convex compound indexes, Convex mutations for backfill

**Spec:** `docs/superpowers/specs/2026-04-13-h3-geospatial-design.md`

---

## File Structure

### New files
- `convex/lib/h3.ts` — H3 utility functions (safeH3Index, radiusToK, queryJobsByH3Cells)

### Files to modify (backend)
- `convex/schema.ts` — add h3Index fields + indexes, later remove zone/boundary fields + indexes
- `convex/lib/locationRadius.ts` — change MAX_WORK_RADIUS_KM from 50 to 40
- `convex/lib/domainValidation.ts` — remove isKnownZoneId, normalizeZoneId
- `convex/lib/instructorEligibility.ts` — replace zone-based eligibility with sport-only
- `convex/studioBranches.ts` — add h3Index computation on branch create/update, remove geospatial sync and boundary imports
- `convex/jobs.ts` — use h3Index in job creation, rewrite getAvailableJobsForInstructor, remove collectOpenJobsByBoundaryCoverage
- `convex/homeRead.ts` — rewrite home stats to use H3 queries
- `convex/notificationsCore.ts` — rewrite notification targeting to use H3 (convert from internalQuery to internalAction)
- `convex/components.ts` — remove geospatial component
- `convex/convex.config.ts` — remove geospatial component import
- `convex/migrations.ts` — add H3 backfill mutations, remove old geospatial/boundary migration code and imports
- `convex/users.ts` — add h3Index computation on instructor profile updates, remove zone/geospatial references (lines 12-13, 45, 669, 691-746, 858, 1240, 1415, 1533, 2704, 2738)
- `convex/onboarding.ts` — remove zone normalization (line 12 normalizeZoneId import, lines 123-178 zone validation, lines 298-407 zone assignment/boundary resolution in studio branch creation)
- `package.json` — remove @convex-dev/geospatial

### Files to modify (frontend — deferred to follow-up)
- Frontend zone/boundary consumption (83 files in `src/`) — requires separate plan for UI changes
- Notable files: `src/lib/location-zone.ts`, `src/features/jobs/instructor-job-presentation.ts`, `src/constants/zones*.ts`, `src/components/map-tab/`, `src/features/maps/boundaries/`

### Files to delete
- `convex/instructorZones.ts`
- `convex/boundaries.ts`
- `convex/pikud-zones.generated.ts`
- `convex/lib/boundaries.ts`
- `convex/lib/geospatial.ts`
- `convex/lib/instructorCoverage.ts`

---

## Phase 1: Foundation (non-breaking)

### Task 1: Create H3 utility module

**Files:**
- Create: `convex/lib/h3.ts`

Note: h3-js@^4.4.0 is already in `package.json` — no install needed.

- [ ] **Step 1: Create `convex/lib/h3.ts`**

**IMPORTANT:** Do NOT use `"use node"` — h3-js runs in Convex's default runtime. The `"use node"` directive would make this file unusable from queries and mutations.

```typescript
import { latLngToCell, gridDisk } from "h3-js";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export const H3_RESOLUTION = 7;
export const H3_RES7_EDGE_KM = 1.22;

/**
 * Convert lat/lng to H3 Res 7 cell string.
 * Returns undefined if coordinates are missing or invalid.
 */
export function safeH3Index(
  lat: number | undefined,
  lng: number | undefined,
): string | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

/**
 * Convert a radius in km to the number of H3 k-ring steps at Res 7.
 */
export function radiusToK(radiusKm: number): number {
  return Math.ceil(radiusKm / H3_RES7_EDGE_KM);
}

/**
 * Get all H3 cell strings within a k-ring of the given center coordinates.
 */
export function getWatchZoneCells(
  lat: number,
  lng: number,
  radiusKm: number,
): string[] {
  const centerHex = latLngToCell(lat, lng, H3_RESOLUTION);
  const k = radiusToK(radiusKm);
  return gridDisk(centerHex, k);
}

/**
 * Query jobs by H3 cells for a set of sports.
 * Returns deduplicated jobs sorted by postedAt descending.
 */
export async function queryJobsByH3Cells(
  ctx: QueryCtx,
  args: {
    hexCells: string[];
    sports: Set<string>;
    status: string;
    limit: number;
  },
): Promise<Doc<"jobs">[]> {
  if (args.hexCells.length === 0 || args.sports.size === 0) return [];

  const sports = [...args.sports];
  const limitPerHex = Math.max(
    Math.ceil(args.limit / args.hexCells.length),
    5,
  );

  const jobsBySport = await Promise.all(
    sports.map((sport) =>
      Promise.all(
        args.hexCells.map((hex) =>
          ctx.db
            .query("jobs")
            .withIndex("by_sport_h3_status_postedAt", (q) =>
              q
                .eq("sport", sport)
                .eq("h3Index", hex)
                .eq("status", args.status),
            )
            .order("desc")
            .take(limitPerHex),
        ),
      ),
    ),
  );

  const byId = new Map<string, Doc<"jobs">>();
  for (const sportJobs of jobsBySport) {
    for (const hexJobs of sportJobs) {
      for (const job of hexJobs) {
        byId.set(String(job._id), job);
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, args.limit);
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/lib/h3.ts
git commit -m "feat: add H3 utility module for geospatial indexing"
```

---

### Task 2: Update location radius constants

**Files:**
- Modify: `convex/lib/locationRadius.ts:5`

- [ ] **Step 1: Change MAX_WORK_RADIUS_KM from 50 to 40**

```typescript
// Line 5: change from
export const MAX_WORK_RADIUS_KM = 50;
// to
export const MAX_WORK_RADIUS_KM = 40;
```

- [ ] **Step 2: Commit**

```bash
git add convex/lib/locationRadius.ts
git commit -m "feat: cap max work radius to 40km for H3 compatibility"
```

---

### Task 3: Add h3Index fields and indexes to schema (additive only)

**Files:**
- Modify: `convex/schema.ts`

This step ONLY adds new optional fields and new indexes. No removals yet — old zone/boundary fields stay during Phase 1.

**CRITICAL:** `h3Index` on `jobs` MUST be `v.optional(v.string())` during Phase 1. Existing jobs lack this field. Making it required (`v.string()`) will fail Convex schema validation before the migration can run. After backfill completes, it will be changed to `v.string()` in Phase 3.

- [ ] **Step 1: Add h3Index to `instructorProfiles`**

After `workRadiusKm: v.optional(v.number()),` (line ~283), add:
```typescript
h3Index: v.optional(v.string()),
```

Add index after `.index("by_slug", ["slug"])`:
```typescript
.index("by_h3_index", ["h3Index"])
```

- [ ] **Step 2: Add h3Index to `studioProfiles`**

After `longitude: v.optional(v.number()),` (line ~541), add:
```typescript
h3Index: v.optional(v.string()),
```

- [ ] **Step 3: Add h3Index to `studioBranches`**

After `longitude: v.optional(v.number()),` (line ~648), add:
```typescript
h3Index: v.optional(v.string()),
```

- [ ] **Step 4: Add h3Index to `jobs` (optional during Phase 1)**

After `zone: v.string(),` (line ~705), add:
```typescript
h3Index: v.optional(v.string()),
```

Add new index after existing indexes on `jobs`:
```typescript
.index("by_sport_h3_status_postedAt", ["sport", "h3Index", "status", "postedAt"])
```

Note: Using `v.optional(v.string())` because existing jobs don't have h3Index yet. Will be changed to `v.string()` in Phase 3 after backfill.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add h3Index fields and indexes to schema (additive, optional)"
```

---

### Task 4: Add H3 computation to write paths

**Files:**
- Modify: `convex/studioBranches.ts`
- Modify: `convex/users.ts`

- [ ] **Step 1: Add H3 computation to `convex/studioBranches.ts`**

Add import at top:
```typescript
import { safeH3Index } from "./lib/h3";
```

In branch creation (line ~267), add `h3Index` to the inserted document:
```typescript
h3Index: safeH3Index(args.latitude, args.longitude),
```

In branch update (line ~312), if coordinates are being updated, compute and set h3Index:
```typescript
if (args.latitude !== undefined || args.longitude !== undefined) {
  const updatedLat = args.latitude ?? existing.latitude;
  const updatedLng = args.longitude ?? existing.longitude;
  updates.h3Index = safeH3Index(updatedLat, updatedLng);
}
```

When a branch is set as primary (line ~436), update parent `studioProfiles.h3Index`:
```typescript
await ctx.db.patch(studio._id, { h3Index: branch.h3Index });
```

Remove all calls to `syncStudioBranchGeospatialLocation` (lines ~267, ~312, ~392, ~436).

Remove import: `import { syncStudioBranchGeospatialLocation } from "./lib/geospatial";`
Remove import: `import { normalizeZoneId } from "./lib/domainValidation";` — but keep it during Phase 1 since zone is still a required schema field. The import removal happens in Phase 3.

- [ ] **Step 2: Add H3 computation to `convex/users.ts` for instructor profiles**

Add import:
```typescript
import { safeH3Index } from "./lib/h3";
```

Specific mutations to update:
- **Line ~669**: Where `normalizeZoneId(args.detectedZone)` is called — add h3Index computation when latitude/longitude are set
- **Line ~691-746**: `instructorZones` queries and inserts — keep during Phase 1 (still in schema), but add h3Index to the profile patch
- **Line ~746, ~858**: `syncInstructorGeospatialCoverage(ctx, profile._id)` — remove these calls, replace with `safeH3Index` computation on the profile
- **Line ~1240, ~1415**: Additional `instructorZones` queries — keep during Phase 1
- **Line ~1533**: `normalizeZoneId(args.zone)` — keep during Phase 1, but add h3Index computation

Pattern for all profile coordinate updates:
```typescript
const h3Index = safeH3Index(
  args.latitude ?? profile.latitude,
  args.longitude ?? profile.longitude,
);
// Include h3Index in the ctx.db.patch call
```

- [ ] **Step 3: Commit**

```bash
git add convex/studioBranches.ts convex/users.ts
git commit -m "feat: compute h3Index on branch and instructor profile writes"
```

---

### Task 5: Add H3 to job creation

**Files:**
- Modify: `convex/jobs.ts`

- [ ] **Step 1: Update job creation to include h3Index**

Add import:
```typescript
import { safeH3Index } from "./lib/h3";
```

In the job creation mutation, after fetching the branch:
```typescript
const branch = await ctx.db.get(args.branchId);
if (!branch) {
  throw new ConvexError("Branch not found");
}
if (!branch.h3Index) {
  throw new ConvexError("Branch must have a location before posting jobs");
}

await ctx.db.insert("jobs", {
  ...jobFields,
  h3Index: branch.h3Index,
  postedAt: Date.now(),
});
```

Jobs still keep their `zone` field during Phase 1 for backward compatibility.

- [ ] **Step 2: Commit**

```bash
git add convex/jobs.ts
git commit -m "feat: set h3Index on job creation from branch"
```

---

### Task 6: Add H3 backfill migration

**Files:**
- Modify: `convex/migrations.ts`

- [ ] **Step 1: Add migration mutations to backfill h3Index**

Use `mutation()` (NOT `migration()` — the codebase uses plain `mutation` for migrations). Follow the existing batch/pagination pattern with `DEFAULT_BATCH_SIZE` and cursor-based pagination.

Add import:
```typescript
import { safeH3Index } from "./lib/h3";
```

Add three migration mutations:

```typescript
export const backfillBranchH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), hasMore: v.boolean(), cursor: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    let processed = 0;
    let cursor = args.cursor;

    const branches = await ctx.db.query("studioBranches").paginate(cursor, batchSize);
    for (const branch of branches.page) {
      if (!branch.h3Index && Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude)) {
        await ctx.db.patch(branch._id, { h3Index: safeH3Index(branch.latitude, branch.longitude) });
        processed++;
      }
    }

    return {
      processed,
      hasMore: branches.isDone ? false : true,
      cursor: branches.continueCursor,
    };
  },
});

export const backfillInstructorH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), hasMore: v.boolean(), cursor: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    let processed = 0;

    const profiles = await ctx.db.query("instructorProfiles").paginate(args.cursor, batchSize);
    for (const profile of profiles.page) {
      if (!profile.h3Index && Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude)) {
        await ctx.db.patch(profile._id, { h3Index: safeH3Index(profile.latitude, profile.longitude) });
        processed++;
      }
    }

    return {
      processed,
      hasMore: profiles.isDone ? false : true,
      cursor: profiles.continueCursor,
    };
  },
});

export const backfillJobH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), hasMore: v.boolean(), cursor: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    let processed = 0;

    const jobs = await ctx.db.query("jobs").paginate(args.cursor, batchSize);
    for (const job of jobs.page) {
      if (!job.h3Index) {
        const branch = await ctx.db.get(job.branchId);
        if (branch?.h3Index) {
          await ctx.db.patch(job._id, { h3Index: branch.h3Index });
          processed++;
        }
      }
    }

    return {
      processed,
      hasMore: jobs.isDone ? false : true,
      cursor: jobs.continueCursor,
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/migrations.ts
git commit -m "feat: add H3 backfill migrations for branches, instructors, jobs"
```

---

### Task 7: Deploy Phase 1 and run migrations

- [ ] **Step 1: Deploy to Convex**

```bash
cd /home/derpcat/projects/queue && bunx convex deploy
```

- [ ] **Step 2: Run migrations in order, paginating until complete**

Run each migration repeatedly with cursor until `hasMore` is `false`:
1. `backfillBranchH3Index` — fills h3Index on all branches
2. `backfillInstructorH3Index` — fills h3Index on all instructor profiles
3. `backfillJobH3Index` — fills h3Index on all jobs from their branches

- [ ] **Step 3: Verify backfill completeness**

Verify: count branches where lat/lng exist but h3Index is undefined — must be 0.
Verify: count jobs where h3Index is undefined — must be 0.

---

## Phase 2: Switch read paths

### Task 8: Simplify instructor eligibility

**Files:**
- Modify: `convex/lib/instructorEligibility.ts`

Do this BEFORE switching read paths so the simplified API is ready.

- [ ] **Step 1: Simplify `loadInstructorEligibility` to sport-only**

Remove zone-based tracking: `hasCoverageKey`, `isEligibleForJob`, `coveragePairs`, `coverageBySport`, `coverageCount`. The `InstructorEligibility` type becomes just `{ sports: Set<string> }`.

```typescript
export type InstructorEligibility = { sports: Set<string> };

export async function loadInstructorEligibility(
  ctx: QueryCtx,
  instructorId: Id<"instructorProfiles">,
): Promise<InstructorEligibility> {
  const sportRows = await ctx.db
    .query("instructorSports")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
    .collect();
  return { sports: new Set(sportRows.map((r) => r.sport)) };
}
```

- [ ] **Step 2: Update all callers**

Search codebase for `hasCoverageKey`, `isEligibleForJob`, `coverageCount`, `coveragePairs`, `coverageBySport` and remove/update them. Location filtering is now handled by H3 queries, not zone eligibility.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/instructorEligibility.ts
git commit -m "refactor: simplify instructor eligibility to sport-only (H3 handles location)"
```

---

### Task 9: Rewrite `getAvailableJobsForInstructor` to use H3

**Files:**
- Modify: `convex/jobs.ts`

- [ ] **Step 1: Update imports**

Add:
```typescript
import { getWatchZoneCells, queryJobsByH3Cells } from "./lib/h3";
import { normalizeWorkRadiusKm } from "./lib/locationRadius";
```

Remove zone/boundary imports that are only used by this function:
```typescript
import { buildLegacyZoneBoundary, ... } from "./lib/boundaries";
```

- [ ] **Step 2: Remove `collectOpenJobsByBoundaryCoverage` helper**

This helper (around line 105) uses `by_sport_boundary_status_postedAt` index. Delete it entirely.

- [ ] **Step 3: Rewrite the handler**

Replace the zone/geospatial/boundary query logic (lines ~960-1047) with:

```typescript
handler: async (ctx, args) => {
  const instructor = await requireInstructorProfile(ctx);
  const now = args.now ?? Date.now();
  const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);

  // Load instructor's sports
  const sportRows = await ctx.db
    .query("instructorSports")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
    .collect();
  const sports = new Set(sportRows.map((r) => r.sport));

  if (sports.size === 0) return [];

  const hasLocation =
    Number.isFinite(instructor.latitude) &&
    Number.isFinite(instructor.longitude);

  if (!hasLocation) return [];

  const workRadiusKm = normalizeWorkRadiusKm(instructor.workRadiusKm);
  const hexCells = getWatchZoneCells(
    instructor.latitude!,
    instructor.longitude!,
    workRadiusKm,
  );

  const rawLimit = args.limit ?? 50;
  const limit = Math.min(rawLimit, 200);

  const matchingJobs = await queryJobsByH3Cells(ctx, {
    hexCells,
    sports,
    status: "open",
    limit,
  });

  // Filter out jobs that have started or passed application deadline
  const actionableJobs = matchingJobs.filter((job) => {
    if (job.startTime <= now) return false;
    if (
      typeof job.applicationDeadline === "number" &&
      Number.isFinite(job.applicationDeadline) &&
      job.applicationDeadline <= now
    ) {
      return false;
    }
    return true;
  });

  if (actionableJobs.length === 0) return [];

  // ... rest stays the same (load applications, build response objects)
  // Replace zone/boundaryProvider/boundaryId in return type with h3Index
};
```

- [ ] **Step 4: Commit**

```bash
git add convex/jobs.ts
git commit -m "feat: rewrite getAvailableJobsForInstructor to use H3 queries"
```

---

### Task 10: Rewrite `getMyInstructorHomeStatsRead` to use H3

**Files:**
- Modify: `convex/homeRead.ts`

- [ ] **Step 1: Replace imports**

Remove ALL of these (lines 1-16):
```typescript
import { findNearbyStudioBranchIdsForInstructor } from "./lib/geospatial";
import { requireUserRole } from "./lib/auth";
import { isKnownZoneId } from "./lib/domainValidation";
import {
  hasCoverageKey,
  type InstructorEligibility,
  isEligibleForJob,
  loadInstructorEligibility,
} from "./lib/instructorEligibility";
```

Add:
```typescript
import { getWatchZoneCells, queryJobsByH3Cells } from "./lib/h3";
import { normalizeWorkRadiusKm } from "./lib/locationRadius";
import { loadInstructorEligibility } from "./lib/instructorEligibility";
```

Note: `requireUserRole` should stay — it's still needed. Only remove the zone/geospatial-specific imports.

- [ ] **Step 2: Replace the `openMatches` computation**

Replace the entire `openMatches` block (lines ~218-299, which has three branches: geospatial, zone-coverage, sport-only) with:

```typescript
let openMatches = 0;

const hasLocation =
  Number.isFinite(instructorProfile.latitude) &&
  Number.isFinite(instructorProfile.longitude);

if (hasLocation && eligibility.sports.size > 0) {
  const workRadiusKm = normalizeWorkRadiusKm(instructorProfile.workRadiusKm);
  const hexCells = getWatchZoneCells(
    instructorProfile.latitude!,
    instructorProfile.longitude!,
    workRadiusKm,
  );

  const matchingJobs = await queryJobsByH3Cells(ctx, {
    hexCells,
    sports: eligibility.sports,
    status: "open",
    limit: HOME_MATCH_COUNT_CAP,
  });

  openMatches = matchingJobs.filter((job) => {
    if (job.startTime <= now) return false;
    if (job.applicationDeadline !== undefined && job.applicationDeadline < now) return false;
    return true;
  }).length;
}
```

Remove the now-unused functions: `countEligibleOpenJobMatches`, `countEligibleOpenJobMatchesBySport`.

- [ ] **Step 3: Commit**

```bash
git add convex/homeRead.ts
git commit -m "feat: rewrite instructor home stats to use H3 queries"
```

---

### Task 11: Rewrite notification targeting to use H3

**Files:**
- Modify: `convex/notificationsCore.ts`

**CRITICAL:** The current `getJobAndEligibleInstructors` (line ~157) is an `internalQuery`. This must be converted to `internalAction` because:
1. H3 `gridDisk` with k=33 produces 3367 cells
2. 3367 parallel DB lookups will exceed Convex query time limits
3. Actions have higher compute budgets (as stated in the spec)

- [ ] **Step 1: Convert from `internalQuery` to `internalAction`**

Change the function definition from `internalQuery` to `internalAction`. Update any callers that reference it via `api.notificationsCore.getJobAndEligibleInstructors` — they must now handle the async action pattern.

- [ ] **Step 2: Replace imports**

Remove:
```typescript
import { findNearbyInstructorsForBranch } from "./lib/geospatial";
import { normalizeBoundaryId, normalizeBoundaryProvider } from "./lib/boundaries";
import { isKnownZoneId } from "./lib/domainValidation";
```

Add:
```typescript
import { gridDisk } from "h3-js";
import { radiusToK } from "./lib/h3";
import { MAX_WORK_RADIUS_KM } from "./lib/locationRadius";
```

- [ ] **Step 3: Rewrite the instructor finding logic**

Replace the geospatial.nearest() and boundary-based logic with H3 cell lookup. Process in chunks to avoid action timeouts:

```typescript
const branch = await ctx.db.get(job.branchId);
if (!branch?.h3Index) return [];

const kMax = radiusToK(MAX_WORK_RADIUS_KM);
const allCells = gridDisk(branch.h3Index, kMax);

const CHUNK_SIZE = 500;
const seen = new Set<string>();
const eligibleInstructors = [];

for (let i = 0; i < allCells.length; i += CHUNK_SIZE) {
  const chunk = allCells.slice(i, i + CHUNK_SIZE);

  const profilesByCell = await Promise.all(
    chunk.map((hex) =>
      ctx.db
        .query("instructorProfiles")
        .withIndex("by_h3_index", (q) => q.eq("h3Index", hex))
        .collect()
    )
  );

  for (const profiles of profilesByCell) {
    for (const profile of profiles) {
      if (seen.has(String(profile._id))) continue;
      seen.add(String(profile._id));

      if (!profile.notificationsEnabled || !profile.expoPushToken) continue;

      const instructorSports = await ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect();

      if (!instructorSports.some((s) => s.sport === job.sport)) continue;

      eligibleInstructors.push({ profile, sports: instructorSports });
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add convex/notificationsCore.ts
git commit -m "feat: rewrite notification targeting to use H3 (convert to action)"
```

---

### Task 12: Update onboarding flows

**Files:**
- Modify: `convex/onboarding.ts`

- [ ] **Step 1: Remove zone references**

- Line 12: Remove `normalizeZoneId` from import of `./lib/domainValidation`
- Lines 123-178: Remove zone normalization and validation during instructor onboarding
- Lines 298-407: Remove zone assignment and `resolveBoundaryAssignment` in studio branch creation — replace with H3 computation:

```typescript
import { safeH3Index } from "./lib/h3";

// In studio branch creation during onboarding:
h3Index: safeH3Index(args.latitude, args.longitude),
```

- [ ] **Step 2: Commit**

```bash
git add convex/onboarding.ts
git commit -m "refactor: replace zone assignment with H3 in onboarding"
```

---

### Task 13: Test Phase 2

- [ ] **Step 1: Deploy and smoke test**

```bash
cd /home/derpcat/projects/queue && bunx convex deploy
```

- [ ] **Step 2: Verify instructor job board loads correctly**
- [ ] **Step 3: Verify home stats show correct match count**
- [ ] **Step 4: Create a test job and verify notification delivery**
- [ ] **Step 5: If issues found, rollback by redeploying old code (both zone and h3Index fields coexist)**

---

## Phase 3: Remove old system

### Task 14: Change `jobs.h3Index` from optional to required

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Change `jobs.h3Index` to required**

Now that all jobs have been backfilled:
```typescript
// Change from
h3Index: v.optional(v.string()),
// to
h3Index: v.string(),
```

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "refactor: make jobs.h3Index required (backfill complete)"
```

---

### Task 15: Remove zone/boundary fields from schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Remove zone/boundary fields and indexes**

From `jobs` table:
- Remove fields: `zone`, `boundaryProvider`, `boundaryId`
- Remove indexes: `by_zone_and_status`, `by_sport_zone_status_postedAt`, `by_boundary_and_status`, `by_sport_boundary_status_postedAt`

From `studioBranches` table:
- Remove fields: `zone`, `boundaryProvider`, `boundaryId`
- Remove indexes: `by_zone`, `by_boundary`

From `studioProfiles` table:
- Remove fields: `zone`, `boundaryProvider`, `boundaryId`
- Remove indexes: `by_zone`, `by_boundary`

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "refactor: remove zone/boundary fields from schema"
```

---

### Task 16: Drop old tables and clean up domainValidation

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/lib/domainValidation.ts`

- [ ] **Step 1: Drop old table definitions from schema**

Remove: `instructorZones`, `instructorCoverage`, `instructorGeoCoverage`, `instructorBoundarySubscriptions`, `boundaries`

- [ ] **Step 2: Remove zone functions from `domainValidation.ts`**

Remove `isKnownZoneId`, `normalizeZoneId`. Keep `normalizeSportType`, `normalizeCapabilityTagArray`.

Search codebase for remaining callers of removed functions and update.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/lib/domainValidation.ts
git commit -m "refactor: drop zone tables and remove zone validation"
```

---

### Task 17: Delete old files and remove geospatial component

**Files:**
- Delete: 6 files
- Modify: `convex/components.ts`, `convex/convex.config.ts`, `package.json`
- Modify: `convex/migrations.ts` — remove old geospatial/boundary migration imports

- [ ] **Step 1: Delete obsolete files**

```bash
rm convex/instructorZones.ts convex/boundaries.ts convex/pikud-zones.generated.ts convex/lib/boundaries.ts convex/lib/geospatial.ts convex/lib/instructorCoverage.ts
```

- [ ] **Step 2: Remove geospatial component from `convex/components.ts`**

Remove: `import { GeospatialIndex } from "@convex-dev/geospatial";` and `export const geospatial = new GeospatialIndex(components.geospatial);`

- [ ] **Step 3: Remove from `convex/convex.config.ts`**

Remove: `import geospatial from "@convex-dev/geospatial/convex.config.js";` and `app.use(geospatial);`

- [ ] **Step 4: Remove package**

```bash
bun remove @convex-dev/geospatial
```

- [ ] **Step 5: Clean up `convex/migrations.ts` imports**

Remove old imports: `syncInstructorGeospatialCoverage`, `syncStudioBranchGeospatialLocation` from `./lib/geospatial`, `isKnownZoneId` from `./lib/domainValidation`. Remove or comment out old geospatial backfill migrations that reference deleted files.

- [ ] **Step 6: Search for and fix remaining imports of deleted files**

```bash
grep -rn "from.*\./lib/geospatial\|from.*\./lib/boundaries\|from.*\./lib/instructorCoverage\|from.*\./instructorZones\|from.*\./boundaries\|isKnownZoneId\|normalizeZoneId\|syncInstructorGeospatialCoverage\|syncStudioBranchGeospatialLocation\|resolveBoundaryAssignment\|buildLegacyZoneBoundary" convex/ --include="*.ts"
```

Fix every match found.

- [ ] **Step 7: Commit**

```bash
git add -A convex/
git commit -m "refactor: delete zone/boundary/geospatial files and component"
```

---

### Task 18: Final cleanup and deploy

- [ ] **Step 1: Final search for remaining references**

```bash
grep -rn "by_zone\|by_boundary\|by_sport_zone\|collectOpenJobsByBoundaryCoverage\|instructorGeoCoverage\|geospatial\." convex/ --include="*.ts"
```

Fix any remaining references.

- [ ] **Step 2: Deploy**

```bash
cd /home/derpcat/projects/queue && bunx convex deploy
```

- [ ] **Step 3: End-to-end test**
- Create a studio branch with coordinates
- Post a job from that branch
- Verify instructor with overlapping H3 radius sees the job
- Verify notification is delivered
- Verify home stats show correct match count

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete H3 geospatial migration"
```

---

## Post-Migration: Frontend cleanup (separate plan)

The frontend has ~83 files referencing `zone`, `boundaryProvider`, `boundaryId`. These need a follow-up plan covering:
- Remove zone selection UI from onboarding and profile settings
- Update job board components to consume `h3Index` instead of `zone`
- Remove `src/lib/location-zone.ts`, `src/constants/zones*.ts`
- Update map components to show H3 hex overlays instead of zone boundaries
- This is intentionally deferred — backend is self-contained and the zone fields are now removed from the API responses
