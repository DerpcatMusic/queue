# Backend Ideal Architecture (2026-03-06)

## Goal

Move the backend from a working Convex app with several provider-coupled flows into a system that is:
- deterministic under retries and out-of-order events,
- safe for money movement and identity state,
- observable in production,
- cheap to evolve without reopening core invariants.

This is grounded in the current codebase, not a clean-room rewrite.

## What To Keep

1. Convex as the transactional core.
- Queries, mutations, actions, and scheduler are the right primitives for this product.
- The current split between provider actions and DB mutations is directionally correct.

2. Current domains as product boundaries.
- `jobs`
- `payments` / `payouts` / `invoicing`
- `didit`
- `notifications`
- `calendar`

3. Existing ledger tables as transitional read/write state.
- `payments`
- `paymentEvents`
- `payouts`
- `payoutEvents`
- `payoutDestinations`
- `payoutDestinationOnboarding`
- `invoices`

## What Must Change

The current backend still mixes three concerns inside the same modules:
1. provider payload parsing,
2. business state transitions,
3. side-effect orchestration.

That is the main reason the system is brittle.

## Target Domain Layout

### 1. `identity`
Responsibility:
- auth user lifecycle
- normalized identity linking
- role assignment
- operator/admin authorization

Modules:
- `convex/identity/auth.ts`
- `convex/identity/users.ts`
- `convex/identity/operators.ts`

### 2. `marketplace`
Responsibility:
- jobs
- applications
- assignment
- lesson completion lifecycle

Modules:
- `convex/marketplace/jobs.ts`
- `convex/marketplace/applications.ts`
- `convex/marketplace/read/jobsRead.ts`

### 3. `finance`
Responsibility:
- payment ledger
- payout ledger
- invoice ledger
- reconciliation invariants

Modules:
- `convex/finance/payments.ts`
- `convex/finance/payouts.ts`
- `convex/finance/invoices.ts`
- `convex/finance/read/paymentsRead.ts`
- `convex/finance/reconciliation.ts`

### 4. `integrations`
Responsibility:
- Rapyd adapter
- Didit adapter
- webhook ingestion
- outbound provider requests

Modules:
- `convex/integrations/rapyd/client.ts`
- `convex/integrations/rapyd/webhooks.ts`
- `convex/integrations/didit/client.ts`
- `convex/integrations/didit/webhooks.ts`
- `convex/integrations/http.ts`

### 5. `workflows`
Responsibility:
- delayed or chained reactions
- event processing fanout
- retry scheduling

Modules:
- `convex/workflows/finance.ts`
- `convex/workflows/notifications.ts`
- `convex/workflows/identity.ts`

## Target Event Model

Introduce one canonical ingestion table for all external provider events.

### `integrationEvents`
Fields:
- `provider`: `rapyd | didit | ...`
- `kind`: `payment | payout | beneficiary | identity | unknown`
- `externalEventId`
- `signatureValid`
- `receivedAt`
- `payloadHash`
- `canonicalPayload`
- `refs`

`refs` should contain normalized internal references when present:
- `paymentId`
- `payoutId`
- `onboardingId`
- `userId`
- `jobId`
- `providerPaymentId`
- `providerPayoutId`
- `providerCheckoutId`
- `merchantReferenceId`

### Processing rule
Webhook handlers only do:
1. verify signature,
2. canonicalize payload,
3. store `integrationEvents`,
4. schedule a processor.

They do not directly mutate payment, payout, or KYC state.

### Processors
A dedicated processor consumes one event and applies deterministic transitions:
- `processRapydPaymentEvent`
- `processRapydPayoutEvent`
- `processRapydBeneficiaryEvent`
- `processDiditIdentityEvent`

This gives replayability and dead-letter handling.

## Target State Machines

### Payment
Allowed transitions:
- `created -> pending`
- `pending -> authorized | captured | failed | cancelled`
- `authorized -> captured | failed | cancelled`
- `captured -> refunded`

Rules:
- transitions are monotonic,
- provider regressions do not downgrade terminal truth,
- every provider event is recorded even if unmatched,
- capture is the only state that may trigger payout/invoice workflow.

### Payout
Allowed transitions:
- `queued -> processing`
- `processing -> pending_provider | paid | failed | cancelled | needs_attention`
- `pending_provider -> paid | failed | cancelled | needs_attention`

Rules:
- payout exists at most once per payment,
- payout is blocked if source payment is not `captured`,
- unmatched payout events are preserved in canonical event storage.

### Beneficiary onboarding
Allowed transitions:
- `pending -> completed | failed | expired`

Rules:
- signed event is not enough,
- completion requires explicit success classification,
- no payout destination is marked verified unless onboarding completion is explicit.

## Security Model

### Auth and operator access
- Normal product functions remain user-authenticated.
- All maintenance, migrations, and repair endpoints require operator auth.
- Operator auth should be explicit and separate from user roles.

Recommended short-term approach:
- `MIGRATIONS_ACCESS_TOKEN`

Recommended long-term approach:
- `operators` table with scoped permissions and audited invocations.

### Secret handling
Do not persist third-party refresh/access tokens as plain Convex fields.

Preferred options:
1. encrypted-at-application-layer blobs, or
2. external secret vault with opaque references in Convex.

### Webhooks
- verify before domain mutation,
- store only canonicalized payloads,
- keep raw payload retention minimal,
- isolate abuse controls at ingress,
- preserve unmatched events in ingest storage for replay.

## Read Model Strategy

Current read paths do too much ad hoc joining.

Target pattern:
- command-side tables remain normalized,
- screen-facing read models are explicit and denormalized.

Examples:
- `instructorHomeReadModel`
- `studioJobsReadModel`
- `paymentActivityReadModel`
- `payoutSummaryReadModel`

These are rebuilt by workflows or refreshed incrementally after mutations.

## Data Model Evolution Path

### Phase 1: additive only
Add:
- `integrationEvents`
- `operatorAuditLogs`
- optional encrypted token storage abstraction

Do not remove current payment tables yet.

### Phase 2: processor-backed dual write
- webhook ingress writes `integrationEvents`
- processors continue updating current `payments` / `payouts` / `invoices`
- current screens keep using current tables

### Phase 3: read-model extraction
Add read tables for heavy UI paths and switch screens over gradually.

### Phase 4: deprecate direct webhook state mutation
Once processors are stable:
- remove inline webhook-to-ledger mutations
- keep webhook handlers as ingestion only

## Migration Plan

### Stage A: Hardening
1. fix Rapyd payment correlation by merchant reference,
2. gate beneficiary completion on explicit success,
3. protect migration endpoints,
4. fix payload cleanup progression,
5. add missing contract coverage.

### Stage B: Event ingestion
1. add `integrationEvents`,
2. write all Rapyd and Didit webhooks there,
3. add processor scheduler,
4. add replay command for a stored event.

### Stage C: Workflow isolation
1. payout scheduling moves behind finance workflow,
2. invoice issuance moves behind finance workflow,
3. notifications move behind workflow processors,
4. mutation handlers stop calling unrelated domains directly.

### Stage D: Read models
1. replace N+1 payment reads,
2. replace home/job aggregate scans,
3. add cursor-based APIs for large history.

## Required Tests

### Contract tests
- Rapyd payment webhook correlation by:
  - provider payment id
  - provider checkout id
  - merchant reference id
- out-of-order payment events
- duplicate payout events
- beneficiary pending vs success vs failure
- migration/operator access rejection

### Integration tests
- checkout -> capture -> invoice -> payout
- refund before payout
- refund after payout queued
- Didit approval -> payout onboarding unlocked

### Replay tests
- reprocessing same `integrationEvents` row is idempotent
- dead-letter event can be replayed after code fix

## Required Operations and Observability

Metrics:
- webhook invalid-signature counts
- webhook unmatched-event counts
- payment capture latency
- payout aging buckets
- invoice issuance failure rate
- event processor lag

Dashboards:
- payments by status
- payouts by status/age
- onboarding sessions by status
- unmatched external events
- processor failures by handler

Alerts:
- captured payment without invoice after threshold
- captured payment without payout in automatic mode after threshold
- high invalid webhook volume
- high unmatched Rapyd event volume

## Perfect-System Standard For This Repo

A change is not complete unless it preserves these invariants:
1. every money-moving provider event is stored exactly once,
2. every terminal financial state is replayable from stored events,
3. no bank destination is trusted without explicit success evidence,
4. no maintenance path is public without operator authorization,
5. heavy screens read from bounded queries or explicit read models,
6. cross-domain side effects happen in processors, not inline mutations.

## Recommended Immediate Build Order

1. Hardening fixes already identified in audit.
2. Add `integrationEvents` for Rapyd first.
3. Move Rapyd payment and beneficiary handlers to processor-backed flow.
4. Extract `paymentActivityReadModel` and `instructorHomeReadModel`.
5. Apply the same ingestion/processor model to Didit.
