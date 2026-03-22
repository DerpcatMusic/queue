# Decisions

## Closure Reason Model

### Problem

The `cancelled` job status is a catch-all. The UI cannot distinguish between a studio that cancelled an open or filled job versus a job that expired automatically because no instructor accepted before the application deadline.

### Solution

Add an optional `closureReason` field to the job schema. This field is **additive metadata** that travels alongside the existing status enum without modifying it.

```typescript
type ClosureReason = "studio_cancelled" | "expired" | "filled";
```

**Semantics by reason:**

| Reason | Trigger | Applies to job status |
|--------|---------|----------------------|
| `studio_cancelled` | Studio manually cancelled an open or filled job | `cancelled` |
| `expired` | `autoExpireUnfilledJob` scheduler ran before lesson start and found the job still open | `cancelled` |
| `filled` | An instructor was accepted via `reviewApplication` | `filled` |

**Note:** `instructor_withdrawn` is an application-level event (see `withdrawApplication` mutation). It does not close a job. A withdrawn application leaves the job in `open` status so other instructors can still be accepted.

### Status Mapping (Lifecycle Assumptions Preserved)

The existing status enum is unchanged. The closureReason enriches cancelled and filled states:

| Status | ClosureReason | Full Story |
|--------|--------------|------------|
| `cancelled` | `studio_cancelled` | Studio cancelled the job |
| `cancelled` | `expired` | Job auto-expired before any instructor was confirmed |
| `filled` | `filled` | Instructor accepted, job is in progress |
| `filled` | undefined | (backwards compat: filled before this schema landed) |
| `cancelled` | undefined | (backwards compat: cancelled before this schema landed) |

**Lifecycle assumptions preserved:**
- `getMyCalendarTimeline` maps `status === "cancelled"` to `lifecycle === "cancelled"` — unchanged
- `getInstructorTabCounts` filters `status === "cancelled" || status === "completed"` for calendar badge — unchanged
- No query logic depends on closureReason; it is purely display-layer enrichment

### Display Tone Mapping

| ClosureReason | Display Tone | Rationale |
|---------------|-------------|-----------|
| `studio_cancelled` | amber | Studio acted; user-facing but not error-like |
| `expired` | gray | Passive/system event; lowest visual priority |
| `filled` | green | Success; maps to existing `filled` / `completed` tone |

Current `getJobStatusTone` behavior is unchanged for open and completed. For `cancelled` status, the UI should check `closureReason` to override the default muted tone:

```typescript
function getJobStatusToneWithReason(status: string, closureReason?: ClosureReason) {
  if (status === "open") return "primary";
  if (status === "filled" || status === "completed") return "success";
  if (status === "cancelled") {
    if (closureReason === "studio_cancelled") return "amber";
    if (closureReason === "expired") return "gray";
  }
  return "muted";
}
```

### Translation Key Strategy

Existing translation keys in `JOB_STATUS_TRANSLATION_KEYS` are unchanged. The UI appends or overrides display copy based on closureReason:

| Status | ClosureReason | Translation Key Suffix |
|--------|--------------|----------------------|
| `cancelled` | `studio_cancelled` | `jobsTab.status.job.cancelled` (existing) + context "cancelled by studio" |
| `cancelled` | `expired` | `jobsTab.status.job.expired` (new key needed) |
| `filled` | `filled` | `jobsTab.status.job.filled` (existing) |

Minimum new translation keys needed in `en.ts`:
- `jobsTab.status.job.expired` → "Expired"

### Notification Touchpoints

Each closure type requires distinct notification behavior:

| Closure Type | Recipients | Notification Purpose |
|-------------|-----------|---------------------|
| `studio_cancelled` | All applicants (pending + any already-reviewed) | "The studio cancelled this job. Your application is no longer active." |
| `expired` | All applicants who applied | "This job expired before an instructor was confirmed. Your application was not accepted." |
| `filled` | Accepted instructor | "You were accepted for this job." |
| `filled` | Rejected instructors (from `reviewApplication` workflow) | "The studio reviewed your application. Unfortunately, another instructor was selected." |

**Existing notification infrastructure already handles `filled` case** via `runAcceptedApplicationReviewWorkflow` and `runRejectedApplicationReviewWorkflow`. The new notifications needed:

1. `studio_cancelled` → add notification dispatch in the studio cancel mutation path (not yet created; this is a future mutation)
2. `expired` → `autoExpireUnfilledJob` internal mutation should enqueue notifications to all applicants

**No notification architecture redesign is required.** These are new notification events added to existing dispatch points.
