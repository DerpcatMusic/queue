# Queue Marketplace Rearchitecture Gap Analysis

This is a strategic architecture note for the current codebase, focused on the sports marketplace model:

- studios need last-minute coverage
- instructors get paid through Stripe Connect
- Convex owns the app state and business rules
- Expo Router owns the mobile experience

The goal is not to add features. The goal is to remove structural ambiguity, duplicate models, and expensive read paths so the system can scale across France, Germany, and the UK without becoming fragile.

## What We Already Have

### Convex backend

- A real domain split already exists:
  - `convex/policy/marketplace.ts`
  - `convex/policy/compliance.ts`
  - `convex/policy/billing.ts`
- The schema is already separated by concern:
  - auth
  - identity
  - marketplace
  - billing
  - notifications
  - audit
- The marketplace layer already has:
  - jobs
  - applications
  - assignments
  - check-ins
  - lesson completion
  - settlement states
  - operational blocks
- Compliance is not a stub:
  - studio publishing rules exist
  - instructor eligibility rules exist
  - insurance and identity review logic exists
- Payments are not a toy:
  - payment offers, orders, attempts, connected accounts, splits, and transfers exist
  - Stripe actions and webhook handling exist
  - mobile payment onboarding flows exist

### Mobile app

- Expo Router is in place.
- Role-based navigation exists.
- There is a real design system and a real sheet/navigation shell.
- The app already has distinct studio and instructor surfaces.
- The app already uses native capabilities where they matter:
  - Stripe native flows
  - location
  - calendar
  - notifications
  - image upload

## What Is Still Weak

### 1. Payments still carry legacy complexity

The billing layer is still split across:

- current canonical tables in `convex/schemaBillingCurrent.ts`
- migration shadow tables in `convex/schemaBillingLegacy.ts`
- neutral mirror logic in `convex/payments/neutralMirror.ts`
- compatibility status mapping in `convex/payments/statuses.ts`
- UI components that still speak in legacy status terms

That means the system is not actually “one payment model”. It is one model plus a compatibility layer plus a migration mirror.

That is the biggest structural risk in the repo.

### 2. Read paths are still status-assembly heavy

Current payment and payout screens still reconstruct state from multiple tables on demand:

- orders
- attempts
- splits
- transfers
- jobs

That works now, but it does not scale cleanly.

Convex is strongest when a query can answer from a small number of indexed documents. Rebuilding a user-facing payment timeline in every read is avoidable complexity.

### 3. The app root is too wide

The root layout is doing a lot:

- provider composition
- font loading
- splash control
- auth session transitions
- bottom sheet registration
- global sheet orchestration

That is workable, but it is too much responsibility in one file. It makes startup behavior, navigation behavior, and state transitions harder to reason about.

### 4. Payment UI still knows too much

The payment activity sheet still depends on the current legacy payment vocabulary:

- `captured`
- `authorized`
- `pending_provider`
- `queued`

That is fine during migration, but it should not be the product API surface.

### 5. The “neutral mirror” is a smell

If canonical tables are the live model, then a mirror layer from `*V2` to canonical tables is a transitional artifact, not architecture.

If the mirror layer is still active, the migration is not done.

If the mirror layer is no longer needed, it should be removed before it becomes accidental complexity.

## What We Do Not Have Yet

### Backend gaps

- A single, clearly final payments schema
- A single payments read model for list/detail/payout summary
- A denormalized summary table for payment/order state
- A clear cutover plan that removes compatibility mappings from public queries
- A hard boundary between:
  - provider SDK orchestration
  - Convex data writes
  - user-facing read models
- A “payments as product API” layer that is obviously the only one the app should consume

### Mobile gaps

- A feature-based screen architecture instead of mostly shell-based assembly
- Lazy-loaded feature boundaries for heavy payment/compliance surfaces
- Less root-level orchestration in `src/app/_layout.tsx`
- Fewer screens that derive their display from legacy payment vocabulary
- More explicit separation between:
  - domain UI
  - sheet presentation
  - data-loading controllers

## Drastic Rearchitecture

This is the architecture I would move toward.

### 1. Make Convex the only source of truth

Convex should own:

- marketplace rules
- compliance decisions
- billing readiness
- settlement transitions
- audit logs
- payment state projections

Do not keep business logic in the UI except for presentation-level derivation.

### 2. Collapse payments into a clean bounded context

Split payments into explicit modules:

- `convex/payments/orders.ts`
- `convex/payments/accounts.ts`
- `convex/payments/transfers.ts`
- `convex/payments/webhooks.ts`
- `convex/payments/readModels.ts`
- `convex/payments/validators.ts`

Keep provider SDK calls in action-only modules.
Keep all public query shapes in read-model modules.
Keep all mutation rules small and idempotent.

### 3. Remove legacy compatibility from public APIs

Public payment queries should return final shapes, not compatibility shapes.

That means:

- no public status translation from current to legacy
- no mixed ID unions in the UI
- no “captured means succeeded” mapping in presentation code
- no consumer dependency on migration-era names

If a status is user-facing, define it once and keep it stable.

### 4. Add a payment summary table

Introduce a denormalized summary table for one-row-per-order reads.

Suggested fields:

- latest order status
- latest attempt status
- latest split status
- latest transfer status
- job reference
- actor references
- currency and amounts
- receipt metadata
- settlement readiness

This will reduce repeated fan-out reads in:

- payment lists
- payment detail views
- instructor payout summaries
- dashboard widgets

### 5. Treat billing readiness as a policy output

The billing policy should be the only place that decides:

- whether a studio can post jobs
- whether billing is blocked
- whether payment methods are usable
- whether overdue behavior should suspend the studio

Everything else should consume that decision, not re-derive it.

### 6. Move mobile toward feature modules

The Expo app should be organized around feature areas, not around a large shared shell.

Recommended shape:

- `src/features/jobs/`
- `src/features/payments/`
- `src/features/compliance/`
- `src/features/onboarding/`
- `src/features/profile/`
- `src/features/navigation/`

Screens under `src/app/` should stay thin and mostly route to feature modules.

The root layout should do less:

- compose providers
- bootstrap auth
- load theme and fonts
- register truly global overlays only

Everything else should live in feature-owned trees.

### 7. Keep React Native performance discipline strict

Use the mobile stack the way Expo/RN wants it used:

- `FlashList` for longer lists
- `expo-image` for remote images
- `Pressable` instead of legacy touchables
- route files kept thin
- heavy sheets and dashboards loaded lazily
- avoid doing expensive data derivation in render paths

This repo already uses several of these patterns. The next step is enforcing them consistently.

## Suggested Target State

### Backend

1. Canonical payment schema only.
2. Provider-specific orchestration isolated to Stripe/Didit integration modules.
3. Public payment queries backed by summary tables.
4. Policy modules decide business state.
5. Legacy mirror and compatibility code removed.
6. Audit and compliance remain first-class, but separate from payment mechanics.

### Mobile

1. Route files stay minimal.
2. Feature modules own UI and controllers.
3. Root layout is simplified.
4. Payment and compliance surfaces become lazy and bounded.
5. Status labels match the final backend model, not migration vocabulary.

## Practical Cutover Order

### Phase 1: Freeze

- stop introducing new compatibility code
- stop introducing new legacy status vocabulary in UI
- stop adding new payment cross-coupling

### Phase 2: Summary tables

- add denormalized summaries for payment list/detail/payout reads
- switch screens to read summaries instead of reconstructing state

### Phase 3: Public API cleanup

- remove legacy status mapping from public queries
- update UI types to final payment identifiers and status vocabulary

### Phase 4: Module split

- split the payments backend into bounded modules
- split mobile feature logic out of route files and root shells

### Phase 5: Remove migration scaffolding

- remove mirror code
- remove compatibility projections
- remove dead shadow tables after backfill and verification

## Bottom Line

You do not need a greenfield rewrite.

You need to finish the architecture you already started:

- one authoritative backend model
- one public payment API
- one read-model strategy
- one policy layer for business rules
- one feature-based mobile app structure

Right now the repo is strong, but it still carries too much transition logic. That transition logic is the part most likely to cost you reliability, developer speed, and future compliance clarity.
