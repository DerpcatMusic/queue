# Convex Jobs Marketplace - Planning Review
**Date**: 2026-03-22  
**Status**: READ-ONLY Research

---

## 1. Schema Evolution for New Job States/Settings

### Official Guidance
Convex uses **zero-downtime schema evolution** with no migration files. Changes deploy instantly via `npx convex dev`.

**Reference**: [Convex Schema Docs](https://docs.convex.dev/database/schemas)

### Recommendations

#### Adding New States/Statuses
```typescript
// Step 1: Add as OPTIONAL first (never required immediately)
status: v.union(
  v.literal("open"),
  v.literal("filled"),
  v.literal("cancelled"),
  v.literal("completed"),
  v.literal("expired"),        // NEW - add as optional initially
  v.literal("pending_review"), // NEW - add as optional initially
),

// Step 2: Update code to handle all states before making required

// Step 3: After backfill, optionally enforce required
```

#### Adding New Fields
```typescript
// Step 1: Optional field in schema
autoAcceptFirstApplicant: v.optional(v.boolean()),
expiresAt: v.optional(v.number()),

// Step 2: Handle undefined in all queries/mutations
return job.autoAcceptFirstApplicant ?? false,

// Step 3: Backfill via internalMutation with pagination
```

### Pitfalls
| Pitfall | Prevention |
|---------|------------|
| Making fields required immediately | Always start optional |
| Not handling `undefined` values | Null-coalesce in all read paths |
| Missing indexes for new filter fields | Add indexes BEFORE querying in production |
| Large batch backfills timing out | Use pagination with `BATCH_SIZE ≤ 200` |

### Verification Ideas
- [ ] Schema diff shows only additive changes
- [ ] All queries handle optional/required variants
- [ ] Backfill mutation completes without errors
- [ ] Index is ready before production queries use it

---

## 2. Deterministic First-Applicant-Wins Auto-Accept

### Official Guidance
Convex uses **Optimistic Concurrency Control (OCC)** with versioning. Mutations can conflict if they read-then-write same documents.

**Reference**: [Convex OCC](https://docs.convex.dev/database/advanced/occ)

### Current State
The codebase has `applicationDeadline` field and studio manually accepts applications (lines 1540-1589 in jobs.ts). No current auto-accept logic.

### Recommendations for Auto-Accept Pattern

#### The Race Condition Problem
```
T1: Read job (status=open, 0 applicants)  
T2: Read job (status=open, 0 applicants)  
T1: Insert application, patch job status=filled  
T2: Insert application (SHOULD FAIL - job is filled)
```

#### Solution: Atomic Check-and-Update Mutation
```typescript
export const applyWithAutoAccept = mutation({
  args: {
    jobId: v.id("jobs"),
    message: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ success: v.literal(true), applicationId: v.id("jobApplications") }),
    v.object({ success: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) return { success: false, reason: "Job not found" };
    
    // ATOMIC: Check conditions before ANY insert
    if (job.status !== "open") {
      return { success: false, reason: "Job is no longer open" };
    }
    
    // Check deadline
    if (job.applicationDeadline && Date.now() > job.applicationDeadline) {
      return { success: false, reason: "Application deadline passed" };
    }
    
    // First-come-first-served: Insert application
    const instructor = await requireInstructorProfile(ctx);
    const applicationId = await ctx.db.insert("jobApplications", {
      jobId: job._id,
      studioId: job.studioId,
      instructorId: instructor._id,
      status: "pending", // Will auto-accept below
      appliedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // If autoAcceptFirstApplicant=true, fill job atomically
    if (job.autoAcceptFirstApplicant) {
      // Re-verify job is still open (OCC)
      const recheck = await ctx.db.get("jobs", job._id);
      if (recheck && recheck.status === "open") {
        // Fill the job - other applicants will see "filled" on their apply attempt
        await ctx.db.patch("jobs", job._id, {
          status: "filled",
          filledByInstructorId: instructor._id,
        });
        // Update this application to accepted
        await ctx.db.patch("jobApplications", applicationId, { status: "accepted" });
      }
    }
    
    return { success: true, applicationId };
  },
});
```

#### Deterministic Tie-Breaking (if multiple arrive simultaneously)
If two applications INSERT simultaneously before either checks the other's existence:
```typescript
// Use _creationTime as tie-breaker (immutable, monotonic per Convex)
// Sort by: 1) earliest appliedAt wins, 2) lowest _id if tied (Lex order)

// NEVER rely on mutation order - Convex doesn't guarantee ordering
```

### Pitfalls
| Pitfall | Prevention |
|---------|------------|
| Read-then-write races | Always re-check state after insert, before finalizing |
| ApplicationDeadline checked at query time | Store deadline as field, check in mutation |
| `Date.now()` in queries (stale cache) | Use `isExpired` boolean field, update via cron |

### Verification Ideas
- [ ] Concurrent `applyWithAutoAccept` calls → exactly 1 wins
- [ ] Non-auto-accept jobs → status stays `open` after first application
- [ ] After deadline → all new applications return `success: false`

---

## 3. Expiry Evaluation and Visibility Filtering

### Official Guidance
**Never use `Date.now()` in queries** - queries cache results and won't re-run when time changes.

**Reference**: [Convex Best Practices](https://docs.convex.dev/understanding/best-practices)

### Current State
Existing `applicationDeadline` field is checked in mutation logic (line 900-903 in jobs.ts).

### Recommendations

#### Pattern 1: Boolean Flag + Cron (Recommended)
```typescript
// Schema
isExpired: v.optional(v.boolean()), // Default: false

// Cron job (runs every minute)
crons.interval("checkExpiredJobs", { minutes: 1 }, internal.jobs.markExpired);

// Mutation
export const markExpired = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const expiredJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .filter((job) => 
        job.applicationDeadline !== undefined && 
        job.applicationDeadline < now &&
        job.isExpired !== true
      )
      .take(100);
    
    for (const job of expiredJobs) {
      await ctx.db.patch(job._id, { isExpired: true });
    }
  },
});
```

#### Pattern 2: Scheduled Expiration (Simpler)
```typescript
// When creating job
await ctx.scheduler.runAfter(
  job.applicationDeadline - Date.now(),
  internal.jobs.expireJob,
  { jobId: job._id },
);
```

### Visibility Filtering

#### Hide Expired from Public Feeds
```typescript
// Query for job board (hide expired)
export const listOpenJobs = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.array(v.object({ ...job fields ... })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .filter((job) => job.isExpired !== true) // Hide expired
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

#### Index Strategy
Add compound index for efficient filtering:
```typescript
.index("by_status_and_expired", ["status", "isExpired"])
```

### Pitfalls
| Pitfall | Prevention |
|---------|------------|
| `Date.now()` in query cache | Use `isExpired` boolean, not time comparison |
| Stale reads | Cron must run frequently enough (≤1 min for deadlines) |
| Missed expirations | Use scheduler for precise deadline tracking |

### Verification Ideas
- [ ] Job with past deadline → `isExpired === true` within 1 minute
- [ ] Expired jobs excluded from `listOpenJobs`
- [ ] Expired jobs still visible in studio dashboard

---

## 4. Preserving History While Hiding Expired Items

### Recommendations

#### Soft Delete Pattern
```typescript
// Don't delete - mark as hidden
.hiddenFromPublic: v.optional(v.boolean()),
hiddenAt: v.optional(v.number()),

// Or use existing status for history
status: v.union(
  "open", "filled", "cancelled", "completed",
  "expired_unfilled", // New state for history
),
```

#### Dual Query Patterns
```typescript
// Public feed - excludes expired
export const listJobsForInstructors = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .filter((job) => job.isExpired !== true)
      .take(50);
  },
});

// Studio history - includes all states
export const listJobsForStudio = query({
  args: { studioId: v.id("studioProfiles") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_studio", (q) => q.eq("studioId", args.studioId))
      .order("desc")
      .collect();
  },
});
```

#### Application History
Applications already have `status` field with values: `pending`, `accepted`, `rejected`, `withdrawn`. This preserves history automatically.

### Verification Ideas
- [ ] Expired job not in instructor job board
- [ ] Expired job visible in studio "Past Jobs" list
- [ ] All applications preserved regardless of job status

---

## 5. TDD/Contract Testing in Bun + Convex TypeScript

### Official Guidance
Convex provides `convex-test` library for testing with Vitest.

**Reference**: [Convex Testing](https://docs.convex.dev/testing/convex-test)

### Current Project Setup
The project already uses Bun (`bun test` in scripts) but doesn't appear to have `convex-test` installed.

### Recommendations

#### Setup for Bun + Convex
```bash
# Install dependencies
bun add -d vitest @edge-runtime/vm convex-test
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

#### Test Structure
```typescript
// jobs.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

describe("jobs.applyWithAutoAccept", () => {
  it("accepts first applicant when autoAcceptFirstApplicant is true", async () => {
    const t = convexTest(schema);
    
    // Create studio
    const studioUserId = await t.mutation(internal.users.create, {...});
    const studioId = await t.mutation(internal.studioProfiles.create, {...});
    
    // Create job with auto-accept
    const jobId = await t.mutation(internal.jobs.create, {
      studioId,
      autoAcceptFirstApplicant: true,
      ...
    });
    
    // Create instructor
    const instructorId = await t.mutation(internal.instructorProfiles.create, {...});
    
    // First application
    const result1 = await t.mutation(api.jobs.applyWithAutoAccept, {
      jobId,
      instructorId,
    });
    
    expect(result1.success).toBe(true);
    
    // Verify job is filled
    const job = await t.query(api.jobs.get, { jobId });
    expect(job.status).toBe("filled");
  });
  
  it("rejects second applicant when job is already filled", async () => {
    const t = convexTest(schema);
    // ... setup job and first applicant ...
    
    const result2 = await t.mutation(api.jobs.applyWithAutoAccept, {
      jobId,
      instructorId: instructor2Id,
    });
    
    expect(result2.success).toBe(false);
    expect(result2.reason).toBe("Job is no longer open");
  });
});

describe("Concurrent applications", () => {
  it("only one application wins when applying simultaneously", async () => {
    const t = convexTest(schema);
    // ... setup ...
    
    // Simulate concurrent applications
    const [result1, result2] = await Promise.all([
      t.mutation(api.jobs.applyWithAutoAccept, { jobId, instructorId: i1 }),
      t.mutation(api.jobs.applyWithAutoAccept, { jobId, instructorId: i2 }),
    ]);
    
    // Exactly one should succeed
    const successes = [result1.success, result2.success].filter(Boolean);
    expect(successes.length).toBe(1);
  });
});
```

#### Contract Testing Pattern
```typescript
// Test schema contract - all required fields present
describe("Schema contract", () => {
  it("jobs have required fields", () => {
    const requiredFields = ["studioId", "sport", "startTime", "endTime", "pay", "status", "postedAt"];
    // Test that schema enforces these
  });
});

// Test index contract - queries use correct indexes
describe("Index contract", () => {
  it("listOpenJobs uses by_status index", () => {
    // Verify query uses .withIndex("by_status")
  });
});
```

### Pitfalls
| Pitfall | Prevention |
|---------|------------|
| Missing `convex-test` package | Add to devDependencies |
| Using wrong test environment | Configure `edge-runtime` |
| Not testing error paths | Cover all ConvexError throws |
| Concurrent tests affecting each other | Use isolated `convexTest` instances per test |

### Verification Ideas
- [ ] `bun test` passes in CI
- [ ] Concurrent mutation tests deterministic
- [ ] Error cases covered by tests
- [ ] Schema contract tests fail if fields removed

---

## Summary: Acceptance Criteria Checklist

### Schema Evolution
- [ ] New states added as optional, never required
- [ ] All read paths handle `undefined`
- [ ] Backfill mutation uses pagination (batch ≤ 200)
- [ ] Indexes added before production queries

### Auto-Accept Concurrency
- [ ] Exactly 1 winner on concurrent applications
- [ ] Re-check state after insert, before finalizing
- [ ] Tie-breaker uses `appliedAt` (or `_creationTime`)
- [ ] Failed applicants get clear error message

### Expiry/Visibility
- [ ] No `Date.now()` in query filters
- [ ] Boolean `isExpired` field updated via cron/scheduler
- [ ] Public feeds exclude expired
- [ ] Studio history includes expired jobs

### History Preservation
- [ ] Jobs never hard-deleted
- [ ] Applications preserved with status
- [ ] Clear separation between public/historical views

### Testing
- [ ] `convex-test` installed and configured
- [ ] Bun test runner configured
- [ ] Concurrent scenarios tested
- [ ] Error paths covered

---

## Key Documentation Links

- [Schema Evolution](https://docs.convex.dev/database/schemas)
- [Optimistic Concurrency Control](https://docs.convex.dev/database/advanced/occ)
- [Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions)
- [Testing with convex-test](https://docs.convex.dev/testing/convex-test)
- [Pagination](https://docs.convex.dev/database/pagination)
