# Exact Optional Property Types Migration Plan

## Goal
Enable stricter TypeScript semantics (`exactOptionalPropertyTypes`) safely, then use that signal to uncover deeper correctness/performance issues across Expo 54 + Convex.

## Why This Matters
With `exactOptionalPropertyTypes: true`, `foo?: T` means:
- property is either **absent** or a `T`
- `undefined` is **not** silently assignable unless explicitly part of `T`

This prevents subtle bugs where we accidentally write `undefined` into patch payloads, API args, UI state objects, or derived data.

---

## Scope
- In scope:
  - `app/`, `components/`, `lib/`, `hooks/`, `constants/`, `i18n/`
  - `convex/` function args/returns/payload construction
  - shared validators and utility helpers
- Out of scope (for this pass):
  - product behavior changes
  - major UX redesigns
  - schema redesign

---

## Baseline (Before Any New Changes)
1. Ensure clean baseline checks:
   - `bun run typecheck`
   - `bun run lint`
   - `bunx convex codegen`
   - `npx expo-doctor`
2. Snapshot current error count:
   - `bunx tsc --noEmit --pretty false > /tmp/ts-baseline.txt`
3. Record key metrics:
   - Type errors: `wc -l /tmp/ts-baseline.txt`
  - Build/runtime smoke status (web + android)

Why: prevent “moving target” debugging and guarantee we can attribute regressions.

---

## Execution Plan (Exact Steps)

### Phase 1: Enable Flag and Collect Failures
1. In `tsconfig.json`, add:
   - `"exactOptionalPropertyTypes": true`
2. Run:
   - `bun run typecheck`
3. Categorize errors into buckets:
   - A) API payload construction (`patch/insert/mutation args`)
   - B) UI props/state object assembly
   - C) Utility return types and helper signatures
   - D) Third-party typings friction

Why: grouped fixes are faster and less error-prone than file-by-file random edits.

---

### Phase 2: Backend-First Fixes (Convex Safety)
1. Fix optional payload creation patterns:
   - Replace `{ key: maybeUndefined }` with conditional object spreads.
   - Example pattern:
     - `...(value !== undefined ? { key: value } : {})`
   - Convex exception: for `ctx.db.patch`, keep explicit `undefined` only when the intent is to unset/remove an existing field.
2. Ensure helper functions encode intent explicitly:
   - if `undefined` is valid value -> include in union type
   - if “missing key” is intended -> return/construct object without key
3. Re-check all mutation/query arg validators vs TS types for alignment.
4. Re-run:
   - `bunx convex codegen`
   - `bun run typecheck`

Why: backend correctness has highest blast radius (data writes + API contracts).

---

### Phase 3: Frontend Fixes (Expo/UI Contracts)
1. Update component props and local state models:
   - distinguish between “unset” and “intentionally blank”
2. Normalize data mapping at boundaries:
   - server -> UI DTO mappers should omit keys when absent
3. Remove remaining unsafe casts introduced to bypass optional mismatches.
4. Re-run:
   - `bun run typecheck`
   - `bun run lint`

Why: most optional-property drift appears in view-model composition.

---

### Phase 4: Hardening and Regression Validation
1. Run full verification:
   - `bun run typecheck`
   - `bun run lint`
   - `bunx convex codegen`
   - `npx expo-doctor`
2. Run smoke flows:
   - auth sign-in/sign-up
   - onboarding (studio/instructor)
   - profile save flows
   - jobs post/apply/review
3. Validate no schema/data contract regressions in Convex logs.

Why: strict typing changes are safe only after runtime flow checks.

---

## Possible Outcomes

### Outcome A: Low-friction migration (best case)
- Errors are mostly payload-shape cleanup.
- Time: short.
- Action: keep flag enabled and proceed to deeper audits immediately.

### Outcome B: Medium-friction migration (expected)
- Mix of payload and helper signature mismatches.
- Time: medium.
- Action: finish by domain (Convex -> jobs -> profile -> onboarding).

### Outcome C: High-friction migration (worst case)
- Wide ripple from historical loose optional typing.
- Time: longer.
- Action: split into staged PRs by module with temporary compatibility wrappers.

---

## Advantages
- Stronger contract fidelity between TS types and runtime behavior.
- Fewer accidental `undefined` writes in Convex patch/insert payloads.
- Better refactor safety and lower regression risk over time.
- Cleaner DTO boundaries between backend and UI.

## Disadvantages
- Initial migration cost (many small edits).
- Some code becomes more explicit/verbose (conditional spreads).
- Third-party typings may need narrow wrappers.

---

## Decision Logic
- If Outcome A/B: enable `exactOptionalPropertyTypes` permanently now.
- If Outcome C: keep it enabled on CI branch, merge in slices by domain.

Recommended path for this repo: **Outcome B strategy** (domain-by-domain migration, backend-first).

---

## Dig Deeper After Migration (Next Layer)

### 1) Type Safety Deepening
1. Enforce boundary DTO mappers for all Convex query results used by UI.
2. Remove all residual type assertions not proven by runtime checks.
3. Add compile-only strict checks in CI:
   - `tsc --noEmit`
   - `tsc --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes`

### 2) Data Correctness Deepening (Convex)
1. Review all mutation idempotency under retries/OCC.
2. Verify indexed query paths for hot views (`jobs`, `applications`, `notifications`).
3. Audit patch/insert writes to ensure absent vs undefined semantics are intentional.

### 3) Performance Deepening
1. Identify N+1 query patterns in jobs/profile screens.
2. Reduce repeated transforms in render paths (`useMemo` boundary normalization).
3. Keep batch writes for delete/insert sets where atomic semantics allow.

### 4) Reliability Deepening
1. Add focused runtime assertions for critical data assumptions.
2. Add smoke scripts/checklists for onboarding/profile/jobs flows.
3. Monitor Convex error rates after deployment window.

---

## Acceptance Criteria
- `exactOptionalPropertyTypes` enabled in `tsconfig.json`.
- Full checks pass:
  - `bun run typecheck`
  - `bun run lint`
  - `bunx convex codegen`
  - `npx expo-doctor`
- No unsafe casts added to bypass optional typing.
- No behavior regressions in onboarding/profile/jobs smoke flows.

---

## Rollback Plan
If unexpected runtime regressions appear:
1. Revert only migration commits affecting payload assembly.
2. Keep helper improvements that are behavior-preserving.
3. Re-run baseline checks and restore previous stable state.

This keeps risk localized while retaining useful cleanup work.
