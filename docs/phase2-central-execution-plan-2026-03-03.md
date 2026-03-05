# Phase 2 Central Execution Plan (2026-03-03)

## Objective

Execute the next architecture step with parallel agents while preserving behavior:

1. Split `calendar-tab-screen` into controller/effects + render shell.
2. Extract heavy backend reads into dedicated read-model modules.
3. Expand backend integration-style contracts for identity/onboarding invariants.

## Shared rules for all agents

1. Keep behavior unchanged unless bug fix is explicitly in scope.
2. Keep ownership boundaries strict; do not edit outside assigned files.
3. Prefer additive refactors over broad rewrites.
4. Every changed path must pass lint/typecheck/tests at least in targeted scope.
5. If a skill applies, load and follow it before editing.

## Workstreams

### WS-A Calendar split

- Scope:
  - `src/components/calendar/calendar-tab-screen.tsx`
  - `src/components/calendar/use-calendar-tab-controller.ts` (new)
  - optional tiny helper modules under `src/components/calendar/`
- Deliverable:
  - `calendar-tab-screen` becomes mostly presentational shell.
  - Data/mutations/effects/perf wiring moved to controller hook.

### WS-B Convex read-model extraction

- Scope:
  - `convex/home.ts`
  - `convex/payments.ts`
  - `convex/homeRead.ts` (new)
  - `convex/paymentsRead.ts` (new)
- Deliverable:
  - Heavy read logic extracted to dedicated read modules.
  - Existing query API contracts preserved.

### WS-C Backend integration contracts

- Scope:
  - `tests/contracts/**`
  - optional test-only helpers under `tests/`
- Deliverable:
  - Integration-style contracts for:
    - duplicate-email resolution behavior
    - onboarding/profile uniqueness guard behavior
    - lead-time invariant behavior
  - Contracts should protect against regression in runtime policy.

## Exit criteria

1. `npm run -s test` passes.
2. `npm run -s typecheck` passes.
3. `npm run -s lint` passes.
4. No generated junk files or unrelated churn introduced.

