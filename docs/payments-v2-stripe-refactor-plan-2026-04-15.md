# Payments V2 Stripe Refactor Plan

## Purpose

Reduce backend complexity, improve read performance, and make the payments backend modular by treating Stripe V2 as the only supported payments system.

This is not a "cleanup pass". The current codebase still carries both:

- legacy Rapyd-era schema and read models
- Stripe V2 schema and orchestration

That overlap is now one of the highest-complexity areas in the backend.

## Current State

### What is good

- Stripe V2 has a coherent core schema in [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:1233).
- Public and internal Convex functions are already separated in [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:1) and [convex/payments/actions.ts](/home/derpcat/projects/queue/convex/payments/actions.ts:1).
- Webhook entrypoints are centralized in [convex/http.ts](/home/derpcat/projects/queue/convex/http.ts:1).

### What is wrong

- Legacy payment tables still exist in schema:
  - `payments`, `paymentEvents`, `invoices`, `payouts`, `payoutEvents`
  - `payoutDestinations`, `payoutDestinationOnboarding`, `payoutDestinationEvents`
  - `paymentOrders`, `paymentProviderLinks`, `ledgerEntries`, `payoutReleaseRules`, `payoutSchedules`, `payoutProviderLinks`
- Legacy types still leak into new reads and UI contracts:
  - compatibility mappers in [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:222)
  - mixed payment id union in [src/components/payments/payment-activity-list.tsx](/home/derpcat/projects/queue/src/components/payments/payment-activity-list.tsx:20)
- Legacy data is still used in job helpers:
  - [convex/jobs/_helpers.ts](/home/derpcat/projects/queue/convex/jobs/_helpers.ts:201)
- Several V2 reads are N+1 heavy:
  - [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:353)
  - [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:699)
  - [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:821)
  - [convex/home/instructorStats.ts](/home/derpcat/projects/queue/convex/home/instructorStats.ts:32)
- The main payments file is too large to own both domain rules and read-model assembly:
  - [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:1)

## Refactor Goals

1. Stripe is the only live payments provider.
2. Public payment APIs return V2-native shapes, not compatibility shapes.
3. Legacy payment tables are removed from schema and call sites.
4. Payment reads avoid per-row follow-up queries.
5. Payment logic is split by bounded context, not by "core vs actions" only.
6. Frontend no longer knows about legacy payment ids or legacy status aliases.

## Target Architecture

Split the payments backend into five bounded contexts:

- `payments/orders.ts`
  - offer creation
  - order creation
  - payment detail and payment list queries
- `payments/accounts.ts`
  - connected account reads
  - connected account upserts
  - account status projection
- `payments/transfers.ts`
  - fund splits
  - payout transfers
  - payout summary reads
- `payments/webhooks.ts`
  - Stripe webhook mutation handlers only
- `payments/readModels.ts`
  - pure projection helpers for API responses

Keep provider SDK calls in Node actions only:

- `payments/stripeActions.ts`
- `integrations/stripe/connectV2.ts`

Keep schema validators in one small shared module:

- `payments/validators.ts`

## Schema End State

### Keep

- `paymentOffersV2`
- `paymentOrdersV2`
- `paymentAttemptsV2`
- `connectedAccountsV2`
- `fundSplitsV2`
- `payoutTransfersV2`

### Probably remove

- `providerObjectsV2`
- `connectedAccountRequirementsV2`
- `payoutPreferencesV2`
- `ledgerEntriesV2`
- `pricingRulesV2`

These V2 tables currently exist in schema but appear unused or effectively dormant. Do not delete them blind. First confirm no runtime writes and no pending product need.

### Remove after cutover

- `payments`
- `paymentEvents`
- `invoices`
- `payouts`
- `payoutEvents`
- `payoutDestinations`
- `payoutDestinationOnboarding`
- `payoutDestinationEvents`
- `paymentOrders`
- `paymentProviderLinks`
- `ledgerEntries`
- `payoutReleaseRules`
- `payoutSchedules`
- `payoutProviderLinks`

## Phase Plan

### Phase 0: Freeze Legacy Surface

Goal: stop further spread of legacy shapes while keeping behavior stable.

Tasks:

- Stop adding new references to legacy tables and ids.
- Mark legacy tables and helper paths as deprecated in code comments.
- Add a short `payments/README` documenting Stripe V2 as the only supported path.
- Add a repo-level rule: new UI or backend code may not depend on `payments` or `payouts`.

Acceptance:

- No new code references legacy tables.
- The intended payment source of truth is documented.

### Phase 1: Ship a V2-Native API Contract

Goal: remove compatibility mapping from public queries.

Tasks:

- Replace compatibility response assembly in [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:353) with V2-native response models.
- Remove:
  - `mapV2OrderStatusToLegacy`
  - `mapV2TransferStatusToLegacy`
  - `CompatibilityInvoiceSummary`
  - `CompatibilityReceiptSummary`
  - `mapStripeIdentitySessionStatusToLegacyIdentityStatus` if no longer required by profile shape
- Replace frontend unions like [src/components/payments/payment-activity-list.tsx](/home/derpcat/projects/queue/src/components/payments/payment-activity-list.tsx:20) with `Id<"paymentOrdersV2">`.
- Rename "payment" response fields that are really V2 orders if needed for clarity.

Acceptance:

- Public payment list and detail queries expose only V2 concepts.
- Frontend payment components compile without `Id<"payments">`.

### Phase 2: Delete Legacy Read Dependencies

Goal: stop non-payment domains from reading legacy payment tables.

Tasks:

- Rewrite [convex/jobs/_helpers.ts](/home/derpcat/projects/queue/convex/jobs/_helpers.ts:201) to use V2 order and transfer tables or remove payment decoration if it is no longer product-critical.
- Audit all `src/` payment screens and sheets for legacy assumptions:
  - payment statuses
  - payout statuses
  - receipt / invoice presence
- Remove dead compatibility terminology from UI code.

Acceptance:

- No cross-domain reads against `payments`, `payouts`, or `invoices`.
- Job helper payment snapshots come from V2 only.

### Phase 3: Performance Pass on V2 Reads

Goal: remove avoidable N+1 queries and large fan-out reads.

Tasks:

- Refactor `listMyPaymentsV2` in [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:353).
  - Current pattern loads orders, then collects attempts and splits per order, then queries transfers per split.
  - Replace with batched projection strategy:
    - load limited orders first
    - load attempts for those order ids in one paginated helper or precomputed summary table
    - load latest split/transfer summaries without per-row follow-up queries
- Refactor `getMyPayoutSummaryV2` in [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:821).
  - Current logic queries split and transfer inside a loop over all orders.
  - Replace with payment payout summary rows or aggregated counters.
- Refactor [convex/home/instructorStats.ts](/home/derpcat/projects/queue/convex/home/instructorStats.ts:32).
  - Current payout snapshot is also N+1 over orders.
  - Reuse a shared payment summary read model instead of recomputing.

Preferred end state:

- add a small denormalized summary table such as `paymentOrderSummariesV2`
- one row per order
- includes latest attempt status, latest split status, latest transfer status, receipt url, and user-facing amounts

Why:

- Convex is strongest when queries can answer directly from indexed documents.
- Rebuilding multi-table status state inside every read is expensive and hard to maintain.

Acceptance:

- Payment list queries do not issue follow-up queries per result row.
- Instructor payout summary does not scan all orders with nested queries.

### Phase 4: Split the Payments Module

Goal: make ownership and change scope smaller.

Tasks:

- Break [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:1) into:
  - `orders.ts`
  - `accounts.ts`
  - `transfers.ts`
  - `readModels.ts`
  - `validators.ts`
  - `webhooks.ts`
- Keep files under roughly 200-500 lines where possible.
- Move projection helpers out of mutation files.
- Keep Node-only SDK orchestration in actions, not mixed with Convex data code.

Acceptance:

- No single payments file remains a system sink.
- Each file owns one bounded context.

### Phase 5: Remove Dead Schema and Migrations

Goal: physically delete the legacy payment model.

Tasks:

- Remove legacy payment tables from [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts:805).
- Delete dead legacy-specific migration code from [convex/migrations/index.ts](/home/derpcat/projects/queue/convex/migrations/index.ts:237).
- Remove legacy references from [convex/lib/authDedupe.ts](/home/derpcat/projects/queue/convex/lib/authDedupe.ts:405) and related repair logic.
- Remove old invoicing and payout destination flows if the product is now Stripe-only.

Acceptance:

- Schema no longer contains Rapyd-era payment tables.
- Migrations no longer encode legacy payment reconstruction logic.

### Phase 6: Harden and Verify

Goal: make the smaller module safe to evolve.

Tasks:

- Add focused tests for:
  - order lifecycle
  - webhook idempotency
  - connected account sync
  - payout state transitions
  - summary projection correctness
- Add a short architecture doc showing write path vs read path.
- Add runtime metrics or debug logging around webhook processing latency and duplicate suppression.

Acceptance:

- Payments has meaningful test coverage.
- Query performance and failure points are observable.

## Recommended Implementation Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6

Do not start with file splitting. Start with contract cleanup and read-path cleanup. Otherwise you just spread the mess across more files.

## High-Risk Areas

- [convex/jobs/_helpers.ts](/home/derpcat/projects/queue/convex/jobs/_helpers.ts:201)
  - cross-domain legacy read dependency
- [convex/home/instructorStats.ts](/home/derpcat/projects/queue/convex/home/instructorStats.ts:32)
  - nested payout queries in a user-facing home query
- [convex/payments/core.ts](/home/derpcat/projects/queue/convex/payments/core.ts:353)
  - compatibility read model and N+1 query pattern
- [src/components/payments/payment-activity-list.tsx](/home/derpcat/projects/queue/src/components/payments/payment-activity-list.tsx:20)
  - legacy id union leaking into UI API
- [convex/migrations/index.ts](/home/derpcat/projects/queue/convex/migrations/index.ts:237)
  - large legacy payment migration surface that will resist cleanup

## Concrete First Slice

If this work starts now, the best first slice is:

1. Convert payment list and payment detail queries to V2-native response shapes.
2. Update payment UI components to use `Id<"paymentOrdersV2">` only.
3. Replace `jobs/_helpers` legacy payment decoration with V2 decoration or remove it.
4. Introduce one payment summary read model for list and payout screens.

That slice gives the biggest complexity drop without touching live Stripe write paths first.
