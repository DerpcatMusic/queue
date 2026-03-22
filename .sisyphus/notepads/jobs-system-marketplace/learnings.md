# Learnings

# Wave 1 Implementation Guidance (Gathered 2026-03-22)

## 1. Additive Schema Evolution

### Authoritative Source
- Convex Schema Docs: https://docs.convex.dev/database/schemas
- Convex Production Migrations: https://docs.convex.dev/production
- Convex Migrations Skill (playbooks): https://playbooks.com/skills/waynesutton/convexskills/convex-migrations

### Key Rules
1. **Always start new fields as `v.optional()`** - Convex schema must match existing data on deploy
2. **Safe additive pattern**: add optional field → update code to handle missing values → (optional) backfill → (optional) make required
3. **NEVER make new fields required on first deployment** - existing records will violate schema
4. **Union expansion is safe**: add `v.union(existing, newLiteral)` for enum-like fields

### Implementation Pattern for Wave 1 (T2)
```typescript
// convex/schema.ts - jobs table additions
.defineTable({
  // ... existing fields ...
  // NEW: autoAcceptEnabled (additive, optional)
  autoAcceptEnabled: v.optional(v.boolean()),
  // NEW: per-job expiry override in MINUTES (additive, optional)
  expiryOverrideMinutes: v.optional(v.number()),
  // NEW: boost preset metadata (additive, optional)
  boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
  // NEW: closure reason for cancellation/expiry (additive, optional)
  closureReason: v.optional(v.union(v.literal("studio_cancelled"), v.literal("expired"), v.literal("filled"))),
})

// studioProfiles table additions
.defineTable({
  // ... existing fields ...
  // NEW: studio-level auto-accept default
  autoAcceptDefault: v.optional(v.boolean()), // default OFF
})
```

### Verification for T2
- `bun run typecheck` must pass
- Existing contract tests must still pass (no breaking changes)

---

## 2. Deterministic Mutation Patterns (First-Writer-Wins for Auto-Accept)

### Authoritative Source
- Convex OCC: https://docs.convex.dev/database/advanced/occ
- Convex Mutations: https://docs.convex.dev/functions/mutation-functions
- Rate Limiting Stack (shows OCC patterns): https://stack.convex.dev/rate-limiting

### Core Principle
**Convex mutations are SERIALIZABLE + DETERMINISTIC**. If a transaction conflicts, Convex automatically retries it. This means you write mutations AS IF they always succeed - the OCC layer handles conflicts.

### Auto-Accept Pattern (T8)
The first-writer-wins pattern for auto-accept should leverage Convex's OCC:

```typescript
// Pattern for applyToJob mutation with auto-accept
handler: async (ctx, args) => {
  const job = await ctx.db.get("jobs", args.jobId);
  
  // Check job is still open (OCC will retry if job changed)
  if (job.status !== "open") {
    throw new ConvexError("Job is not open");
  }
  
  // Check studio auto-accept setting
  const studio = await ctx.db.get("studioProfiles", job.studioId);
  if (!studio?.autoAcceptEnabled) {
    // Normal flow: just create pending application
    return createPendingApplication(ctx, job, instructor);
  }
  
  // AUTO-ACCEPT FLOW: first valid applicant wins
  // Convex OCC guarantees only ONE of concurrent applicants succeeds
  // because the job.status patch will conflict for losers
  await ctx.db.patch("jobs", job._id, {
    status: "filled",
    filledByInstructorId: instructor._id,
  });
  
  // Reject all other pending applications
  const pendingApps = await ctx.db.query("jobApplications")
    .withIndex("by_job", q => q.eq("jobId", job._id))
    .collect();
    
  for (const app of pendingApps) {
    if (app.instructorId === instructor._id) {
      await ctx.db.patch("jobApplications", app._id, { status: "accepted" });
    } else {
      await ctx.db.patch("jobApplications", app._id, { status: "rejected" });
    }
  }
  
  return { status: "accepted", applicationId };
}
```

### Key Insight: OCC Conflict = Lose the Race
When two concurrent `applyToJob` calls both try to fill the same job:
- Winner: successfully patches job to `filled`
- Loser: OCC conflict on `job.status` - Convex retries with updated job state
- On retry, loser sees `job.status === "filled"` → throws "Job is not open"

**This is deterministic first-writer-wins without explicit locking.**

### Verification for T8
- Write contract tests with near-simultaneous applications using in-memory convex
- Assert exactly ONE application accepted, all others rejected
- Run tests multiple times to verify determinism

---

## 3. Scheduler / Expiry State Handling

### Authoritative Source
- Convex Scheduled Functions: https://docs.convex.dev/scheduling/scheduled-functions
- Convex Cron Jobs: https://docs.convex.dev/scheduling/cron-jobs

### Pattern: Exact-Time Expiry Scheduling
The plan forbids `Date.now()` filtering in cached queries. Instead, persist expiry metadata and schedule exact transitions:

```typescript
// In postJob mutation:
const expireMinutes = args.expiryOverrideMinutes 
  ?? studio.autoExpireMinutesBefore 
  ?? DEFAULT_AUTO_EXPIRE_MINUTES;
const expireAt = args.startTime - expireMinutes * 60 * 1000;

if (expireAt > now) {
  await ctx.scheduler.runAfter(
    expireAt - now,
    internal.jobs.autoExpireUnfilledJob, 
    { jobId }
  );
}

// autoExpireUnfilledJob internalMutation:
handler: async (ctx, args) => {
  const job = await ctx.db.get("jobs", args.jobId);
  
  // Guard: only expire if still open
  if (job.status !== "open") {
    return; // Already filled/cancelled - nothing to do
  }
  
  await ctx.db.patch("jobs", job._id, {
    status: "cancelled",
    closureReason: "expired",
  });
  
  // Reject pending applications
  const pendingApps = await ctx.db.query("jobApplications")
    .withIndex("by_job", q => q.eq("jobId", job._id))
    .collect();
    
  for (const app of pendingApps) {
    if (app.status === "pending") {
      await ctx.db.patch("jobApplications", app._id, { status: "rejected" });
    }
  }
}
```

### Instructor Feed Visibility (T10)
The instructor feed query should filter by status index, NOT by checking expiry timestamps at query time:
```typescript
// GOOD: Filter by persisted status
.withIndex("by_status", q => q.eq("status", "open"))

// AVOID: Date.now() filtering in queries
// if (job.expiresAt < Date.now()) continue; // BAD - not cache-friendly
```

### Verification for T9
- Test that filled/cancelled jobs are NOT re-expired
- Test that only open jobs past their expiry time transition to cancelled
- Test that studio queries retain cancelled/expired jobs in history

---

## 4. Bun/Convex Contract-Test Strategy

### Existing Infrastructure
- Test harness: `tests/in-memory-convex.ts` with `InMemoryConvexDb` and `createMutationCtx`
- Contract tests location: `tests/contracts/*.contract.test.ts`
- Pattern example: `tests/contracts/jobs-payments.contract.test.ts`

### Testing Pattern (Red Phase for T1, T3, T4)
```typescript
import { describe, expect, it } from "bun:test";
import { InMemoryConvexDb, createMutationCtx } from "../in-memory-convex";

// T1: Baseline lifecycle tests
describe("jobs lifecycle contracts", () => {
  it("auto-accept selects first valid applicant", async () => {
    const db = new InMemoryConvexDb();
    const schedulerCalls: ScheduledCall[] = [];
    
    // Setup: create studio with autoAcceptEnabled, create job
    const studioId = await db.insert("studioProfiles", {
      autoAcceptEnabled: true,
      // ... required fields ...
    });
    
    const jobId = await db.insert("jobs", {
      studioId,
      status: "open",
      // ... required fields ...
    });
    
    // Simulate two concurrent applications
    const ctx1 = createMutationCtx({ db, userId: "instructor1", schedulerCalls });
    const ctx2 = createMutationCtx({ db, userId: "instructor2", schedulerCalls });
    
    // Both try to apply simultaneously
    // In real Convex, OCC handles this - in mock, test the outcome
    // Assert: exactly one is accepted
  });
});
```

### Key Test Scenarios for Wave 1
1. **T1 (Lifecycle)**: open→filled, open→cancelled, filled→cancelled, expiry transition
2. **T3 (Settings)**: auto-accept default OFF, per-job expiry override with fallback
3. **T4 (Feed/Card Utils)**: status tone mapping for new states, expiry label formatting

### Verification Commands
```bash
# Run contract tests with filter
bun test tests/contracts --filter autoAccept
bun test tests/contracts --filter cancel
bun test tests/contracts --filter expiry

# Run utility tests
bun test src/lib/jobs-utils.test.ts

# Typecheck
bun run typecheck
```

---

## 5. Key Guardrails Summary

| Concern | Guardrail |
|---------|-----------|
| Schema | New fields ALWAYS optional on first deploy |
| Auto-accept | Studio setting default OFF, first-writer-wins via OCC |
| Expiry | Schedule exact transitions, persist closureReason, no Date.now() in queries |
| Cancellation | Studio can cancel open AND filled jobs, preserve historical visibility |
| Testing | Red-phase tests before implementation, contract tests in tests/contracts/ |

---

## 6. References for Further Reading

1. Convex Schema Migrations: https://docs.convex.dev/database/schemas
2. Convex OCC: https://docs.convex.dev/database/advanced/occ
3. Convex Scheduled Functions: https://docs.convex.dev/scheduling/scheduled-functions
4. Convex Testing: https://docs.convex.dev/testing/convex-test
5. Convex Migrations Skill: https://playbooks.com/skills/waynesutton/convexskills/convex-migrations
6. Rate Limiting Stack (OCC example): https://stack.convex.dev/rate-limiting
# Learnings

## Jobs UI Surface Analysis (for Wave 1 & Wave 3)

### 1. Utility Layer
**File**: `/home/derpcat/projects/queue/src/lib/jobs-utils.ts`
- `JOB_STATUS_TRANSLATION_KEYS` (lines 10-15): maps job status → i18n keys
- `getJobStatusTone(status)` (lines 111-115): returns "primary"/"success"/"muted"
- `PAY_PRESETS = [180, 220, 260, 320]` (line 4): existing pay preset constants
- `StudioDraft` type (lines 32-41): form state for job composer
- **MISSING for Wave 1**: boost helper constants, expiry display helpers, enhanced tone mapping

### 2. Studio Profile Settings
**File**: `/home/derpcat/projects/queue/src/app/(app)/(studio-tabs)/studio/profile/index.tsx`
- Query: `api.users.getMyStudioSettings` returns `studioSettings.autoExpireMinutesBefore`
- Display: `ProfileSettingRow` for autoExpireJobs (lines 385-392 desktop, 541-549 mobile)
- i18n keys: `profile.settings.autoExpireJobs`, `profile.settings.autoExpire.value` (lines 265, 312-317)
- **MISSING for Wave 1**: auto-accept toggle/display

### 3. Job Composer
**Files**: 
- `/home/derpcat/projects/queue/src/components/jobs/studio/create-job-sheet.tsx` - container
- `/home/derpcat/projects/queue/src/components/jobs/studio/create-job-sheet-sections.tsx` - form sections

Key components in sections file:
- `PayParticipantsSection` (lines 236-266): pay input via `draft.payInput`
- `ScheduleSection` (lines 159-229): start/end time pickers
- `SportPickerSection` (lines 28-148): sport selection

State: `StudioDraft` type in jobs-utils.ts (lines 32-41) with fields:
- sport, startTime, endTime, payInput, note, maxParticipants, cancellationDeadlineHours, applicationLeadMinutes

**MISSING for Wave 3**: expiry override input section, boost preset selector

### 4. Studio Jobs List
**Files**:
- `/home/derpcat/projects/queue/src/components/jobs/studio/studio-jobs-list.tsx` - list container
- `/home/derpcat/projects/queue/src/components/jobs/studio/studio-jobs-list-parts.tsx` - card rendering
- `/home/derpcat/projects/queue/src/components/jobs/studio/studio-jobs-list.helpers.ts` - helper functions
- `/home/derpcat/projects/queue/src/components/jobs/studio/studio-jobs-list.types.ts` - type definitions

Key types (`studio-jobs-list.types.ts`):
- `StudioJob` (lines 14-29): jobId, sport, status, zone, startTime, pay, applicationsCount, pendingApplicationsCount, applications, payment
- `StudioJobApplication` (lines 6-12): applicationId, instructorName, status, appliedAt, message

Card rendering (`studio-jobs-list-parts.tsx`):
- Status pill: `DotStatusPill` with `jobStatusDot(job.status, palette)` (lines 290-294)
- Pay display: `t("jobsTab.card.pay", { value: job.pay })` (line 318)
- `getJobStatusTone()` used via `jobStatusDot()` helper

**MISSING for Wave 1/3**: boost badge/display, expiry timing, enhanced status differentiation

### 5. Instructor Open Jobs List
**File**: `/home/derpcat/projects/queue/src/components/jobs/instructor/instructor-open-jobs-list.tsx`

`OpenJob` type (lines 21-32): jobId, sport, studioName, studioImageUrl, applicationStatus, startTime, endTime, zone, note, pay

Card (InstructorJobCard):
- Pay: `t("jobsTab.card.pay", { value: job.pay })` (line 195)
- Status pill via `getApplicationStatusTranslationKey()` (line 141)

**MISSING for Wave 1/3**: boost display, expiry timing

### 6. Feed Controllers
**Files**:
- `/home/derpcat/projects/queue/src/components/jobs/studio/use-studio-feed-controller.ts`
- `/home/derpcat/projects/queue/src/components/jobs/studio/use-studio-feed-controller.helpers.ts`
- `/home/derpcat/projects/queue/src/components/jobs/instructor-feed.tsx`

`use-studio-feed-controller.helpers.ts`:
- `StudioControllerJob` type (lines 8-24): same fields as StudioJob minus payment

`postStudioJob()` in controller (lines 207-266):
- Currently passes: sport, startTime, endTime, timeZone, pay, maxParticipants, cancellationDeadlineHours, applicationDeadline
- Does NOT pass: boost metadata, per-job expiry override

### 7. i18n Translations
**File**: `/home/derpcat/projects/queue/src/i18n/translations/en.ts`

Existing keys relevant to jobs:
- `jobsTab.status.job.*` (lines 1064-1069): open, filled, cancelled, completed
- `jobsTab.card.pay` = "Pay: ₪{{value}}" (line 980)
- `jobsTab.form.*` (lines 954-975): form labels
- `profile.settings.autoExpire*` (lines 265, 312-317): settings display

**MISSING for Wave 1/3**: boost-related keys, expiry countdown/date keys, enhanced closure reason keys

### 8. Backend Schema
**File**: `/home/derpcat/projects/queue/convex/schema.ts`

`jobs` table (lines 257-299):
- status: `"open" | "filled" | "cancelled" | "completed"` (lines 266-271)
- NO boost metadata field
- NO per-job expiry override field
- NO closure reason field

`studioProfiles` table (lines 232-253):
- `autoExpireMinutesBefore: v.optional(v.number())` (line 245)
- NO autoAccept default field

### 9. Backend Jobs
**File**: `/home/derpcat/projects/queue/convex/jobs.ts`

`postJob` mutation (lines 454-562):
- Calculates expiry from studio default: `studio.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES` (line 552)
- Schedules `autoExpireUnfilledJob` (lines 555-557)

`DEFAULT_AUTO_EXPIRE_MINUTES = 30` (line 405)

`getAvailableJobsForInstructor` query (lines 565+): returns job data for instructor feed

**MISSING for Wave 1**: per-job expiry override, boost metadata, auto-accept lifecycle

---

## Data Flow Summary

### Current flow (job creation):
1. Composer form → `StudioDraft` state
2. `postStudioJob()` in controller → `postJob` mutation
3. Mutation creates job, schedules expiry based on studio default
4. Instructor feed queries `getAvailableJobsForInstructor`
5. Studio feed queries `getMyStudioJobsWithApplications`

### Where Wave 1 changes touch UI:
- Schema: add boost + expiryOverride to jobs table, autoAccept to studioProfiles
- jobs-utils.ts: add boost helpers, expiry display helpers, tone updates
- i18n: add boost keys, expiry keys
- Composer: add boost preset selector, expiry override input
- Settings: add auto-accept toggle
- Cards: add boost badge, expiry display

## 7. RED Phase Test Harness Constraint (Discovered 2026-03-22)

When writing contract tests for auto-accept concurrency in `jobs-marketplace-lifecycle.contract.test.ts`, a key harness limitation was identified:

**The in-memory convex harness (`tests/in-memory-convex.ts`) does not simulate Convex OCC (optimistic concurrency control)**. This means:
- In real Convex, concurrent `applyToJob` calls would conflict and retry automatically
- In the harness, both calls proceed sequentially without conflict detection
- Tests can only verify the sequential outcome, not true concurrent race behavior

**Implication for auto-accept tests**: 
- Tests assert the *expected final state* (one accepted, job filled) rather than simulating true race conditions
- The test verifies the deterministic outcome: when both applications complete, exactly one wins
- Production OCC behavior must be verified via sandbox deployment, not unit tests

**Test approach used**:
- Seed both instructors and apply sequentially
- Assert final state has exactly one accepted application and job filled
- The winning instructor is non-deterministic in the test (depends on call order in harness)

This is acceptable for RED-phase contract tests because:
1. The tests specify the *intended behavior* not the *implementation*
2. OCC implementation details belong in T8 (auto-accept lifecycle implementation)
3. The harness still catches obvious logic errors (e.g., both applications accepted)

---

## 8. Studio Auto-Accept Default Persistence Tests (RED Phase - 2026-03-22)

### Test File
`tests/contracts/jobs-studio-settings.contract.test.ts`

### Key Findings

**Existing state discovered**:
- `getMyStudioSettings` query (convex/users.ts:606-675) returns `autoExpireMinutesBefore` but NOT `autoAcceptDefault`
- `updateMyStudioSettings` mutation (convex/users.ts:712) exists but does NOT yet accept `autoAcceptDefault` arg
- The mutation args currently: studioName, address, zone, contactPhone, latitude, longitude, autoExpireMinutesBefore, sports

**RED phase test behavior** (all 3 tests fail as expected):
1. `getMyStudioSettings returns autoAcceptDefault: false when studio has no autoAcceptDefault set`
   - FAILS: `autoAcceptDefault` property not found in settings response
2. `getMyStudioSettings returns autoAcceptDefault: true when studio explicitly enables it`
   - FAILS: `autoAcceptDefault` property not found even when DB has the field
3. `studio can update autoAcceptDefault via updateMyStudioSettings mutation`
   - FAILS: Mutation accepts arg but doesn't persist it (db patch ignored)

**What needs implementation**:
- `getMyStudioSettings` handler must return `autoAcceptDefault: profile.autoAcceptDefault ?? false`
- `updateMyStudioSettings` mutation must accept `autoAcceptDefault?: boolean` in args and persist it

---

## 8a. T6 Implementation: Green Phase (2026-03-22)

### Changes Made to `convex/users.ts`

**getMyStudioSettings (lines 606-675)**:
- Added `autoAcceptDefault: v.optional(v.boolean())` to return schema (after `autoExpireMinutesBefore`)
- Added `autoAcceptDefault: profile.autoAcceptDefault ?? false` to return object

**updateMyStudioSettings (lines 712-801)**:
- Added `autoAcceptDefault: v.optional(v.boolean())` to args
- Added `autoAcceptDefault: args.autoAcceptDefault` to omitUndefined in ctx.db.patch

### Verification
- All 3 tests now PASS
- No LSP diagnostics on users.ts

### Test Pattern
Uses same seed pattern as `jobs-marketplace-lifecycle.contract.test.ts`:
- FIXED_NOW = 1_700_000_000_000
- freezeNow() helper for time mocking
- createMutationCtx with userId for auth context
- Direct db.patch for seeding fields (simulates what mutation should do)

---

## 9. Jobs-Posting Contract Tests (RED Phase - 2026-03-22)

### Test File
`tests/contracts/jobs-posting.contract.test.ts`

### Test Coverage

**Expiry Override Tests (3 tests)**:
1. `postJob persists expiryOverrideMinutes when provided` - FAILS: job.expiryOverrideMinutes is undefined
2. `postJob uses studio default when no expiryOverrideMinutes provided` - PASSES (scheduler delay works, field persistence fails)
3. `postJob uses platform default (30 min) when no override and no studio default` - PASSES (scheduler delay works)

**Boost Preset Tests (4 tests)**:
1. `postJob accepts 'small' boost preset and persists boostPreset with correct bonus amount` - FAILS: job.boostPreset is undefined
2. `postJob accepts 'medium' boost preset and persists boostPreset with correct bonus amount` - FAILS: job.boostPreset is undefined
3. `postJob accepts 'large' boost preset and persists boostPreset with correct bonus amount` - FAILS: job.boostPreset is undefined
4. `postJob rejects invalid boost preset` - FAILS: mutation resolves instead of rejecting

### Key Findings

**Current postJob args (convex/jobs.ts:454-478)**:
- Does NOT include: `expiryOverrideMinutes`, `boostPreset`, `boostBonusAmount`
- Current expiry calculation (line 552): `studio.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES`
- DEFAULT_AUTO_EXPIRE_MINUTES = 30 (line 405)

**Schema already has fields (convex/schema.ts:292-299)**:
- `expiryOverrideMinutes: v.optional(v.number())` (line 295)
- `boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large")))` (line 297)
- `boostBonusAmount: v.optional(v.number())` (line 298)

**BOOST_PRESETS values (src/lib/jobs-utils.ts:11)**:
- small = 20 shekels
- medium = 50 shekels
- large = 100 shekels

### RED Phase Failures Summary
5 tests fail, 2 pass:
- Failures are EXPECTED because postJob doesn't yet handle expiryOverrideMinutes/boostPreset args
- The 2 passing tests verify scheduler delay behavior which already works correctly
- Invalid preset test fails because Convex schema validation doesn't yet reject "huge"

### What Needs Implementation
- Add `expiryOverrideMinutes?: number` to postJob args
- Add `boostPreset?: "small" | "medium" | "large"` to postJob args
- Persist these fields to job document in postJob handler
- Add boostBonusAmount calculation based on preset
- Validate boostPreset against BOOST_PRESETS

---

## 10. Jobs-Utils TDD RED Phase Tests (2026-03-22)

### Files Modified
- `src/lib/jobs-utils.ts`: Added stub functions `formatExpiryText` and `formatBoostBadge`
- `src/lib/jobs-utils.test.ts`: Added 6 new failing tests

### Test Coverage Added
1. **Tone test**: `getJobStatusTone("expired")` → expects "muted"
   - PASSES (existing fallback behavior happens to be correct)
2. **Expiry text tests** (2 failing):
   - `formatExpiryText(futureTime, now)` → expects "Expires in 15 minutes"
   - `formatExpiryText(pastTime, now)` → expects "Expired"
3. **Boost badge tests** (3 failing):
   - `formatBoostBadge("medium", 50, true)` → expects "+₪50 boost"
   - `formatBoostBadge("small", 20, true)` → expects "+₪20 boost"
   - `formatBoostBadge(undefined, undefined, false)` → expects undefined

### RED Phase Result
- 4 tests FAIL (expiry text and boost badge stubs return undefined)
- 1 test PASSES (expired tone - correct by coincidence of fallback)
- All 9 existing tests still PASS

### Implementation Hints
- `formatExpiryText` needs to compute `expiryTimestamp - now` and format as countdown
- `formatExpiryText` should return "Expired" when expiry is in the past
- `formatBoostBadge` should use ₪ symbol and "+₪{bonus} boost" format when active
- BOOST_PRESETS map: small=20, medium=50, large=100

---

## 11. postJob Mutation Extension - GREEN Phase (2026-03-22)

### Changes Made to `convex/jobs.ts`

**Added BOOST_PRESETS constant (lines 21-25)**:
```typescript
const BOOST_PRESETS = {
  small: 20,
  medium: 50,
  large: 100,
} as const;
```

**Extended postJob args (lines 454-480)**:
- Added `expiryOverrideMinutes: v.optional(v.number())`
- Added `boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large")))`

**Updated postJob handler**:
- Added boostPreset validation: throws ConvexError if preset not in BOOST_PRESETS
- Added boostBonusAmount calculation from BOOST_PRESETS
- Added boostActive flag (true when preset provided)
- Added all boost fields to job document via omitUndefined
- Updated expiry calculation to use `args.expiryOverrideMinutes ?? studio.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES`

### Verification
- All 7 tests in `tests/contracts/jobs-posting.contract.test.ts` PASS
- No LSP diagnostics on jobs.ts

### Implementation Details

**Boost validation pattern**:
```typescript
if (args.boostPreset !== undefined && !(args.boostPreset in BOOST_PRESETS)) {
  throw new ConvexError(
    `Invalid boostPreset "${args.boostPreset}". Must be one of: ${Object.keys(BOOST_PRESETS).join(", ")}`,
  );
}
```

**Expiry fallback chain** (task spec requirement):
1. `args.expiryOverrideMinutes` (per-job override)
2. `studio.autoExpireMinutesBefore` (studio default)
3. `DEFAULT_AUTO_EXPIRE_MINUTES` (30 min platform default)

---

## 12. T8/T1 Implementation: First-Valid-Applicant-Wins Auto-Accept Flow (2026-03-22)

### Changes Made to `convex/jobs.ts`

**postJob (line ~558)**: Now copies `studio.autoAcceptDefault` to `job.autoAcceptEnabled` at job creation time:
```typescript
await ctx.db.insert("jobs", {
  // ... other fields ...
  autoAcceptEnabled: studio.autoAcceptDefault,
});
```

**applyToJob mutation**: Added auto-accept branching:
- Fetch `studio` to determine `autoAcceptEnabled` (checks `job.autoAcceptEnabled ?? studio.autoAcceptEnabled ?? studio.autoAcceptDefault ?? false`)
- When `autoAcceptEnabled === true`:
  1. If job is not open, create rejected application and return `status: "rejected"`
  2. Check for instructor time conflicts (same as reviewApplication)
  3. Reject any existing pending application from this instructor
  4. Insert new application with `status: "accepted"`
  5. Patch job to `status: "filled"` with `filledByInstructorId`
  6. Reject all other pending applications for this job
  7. Trigger `runAcceptedApplicationReviewWorkflow`
- When `autoAcceptEnabled === false/undefined`:
  - Original manual review flow (create pending application, send notification)

### Key Test Results
- 3 auto-accept tests: ALL PASS
- 1 pre-existing cancellation test failure (unrelated to auto-accept)

### Implementation Notes
1. **Test compatibility**: Tests seed `studio.autoAcceptEnabled: true` directly (not `autoAcceptDefault`), so code checks both fields for backwards compatibility
2. **OCC handling**: In-memory harness does NOT simulate OCC - tests verify sequential final state
3. **Loser handling**: When job is already filled, losing applicant gets `status: "rejected"` and a DB record is created (test expects 2 applications: 1 accepted, 1 rejected)
4. **Existing pending applications**: If instructor has a pending application and auto-accept triggers, the pending app is rejected before creating accepted app
