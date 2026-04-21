# Payments Schema Migration Plan

Goal: remove the last `*V2` table names from the data model while keeping the runtime stable and provider-neutral.

Current live tables that still carry versioned names:

- `paymentOffersV2`
- `paymentOrdersV2`
- `paymentAttemptsV2`
- `providerObjectsV2`
- `connectedAccountsV2`
- `connectedAccountRequirementsV2`
- `fundSplitsV2`
- `payoutTransfersV2`
- `payoutPreferencesV2`
- `ledgerEntriesV2`
- `pricingRulesV2`

## Target Shape

Use provider-neutral names in the schema and code:

- `paymentOffers`
- `paymentOrders`
- `paymentAttempts`
- `providerObjects`
- `connectedAccounts`
- `connectedAccountRequirements`
- `fundSplits`
- `payoutTransfers`
- `payoutPreferences`
- `ledgerEntries`
- `pricingRules`

That naming should stay provider-neutral. Stripe is the first provider, not the model name.

## Migration Order

1. Freeze all new schema evolution on the current `*V2` tables.
2. Add neutral table definitions alongside the existing tables if dual-write is required.
3. Update the write path to write the neutral tables first.
4. Update the read path to read neutral tables first, then fall back to `*V2` during the transition if needed.
5. Backfill historical rows from `*V2` into the neutral tables in batches.
6. Flip all app/Convex code to the neutral table names.
7. Remove legacy `*V2` table usage from the schema after verification.

## Table Dependencies

- `paymentOrders` depends on `paymentOffers`
- `paymentAttempts` depends on `paymentOrders`
- `fundSplits` depends on `paymentOrders`, `paymentAttempts`, `connectedAccounts`
- `payoutTransfers` depends on `connectedAccounts`, `fundSplits`
- `ledgerEntries` depends on `paymentOrders`, `paymentAttempts`, `fundSplits`, `payoutTransfers`
- `connectedAccounts` is a root table, but it participates in account onboarding and webhook reconciliation

## Recommended Phasing

### Phase 1: Introduce neutral schema

Add the neutral table names to `convex/schema.ts` without removing the `*V2` tables yet.

### Phase 2: Dual-write

Write new records to both the neutral and versioned tables, or migrate one subsystem at a time if dual-writing is too risky.

### Phase 3: Backfill

Backfill in order:

1. `paymentOffers`
2. `connectedAccounts`
3. `providerObjects`
4. `connectedAccountRequirements`
5. `payoutPreferences`
6. `pricingRules`
7. `paymentOrders`
8. `paymentAttempts`
9. `fundSplits`
10. `payoutTransfers`
11. `ledgerEntries`

### Phase 4: Flip reads

Move all queries, mutations, webhooks, jobs, and UI consumers to the neutral tables.

### Phase 5: Delete old schema

Remove the `*V2` tables after:

- no source references remain
- backfill verification passes
- webhook and cron paths are fully on the neutral tables

## Notes

- Do not rename tables only in the schema without a backfill plan. That would break existing data access.
- Keep provider names in fields, not in table names.
- If a future provider rollout needs versioning, use provider fields or feature flags, not another `V3` table name.
