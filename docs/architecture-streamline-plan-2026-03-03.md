# Architecture Streamline Plan (2026-03-03)

## Goal

Make the app more predictable, native-feeling, and cheaper to evolve by:

1. Reducing routing/session duplication and brittle string-based navigation.
2. Splitting monolithic UI/backend modules into clear boundaries.
3. Hardening backend invariants and security posture.
4. Turning quality/performance docs into enforced delivery gates.

## Current State (Synthesis)

### Strengths

1. Clear role-based app structure (`instructor` / `studio`) and native tab shell.
2. Convex domain coverage is broad (jobs, payments, payouts, onboarding, webhooks, calendar).
3. Strong local quality baseline (`lint`, `typecheck`, `test`, `test:coverage`) with passing suite.
4. Existing operations/performance docs and migration playbooks are already present.

### Key Structural Problems

1. Session and redirect logic is duplicated across `src/app/index.tsx`, `src/app/(app)/_layout.tsx`, and multiple screens.
2. Hardcoded route strings and pathname checks create fragile authorization and refactor risk.
3. UI layer mixes kit primitives, legacy themed primitives, and `className` styling patterns.
4. Several large feature files mix queries/mutations/side-effects/rendering in one component.
5. Backend invariants are not fully centralized (client and server business rules can drift).
6. Query shapes and workflow side effects are coupled in large Convex modules.
7. Sensitive webhook/provider payload handling is broad and retention controls are weak.
8. No CI-enforced release gates despite strong local tooling.

## Target Architecture

## 1) App Shell + Routing

### Target shape

1. `src/app/_layout.tsx`: providers + stack registration only.
2. Single protected gate layout owns session state routing.
3. Shared role tab shell component (parameterized by role + badge query).
4. Central typed route constants/builders; no ad hoc string hrefs.

### Concrete modules

1. `src/modules/session/`
   - `resolve-session-state.ts`
   - `use-session.ts`
   - `route-guards.ts`
2. `src/modules/navigation/`
   - `route-constants.ts`
   - `tab-config.ts`
   - `role-tabs-layout.tsx`

## 2) UI/Frontend

### Target shape

1. `kit` = domain-agnostic UI primitives only.
2. Feature modules own composition:
   - `containers` (queries/mutations/navigation wiring)
   - `presenters` (pure UI)
   - `adapters` (format/mapping)
3. Side effects moved out of presentational components into dedicated hooks.
4. One primary styling path for native-critical screens.

### Concrete feature boundaries

1. `src/features/jobs/*`
2. `src/features/calendar/*`
3. `src/features/map/*`
4. `src/features/profile/*`
5. `src/features/home/*`

## 3) Backend/Convex

### Target shape

1. Domain boundaries:
   - `identity`
   - `profile`
   - `marketplace`
   - `finance` (`payments`, `payouts`, `invoicing`)
   - `integrations` (`rapyd`, `didit`, `calendar`, `notifications`)
2. Read/write separation:
   - command mutations are minimal/deterministic
   - heavy joins move to dedicated read modules
3. Workflow/event boundary:
   - emit internal domain events
   - notifications/invoicing/payout reactions handled by processors, not inline mutation side effects
4. Security/data minimization:
   - canonicalized webhook storage
   - retention/redaction policy for raw payloads
   - explicit abuse controls on webhook edges

## 4) Delivery/Quality

### Target shape

1. CI gates on every PR:
   - install
   - codegen
   - lint
   - typecheck
   - unit+contract tests
2. Staged release gate:
   - integration suite
   - perf smoke budgets
   - build artifact checks
3. Test pyramid:
   - 65% unit
   - 25% integration
   - 10% mobile E2E smoke

## Phased Execution

## Phase 0 (1-2 days, no-regret)

1. Centralize route constants and typed builders.
2. Extract shared `RoleTabsLayout` used by studio/instructor tab layouts.
3. Remove easy hardcoded UI strings and complete missing i18n keys.
4. Add/keep route/session contract tests.
5. Add CI workflow for `lint`, `typecheck`, `test`.

Success criteria:

1. No raw role route string literals outside navigation module.
2. Tab layout duplication removed.
3. CI required checks enabled for main branch.

## Phase 1 (3-7 days, moderate risk)

1. Consolidate gating into one protected layout policy.
2. Extract startup side effects from root `_layout` into app-shell modules.
3. Refactor biggest screens into container/presenter split (start with `studio-feed`, `calendar-tab-screen`).
4. Remove backend `any` API casts in calendar path with typed wrappers.
5. Enforce key server-side invariants now only implied in UI (lead-time rules, profile uniqueness guard path).

Success criteria:

1. Redirect logic exists in one policy layer.
2. Two largest feature files reduced in responsibility (data vs rendering split).
3. Invariant tests fail when client/server rule drift occurs.

## Phase 2 (2-4 weeks, higher impact)

1. Introduce dedicated read modules for heavy aggregations (`home`, `payments`, `jobs` reads).
2. Move cross-domain side effects to event/workflow processors.
3. Add webhook abuse controls + payload retention/redaction jobs.
4. Add integration suites for jobs/payments/webhooks/calendar contracts.
5. Add nightly mobile E2E smoke + perf budget checks.

Success criteria:

1. p95 query latencies improve on heavy screens.
2. Webhook invalid-signature volume is observable and rate-limited.
3. Release confidence improves with automated integration/perf gates.

## Top Immediate Work Items

1. `src/modules/navigation/route-constants.ts` + replace route string literals.
2. Shared role tabs layout component consumed by:
   - `src/app/(app)/(instructor-tabs)/instructor/_layout.tsx`
   - `src/app/(app)/(studio-tabs)/studio/_layout.tsx`
3. Move session usage behind `useSession` and remove duplicate guard branches.
4. Refactor `src/components/jobs/studio-feed.tsx` into controller hook + presenter blocks.
5. Refactor `src/components/calendar/calendar-tab-screen.tsx` to isolate side effects.
6. Add server-side guard for application deadline/lead constraints in `convex/jobs.ts`.
7. Replace email linking `filter` path with indexed lookup in `convex/auth.ts`.
8. Add CI workflow and required-check policy docs.

## KPIs

### 30 days

1. 100% PRs gated by CI checks.
2. Median CI runtime under 10 minutes.
3. No new hardcoded route literals outside navigation module.

### 60 days

1. +15 critical-path integration tests (jobs/payments/webhooks/calendar).
2. Zero Sev1 regressions in covered flows reaching main.
3. Reduced duplicate screen logic in profile/jobs/calendar by at least 30%.

### 90 days

1. Nightly E2E smoke and perf budget gate active.
2. p95 SLO compliance >= 95% over rolling 14 days.
3. Measurable reduction in bug reopens tied to routing/state drift.

## PR Governance (Lightweight)

1. Scope declared and mapped to one phase item.
2. Tests included for behavior changes (or explicit exception).
3. No inline route literals in feature code.
4. User-visible text goes through i18n keys.
5. Side effects isolated in dedicated hooks/processors.
6. Perf note required for map/jobs/query-path changes.
7. Migrations/backfills must be idempotent with rollback notes.

