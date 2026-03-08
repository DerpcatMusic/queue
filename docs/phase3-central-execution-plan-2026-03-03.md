# Phase 3 Central Execution Plan (2026-03-03)

## Objective

Harden runtime reliability and security by implementing:

1. Webhook abuse controls (invalid-signature flood protection).
2. Webhook payload minimization + cleanup hooks.
3. Workflow boundary extraction for job application review side effects.

## Workstreams

### WS-1 Webhook security and retention

- Scope:
  - `convex/webhooks.ts`
  - `convex/payments.ts`
  - `convex/didit.ts`
  - `convex/schema.ts`
  - `convex/webhookSecurity.ts` (new)
- Deliverables:
  - Provider/fingerprint based invalid-signature throttling via Convex state.
  - Sanitized payload persistence (minimal canonical fields).
  - Internal cleanup mutation for aged webhook artifacts.

### WS-2 Workflow boundary extraction (jobs)

- Scope:
  - `convex/jobs.ts`
- Deliverables:
  - Extract post-review side-effects (notifications + scheduler calls) behind explicit internal workflow mutation(s).
  - Keep behavior and API unchanged.

### WS-3 Contracts and guards

- Scope:
  - `tests/contracts/**`
- Deliverables:
  - Contract tests for webhook security state machine and payload sanitization boundaries.
  - Contract tests for job review workflow extraction parity.

## Shared constraints

1. Preserve API contracts and user-facing behavior.
2. Keep each worker inside owned paths.
3. Avoid broad schema churn; only add what is needed.
4. Full suite must pass (`test`, `typecheck`, `lint`).

