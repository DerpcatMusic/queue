# Convex Hardening Checklist (Marketplace)

## What was improved now
- No custom `any` / `v.any()` in Convex app code.
- Strict validators + runtime numeric guards for job creation paths.
- `zoneId` for a job is derived from studio profile (not client-provided per job).
- `createEmergencyJob` defaults lesson start to now + 30 minutes.
- First-claim-wins remains atomic in a mutation transaction.
- Caller identity now comes from `ctx.auth.getUserIdentity()` via shared auth helpers.
- Public marketplace functions no longer trust client-supplied `userId`.

## High-priority missing items (before production)
1. Row-level authorization
- Add owner checks for studio-only/instructor-only functions and admin-only operations.

2. Pagination over `collect()`
- Replace broad `collect()` patterns in feeds/queues with bounded pagination or cursor approach.

3. Idempotency for external integrations
- Push/payment/KYC webhooks should be idempotent by external event id to avoid double-processing.

4. Currency precision
- Consider storing money in agorot (integer) to avoid floating-point edge cases at scale.

## Common Convex mistakes to avoid
- Exposing sensitive logic via public mutations instead of internal functions.
- Doing network side effects in mutations (should be actions).
- Missing indexes for growing query patterns.
- Allowing unbounded fan-out writes without caps/queueing.
- Relying on client validation without server invariants.

## Immediate next hardening tasks
1. Introduce `requireAuth()` helper and remove raw `userId` ownership trust.
2. Convert push sender to action + idempotent mutation for status updates.
3. Add paginated APIs for instructor jobs and notification queue processing.
4. Add metrics/logging fields for claim latency and notification delivery outcomes.
