# Jobs Marketplace Lifecycle Plan

## TL;DR

> **Quick Summary**: Evolve the existing Convex jobs marketplace so studios can cancel posted and filled jobs, optionally auto-accept the first valid applicant, set per-job expiry with studio-default fallback, expose clearer job-state UI, and offer simple boost presets that add fixed bonus pay.
>
> **Deliverables**:
> - Backend lifecycle and schema updates for cancellation, auto-accept, expiry, and boosting
> - Studio settings and job composer support for auto-accept, expiry override, and boost presets
> - Instructor/studio feed and job-card updates for status, expiry, and boosted pay display
> - TDD-backed contract and utility tests covering lifecycle, feed visibility, and card state formatting
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves + final verification
> **Critical Path**: T1 -> T5 -> T9 -> T12 -> FINAL

---

## Context

### Original Request
Figure out what is going on with jobs in the app and plan the crucial marketplace behavior changes: studios can cancel jobs they push, multiple instructors can apply unless studio auto-accept is enabled, expiry can be set per job, expired jobs disappear from instructor feeds but remain visible to studios, jobs cards always show the important properties including expiry and state color-coding, and a boosting system with presets can increase pay to attract instructors.

### Interview Summary
**Key Discussions**:
- Studios should be able to cancel both open jobs and filled jobs.
- Multiple pending applications remain allowed unless auto-accept is enabled.
- Auto-accept is a studio app setting, default off, and uses first valid applicant wins.
- Expiry should support per-job override with fallback to the studio default.
- Expired jobs should be hidden from instructors and retained in studio-facing history.
- Boosting v1 uses 2-3 fixed bonus presets added to base pay.
- Automated testing should follow TDD using the existing Bun contract test setup.

**Research Findings**:
- Core lifecycle lives in `convex/jobs.ts`; current states are `open`, `filled`, `cancelled`, `completed`.
- Studio expiry defaults already exist via `studioProfiles.autoExpireMinutesBefore` in `convex/schema.ts`, `convex/users.ts`, and the studio profile UI.
- Current system lacks open-job studio cancellation, auto-accept, and pay-boosting logic.
- Instructor marketplace feeds already filter to `open` jobs; studio job queries already retain historical jobs.
- Existing tests use Bun contract tests in `tests/contracts/` and utility tests in `src/lib/jobs-utils.test.ts`.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Encode additive schema migration only; avoid breaking enum changes without explicit reason fields or safe transitions.
- Treat auto-accept as a race-sensitive lifecycle path requiring deterministic winner rules and re-checks.
- Avoid time-based cached query filtering; persist expiry/cancellation metadata or schedule exact state transitions.
- Lock scope away from payout/refund redesign, broad notification overhauls, and custom boost builders.

---

## Work Objectives

### Core Objective
Ship a safer, clearer jobs marketplace flow that lets studios control job posting outcomes while preserving instructor competition, deterministic acceptance, and accurate visibility/state messaging across the app.

### Concrete Deliverables
- Add backend support for studio-cancelled open jobs, studio-cancelled filled jobs, expiry metadata, auto-accept, and boost metadata.
- Add studio settings and job-posting inputs for auto-accept default, per-job expiry override, and boost preset selection.
- Update instructor/studio queries and job-card presentation for expiry, boosted pay, and differentiated status display.
- Add contract and utility tests for all new lifecycle transitions and presentation logic.

### Definition of Done
- [ ] `bun test` passes with new lifecycle and utility coverage.
- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] Agent-executed QA proves instructor feeds hide expired jobs, studios retain expired history, auto-accept fills deterministically, and cancellation/boost flows render correctly.

### Must Have
- Studio cancellation for open and filled jobs.
- Auto-accept default-off studio setting with first-valid-applicant behavior.
- Per-job expiry override with studio-default fallback.
- Expired jobs removed from instructor marketplace feeds and preserved in studio-facing history.
- Job cards show state, expiry timing, and boosted pay/status clearly.
- Boost presets limited to fixed currency bonuses in v1.

### Must NOT Have (Guardrails)
- No payout, refund, or compensation redesign.
- No custom boost amount editor in v1.
- No instructor expired-history UX expansion beyond existing application/history surfaces.
- No reliance on `Date.now()` query filtering for expiry in cached Convex queries.
- No breaking schema migration that makes new fields required immediately.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD
- **Framework**: Bun native tests (`bun:test`)
- **If TDD**: Each backend/presentation slice starts with failing contract or utility tests, then implementation, then cleanup.

### QA Policy
Every task includes agent-executed QA scenarios with evidence under `.sisyphus/evidence/`.

- **Frontend/UI**: Playwright-driven browser validation for studio settings, job composer, and job-card states
- **Backend/API/Convex**: Bun test plus sandboxed invocation or app-driven verification of lifecycle mutations and query results
- **Library/Utilities**: Bun unit tests for status mapping, expiry display, and boost formatting

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately — tests, schema/types, state contracts):
├── Task 1: Baseline lifecycle contract tests [quick]
├── Task 2: Schema and shared type additions [quick]
├── Task 3: Settings and composer contract tests [quick]
├── Task 4: Feed/card utility test updates [quick]
└── Task 5: Notification/status semantics design pass [unspecified-high]

Wave 2 (After Wave 1 — backend lifecycle and queries):
├── Task 6: Studio settings persistence for auto-accept + expiry defaults [quick]
├── Task 7: Job posting inputs for expiry override and boost metadata [unspecified-high]
├── Task 8: Auto-accept application lifecycle [deep]
├── Task 9: Studio cancellation and expiry state transitions [deep]
└── Task 10: Query/filter updates for instructor vs studio visibility [unspecified-high]

Wave 3 (After Wave 2 — UI integration and polish):
├── Task 11: Studio settings and job composer UI [visual-engineering]
├── Task 12: Job-card and jobs-list state presentation [visual-engineering]
├── Task 13: Copy, notification wiring, and final utility alignment [writing]
└── Task 14: Regression pass for calendar/count side effects [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: T1 -> T2 -> T8 -> T9 -> T12 -> FINAL
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5

### Dependency Matrix

- **T1**: none -> T8, T9
- **T2**: none -> T6, T7, T8, T9, T10, T11, T12, T13, T14
- **T3**: none -> T6, T7, T11
- **T4**: none -> T10, T12, T13
- **T5**: none -> T9, T13, T14
- **T6**: T2, T3 -> T11
- **T7**: T2, T3 -> T8, T11, T12
- **T8**: T1, T2, T7 -> T10, T12, T14
- **T9**: T1, T2, T5 -> T10, T12, T13, T14
- **T10**: T2, T4, T8, T9 -> T12, T14
- **T11**: T2, T3, T6, T7 -> T13
- **T12**: T2, T4, T7, T8, T9, T10 -> T13, T14
- **T13**: T2, T4, T9, T11, T12 -> T14
- **T14**: T2, T5, T8, T9, T10, T12, T13 -> FINAL

### Agent Dispatch Summary

- **Wave 1**: 5 agents — T1 `quick`, T2 `quick`, T3 `quick`, T4 `quick`, T5 `unspecified-high`
- **Wave 2**: 5 agents — T6 `quick`, T7 `unspecified-high`, T8 `deep`, T9 `deep`, T10 `unspecified-high`
- **Wave 3**: 4 agents — T11 `visual-engineering`, T12 `visual-engineering`, T13 `writing`, T14 `unspecified-high`
- **FINAL**: 4 agents — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Baseline lifecycle contract tests

  **What to do**:
  - Add failing contract tests for current and target job lifecycle behavior in `tests/contracts/` covering open, filled, cancelled/expired, and completed transitions.
  - Encode concurrency expectations for auto-accept and explicit expectations for open-job and filled-job studio cancellation.

  **Must NOT do**:
  - Do not change production code in this task.
  - Do not introduce speculative product behavior beyond agreed rules.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused test additions against existing patterns.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `convex-functions`: useful later for implementation, not required for test scaffolding.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2-T5)
  - **Blocks**: T8, T9
  - **Blocked By**: None

  **References**:
  - `tests/contracts/jobs-payments.contract.test.ts` - Existing contract-test style for jobs-related state assertions.
  - `tests/in-memory-convex.ts` - In-memory Convex test harness used by current contract tests.
  - `convex/jobs.ts` - Existing lifecycle mutations that tests must pin before refactor.
  - `convex/schema.ts` - Current job and application status vocabulary.

  **Acceptance Criteria**:
  - [ ] New failing tests exist for auto-accept winner, studio open-job cancellation, studio filled-job cancellation, and expiry fallback behavior.
  - [ ] `bun test tests/contracts --filter jobs` fails for the newly added scenarios before implementation.

  **QA Scenarios**:
  ```text
  Scenario: Failing auto-accept lifecycle test exists
    Tool: Bash (bun test)
    Preconditions: New contract tests added, implementation unchanged
    Steps:
      1. Run `bun test tests/contracts --filter autoAccept`
      2. Observe at least one assertion failing on missing auto-accept behavior
      3. Save terminal output
    Expected Result: Test runner reports failing assertions tied to the new lifecycle spec
    Failure Indicators: Command passes unexpectedly or fails for unrelated syntax/setup reasons
    Evidence: .sisyphus/evidence/task-1-auto-accept-red.txt

  Scenario: Failing studio-cancel test exists
    Tool: Bash (bun test)
    Preconditions: New cancellation contract tests added, implementation unchanged
    Steps:
      1. Run `bun test tests/contracts --filter cancel`
      2. Confirm the open-job or filled-job studio cancel spec fails for missing behavior
    Expected Result: Failing assertions reference cancellation lifecycle expectations
    Evidence: .sisyphus/evidence/task-1-cancel-red.txt
  ```

  **Evidence to Capture:**
  - [ ] Terminal logs for red-phase test failures

  **Commit**: YES
  - Message: `test(jobs): add failing lifecycle coverage`
  - Files: `tests/contracts/*jobs*.test.ts`
  - Pre-commit: `bun test tests/contracts`

- [x] 2. Schema and shared type additions

  **What to do**:
  - Add additive optional fields needed for auto-accept, per-job expiry override, boost metadata, and cancellation/expiry reason semantics.
  - Update shared types/constants so backend and frontend can consume the new metadata without breaking existing records.
  - Prefer additive reason metadata (for example `closureReason`) over a breaking top-level status expansion unless implementation evidence proves a new status enum is required.

  **Must NOT do**:
  - Do not make new schema fields required on first deployment.
  - Do not introduce breaking enum changes without compatible handling for existing data.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: schema/type edits are localized and deterministic.
  - **Skills**: [`convex-schema-validator`]
    - `convex-schema-validator`: ensures additive, migration-safe field design.
  - **Skills Evaluated but Omitted**:
    - `convex-migrations`: useful if backfill is needed later, but this task should stay additive-first.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3-T5)
  - **Blocks**: T6-T14
  - **Blocked By**: None

  **References**:
  - `convex/schema.ts` - Source of truth for jobs, applications, and studio profile fields.
  - `convex/constants.ts` - Shared status vocabulary and enums.
  - `src/lib/jobs-utils.ts` - Frontend-facing job constants/types that must align with schema additions.
  - `src/components/jobs/studio/studio-jobs-list.types.ts` - UI list/card types likely impacted by new metadata.

  **Acceptance Criteria**:
  - [ ] New fields are optional and typed consistently across backend/frontend.
  - [ ] Existing records without new fields remain valid under typecheck.
  - [ ] `bun run typecheck` passes after schema/type changes.

  **QA Scenarios**:
  ```text
  Scenario: Type-safe additive schema compiles
    Tool: Bash (bun run typecheck)
    Preconditions: Schema/types updated with optional fields only
    Steps:
      1. Run `bun run typecheck`
      2. Inspect for errors in job, application, and studio profile types
    Expected Result: Typecheck passes with no schema/type regressions
    Failure Indicators: Missing property errors or incompatible status unions
    Evidence: .sisyphus/evidence/task-2-typecheck.txt

  Scenario: Legacy records remain supported
    Tool: Bash (bun test)
    Preconditions: Existing contract tests available
    Steps:
      1. Run `bun test tests/contracts`
      2. Confirm pre-existing tests still execute against records without new fields
    Expected Result: No failures caused solely by absent optional fields
    Evidence: .sisyphus/evidence/task-2-legacy-contracts.txt
  ```

  **Evidence to Capture:**
  - [ ] Typecheck output
  - [ ] Contract-test output proving legacy compatibility

  **Commit**: NO

- [x] 3. Settings and composer contract tests

  **What to do**:
  - Add failing tests for studio auto-accept default persistence, per-job expiry override fallback, and boost preset validation.
  - Cover both valid inputs and invalid values (unsupported preset, invalid expiry window, missing fallback).

  **Must NOT do**:
  - Do not implement settings or posting behavior in this task.
  - Do not broaden validation to unrelated studio profile fields.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused TDD additions around settings/posting contracts.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `convex-functions`: not necessary until implementation begins.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4, T5)
  - **Blocks**: T6, T7, T11
  - **Blocked By**: None

  **References**:
  - `convex/users.ts` - Existing studio settings validation and mutation patterns.
  - `convex/jobs.ts` - Current job-post args and scheduling logic that expiry override will extend.
  - `src/lib/jobs-utils.ts` - Existing pay preset constants to align boost validation against.
  - `tests/contracts/` - Pattern for red/green contract coverage.

  **Acceptance Criteria**:
  - [ ] Failing tests define default-off auto-accept, per-job expiry override with studio fallback, and allowed boost presets.
  - [ ] Invalid expiry values and invalid boost presets have explicit failing assertions.

  **QA Scenarios**:
  ```text
  Scenario: Red tests cover studio defaults and overrides
    Tool: Bash (bun test)
    Preconditions: New settings/posting tests added, implementation unchanged
    Steps:
      1. Run `bun test tests/contracts --filter expiry`
      2. Run `bun test tests/contracts --filter boost`
    Expected Result: Tests fail for missing override/preset behavior
    Failure Indicators: No targeted failures or failures unrelated to settings/posting contracts
    Evidence: .sisyphus/evidence/task-3-settings-red.txt

  Scenario: Invalid value test case exists
    Tool: Bash (bun test)
    Preconditions: Invalid-value cases added
    Steps:
      1. Run `bun test tests/contracts --filter invalid`
      2. Confirm failures reference bad expiry/preset inputs
    Expected Result: Red-phase output proves validation expectations are encoded
    Evidence: .sisyphus/evidence/task-3-invalid-red.txt
  ```

  **Evidence to Capture:**
  - [ ] Red-phase test output for valid and invalid cases

  **Commit**: NO

- [x] 4. Feed/card utility test updates

  **What to do**:
  - Add failing utility tests for status tone/color mapping, expiry label formatting, and boost badge/pay formatting.
  - Cover instructor-hidden expired jobs and studio-visible expired/history state helpers if utilities support those decisions.

  **Must NOT do**:
  - Do not redesign utility APIs beyond what the agreed UI needs.
  - Do not change components yet.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: isolated utility test work.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `visual-engineering`: component work comes later; this task is test-only.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T3, T5)
  - **Blocks**: T10, T12, T13
  - **Blocked By**: None

  **References**:
  - `src/lib/jobs-utils.ts` - Existing status tone and preset helpers.
  - `src/lib/jobs-utils.test.ts` - Current unit-test style and assertions.
  - `src/i18n/translations/en.ts` - Labels/status copy that utility formatting may reference.
  - `src/components/jobs/studio/studio-jobs-list.types.ts` - Card/list shape that informs utility outputs.

  **Acceptance Criteria**:
  - [ ] Failing utility tests exist for expired state formatting, boosted pay formatting, and card tone mapping.
  - [ ] Tests define explicit expected labels/tones for open, filled, cancelled, expired, and boosted combinations.

  **QA Scenarios**:
  ```text
  Scenario: Utility red tests define new card states
    Tool: Bash (bun test)
    Preconditions: New utility tests added, implementation unchanged
    Steps:
      1. Run `bun test src/lib/jobs-utils.test.ts`
      2. Check failing assertions for expired/boosted formatting expectations
    Expected Result: Red-phase failures identify missing status/boost helpers
    Failure Indicators: File passes unexpectedly or fails due to syntax errors
    Evidence: .sisyphus/evidence/task-4-utils-red.txt

  Scenario: Status tone expectations are explicit
    Tool: Bash (bun test)
    Preconditions: Tone mapping cases added
    Steps:
      1. Run `bun test src/lib/jobs-utils.test.ts --filter tone`
      2. Confirm failure output references exact expected tone values
    Expected Result: Tone-mapping requirements are captured in tests
    Evidence: .sisyphus/evidence/task-4-tone-red.txt
  ```

  **Evidence to Capture:**
  - [ ] Red-phase utility test output

  **Commit**: NO

- [x] 5. Notification and status semantics design pass

  **What to do**:
  - Decide and document how implementation will distinguish studio-cancelled, instructor-withdrawn, and expired outcomes without breaking current lifecycle assumptions.
  - Identify minimum notification/copy/status metadata changes needed so UI and history can explain why a job closed.

  **Must NOT do**:
  - Do not expand into a notification-center redesign.
  - Do not add new status values unless necessary and safely supported across queries/helpers.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: requires careful cross-cutting design across lifecycle, copy, and side effects.
  - **Skills**: [`clarify`]
    - `clarify`: helps keep closure reasons and state copy distinct and understandable.
  - **Skills Evaluated but Omitted**:
    - `writing`: copy work is secondary to the lifecycle semantics decision.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T4)
  - **Blocks**: T9, T13, T14
  - **Blocked By**: None

  **References**:
  - `convex/jobs.ts` - Existing cancellation and expiry mutations currently collapse outcomes into `cancelled`.
  - `src/i18n/translations/en.ts` - Current status/cancellation copy surface that will need alignment.
  - `src/components/calendar/calendar-controller-helpers.ts` - Lifecycle mapping that may need reason-aware handling.
  - `convex/lib/marketplace.ts` - Marketplace side-effect context that must not be destabilized.

  **Acceptance Criteria**:
  - [ ] Plan for implementation specifies closure-reason handling compatible with current status model and history requirements.
  - [ ] Required notification/copy touchpoints are enumerated before code changes begin.

  **QA Scenarios**:
  ```text
  Scenario: Closure reasons are documented before implementation
    Tool: Bash (git diff or file read summary)
    Preconditions: Design notes committed in planning/implementation artifact or task notes
    Steps:
      1. Inspect the implementation notes or comments introduced for closure semantics
      2. Verify studio-cancelled, expired, and instructor-withdrawn are separately named
    Expected Result: Implementers have an explicit closure-reason map to follow
    Failure Indicators: Semantics remain ambiguous or only one generic cancelled path is described
    Evidence: .sisyphus/evidence/task-5-closure-semantics.txt

  Scenario: Notification touchpoints are enumerated
    Tool: Bash (grep or read summary)
    Preconditions: Touchpoint list exists in implementation notes or task artifact
    Steps:
      1. Verify notification/copy surfaces are identified for studio cancel, expiry, and auto-accept outcomes
    Expected Result: Minimum required messaging surfaces are listed before implementation
    Evidence: .sisyphus/evidence/task-5-notification-map.txt
  ```

  **Evidence to Capture:**
  - [ ] Closure semantics notes
  - [ ] Notification touchpoint map

  **Commit**: NO

- [ ] 6. Studio settings persistence for auto-accept and expiry defaults

  **What to do**:
  - Implement backend settings support for studio-level auto-accept default and preserve existing expiry default behavior.
  - Green the tests from T3 for default-off auto-accept and valid studio settings updates.

  **Must NOT do**:
  - Do not add per-job UI here.
  - Do not change unrelated studio profile settings logic.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: localized Convex settings mutation work.
  - **Skills**: [`convex-functions`]
    - `convex-functions`: covers mutation validation and safe updates.
  - **Skills Evaluated but Omitted**:
    - `convex-best-practices`: broader than needed for this localized persistence change.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T7-T10)
  - **Blocks**: T11
  - **Blocked By**: T2, T3

  **References**:
  - `convex/users.ts` - Existing `updateMyStudioSettings` mutation and validation flow.
  - `convex/schema.ts` - `studioProfiles` fields and defaults.
  - `src/app/(app)/(studio-tabs)/studio/profile/index.tsx` - Current studio settings UI contract that will consume persisted values later.
  - `tests/contracts/` - Red tests from T3 that define the expected behavior.

  **Acceptance Criteria**:
  - [ ] Studio profile stores auto-accept default with off-by-default behavior.
  - [ ] Existing expiry default update flow still works and respects validation rules.
  - [ ] `bun test` passes for settings-related contract cases.

  **QA Scenarios**:
  ```text
  Scenario: Studio settings contract tests go green
    Tool: Bash (bun test)
    Preconditions: Settings mutation implemented
    Steps:
      1. Run `bun test tests/contracts --filter studioSettings`
      2. Confirm auto-accept default and expiry default tests pass
    Expected Result: Settings contract tests pass with no regressions
    Failure Indicators: Failing assertions on default-off behavior or expiry validation
    Evidence: .sisyphus/evidence/task-6-settings-green.txt

  Scenario: Invalid settings still reject
    Tool: Bash (bun test)
    Preconditions: Invalid-value tests from T3 exist
    Steps:
      1. Run `bun test tests/contracts --filter invalid`
      2. Confirm invalid auto-accept/expiry payloads are rejected as expected
    Expected Result: Negative-path tests pass and validation remains strict
    Evidence: .sisyphus/evidence/task-6-settings-invalid.txt
  ```

  **Evidence to Capture:**
  - [ ] Green settings test output

  **Commit**: NO

- [x] 7. Job posting inputs for expiry override and boost metadata

  **What to do**:
  - Extend job creation payload and persistence for per-job expiry override and selected boost preset/fixed bonus metadata.
  - Ensure fallback order is explicit: per-job override -> studio default -> platform default.
  - Keep boost preset amounts centralized in shared constants so product can tune values without changing lifecycle code.

  **Must NOT do**:
  - Do not introduce custom bonus entry.
  - Do not apply boost retroactively to already filled jobs.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: touches posting contracts, scheduler inputs, and stored pay metadata.
  - **Skills**: [`convex-functions`, `convex-schema-validator`]
    - `convex-functions`: mutation argument validation and persistence.
    - `convex-schema-validator`: safe schema usage for optional new fields.
  - **Skills Evaluated but Omitted**:
    - `convex-migrations`: additive-first fields should avoid backfill complexity in this slice.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T8-T10)
  - **Blocks**: T8, T11, T12
  - **Blocked By**: T2, T3

  **References**:
  - `convex/jobs.ts` - `postJob` args, scheduling behavior, and pay persistence.
  - `src/lib/jobs-utils.ts` - Existing pay presets that should become boost preset source material or display helpers.
  - `convex/schema.ts` - Job fields that need additive metadata.
  - `tests/contracts/` - Red tests from T3 for expiry override and preset validation.

  **Acceptance Criteria**:
  - [ ] Jobs can persist optional expiry override and boost metadata without breaking old records.
  - [ ] Posted pay reflects base pay plus fixed selected bonus metadata, with both values preserved if needed for display.
  - [ ] `bun test` passes for posting/validation cases.

  **QA Scenarios**:
  ```text
  Scenario: Posting tests validate fallback order
    Tool: Bash (bun test)
    Preconditions: Job-post mutation updated
    Steps:
      1. Run `bun test tests/contracts --filter expiry`
      2. Confirm override, studio fallback, and default fallback cases pass
    Expected Result: Posting tests prove all three fallback levels
    Failure Indicators: Missing override behavior or incorrect fallback precedence
    Evidence: .sisyphus/evidence/task-7-expiry-fallback.txt

  Scenario: Boost preset persistence works
    Tool: Bash (bun test)
    Preconditions: Boost metadata implemented
    Steps:
      1. Run `bun test tests/contracts --filter boost`
      2. Confirm valid presets pass and invalid presets reject
    Expected Result: Boost bonus metadata is stored and validated correctly
    Evidence: .sisyphus/evidence/task-7-boost-preset.txt
  ```

  **Evidence to Capture:**
  - [ ] Posting contract test output for expiry and boost

  **Commit**: NO

- [ ] 8. Auto-accept application lifecycle

  **What to do**:
  - Implement first-valid-applicant-wins flow when auto-accept is enabled, including deterministic re-checks to avoid concurrent double-accepts.
  - Preserve existing manual review flow unchanged when auto-accept is off.
  - Ensure all losing or later applications receive the correct final status and studio/instructor side effects stay consistent.

  **Must NOT do**:
  - Do not change matching/eligibility rules beyond existing validation.
  - Do not introduce best-match ranking logic.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: race-sensitive lifecycle work with multiple side effects.
  - **Skills**: [`convex-functions`, `convex-best-practices`]
    - `convex-functions`: safe mutation orchestration.
    - `convex-best-practices`: reinforces deterministic read/write patterns under Convex constraints.
  - **Skills Evaluated but Omitted**:
    - `convex-realtime`: subscriptions are not the core risk; mutation correctness is.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T7, T9, T10)
  - **Blocks**: T10, T12, T14
  - **Blocked By**: T1, T2, T7

  **References**:
  - `convex/jobs.ts` - `applyToJob` and `reviewApplication` implementation that must preserve manual flow and add deterministic auto-accept.
  - `tests/contracts/jobs-payments.contract.test.ts` - Contract style for lifecycle assertions.
  - `tests/in-memory-convex.ts` - Harness for deterministic lifecycle tests.
  - `convex/schema.ts` - Job/application status fields and new auto-accept metadata.

  **Acceptance Criteria**:
  - [ ] With auto-accept off, multiple pending applications remain possible and manual review still fills the job.
  - [ ] With auto-accept on, exactly one valid applicant fills the job and later applicants are rejected deterministically.
  - [ ] Concurrency-oriented contract tests pass for near-simultaneous applications.

  **QA Scenarios**:
  ```text
  Scenario: Auto-accept winner is deterministic
    Tool: Bash (bun test)
    Preconditions: Auto-accept lifecycle implemented and tests exist
    Steps:
      1. Run `bun test tests/contracts --filter autoAccept`
      2. Confirm exactly one application is accepted in the concurrent apply scenario
    Expected Result: Tests pass and assert a single winner with losing applications rejected
    Failure Indicators: Two accepted applications, flaky failures, or pending losers
    Evidence: .sisyphus/evidence/task-8-auto-accept-green.txt

  Scenario: Manual review path remains unchanged
    Tool: Bash (bun test)
    Preconditions: Auto-accept off tests exist
    Steps:
      1. Run `bun test tests/contracts --filter reviewApplication`
      2. Confirm multiple pending apps can still exist until studio review
    Expected Result: Existing manual review semantics still pass
    Evidence: .sisyphus/evidence/task-8-manual-review.txt
  ```

  **Evidence to Capture:**
  - [ ] Green auto-accept and manual-review contract outputs

  **Commit**: YES
  - Message: `feat(jobs): implement auto-accept lifecycle`
  - Files: `convex/jobs.ts`, `convex/schema.ts`, `tests/contracts/*`
  - Pre-commit: `bun test tests/contracts && bun run typecheck`

- [x] 9. Studio cancellation and expiry state transitions

  **What to do**:
  - Implement studio cancellation for open and filled jobs, preserving side effects like application-state updates, notification hooks, stats recomputation, and calendar sync.
  - Implement or refine persisted expiry handling so scheduled expiry produces a clear historical outcome that instructor feeds can hide and studio history can retain.
  - Align closure-reason semantics from T5 with backend state transitions.

  **Must NOT do**:
  - Do not rely on feed-time `Date.now()` filtering alone.
  - Do not break existing instructor self-cancel behavior.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: central lifecycle/state machine changes with multiple downstream effects.
  - **Skills**: [`convex-functions`, `convex-best-practices`]
    - `convex-functions`: mutation/update correctness.
    - `convex-best-practices`: helps avoid state drift and unsafe lifecycle shortcuts.
  - **Skills Evaluated but Omitted**:
    - `convex-cron-jobs`: this uses existing scheduler patterns, not a broad cron system.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6-T8, T10)
  - **Blocks**: T10, T12, T13, T14
  - **Blocked By**: T1, T2, T5

  **References**:
  - `convex/jobs.ts` - Existing `cancelMyBooking`, `cancelFilledJob`, `closeJobIfStillOpen`, and `autoExpireUnfilledJob` flows.
  - `convex/schema.ts` - Job/application state model to evolve safely.
  - `src/components/calendar/calendar-controller-helpers.ts` - Calendar lifecycle logic sensitive to status changes.
  - `tests/contracts/` - Red tests from T1 and T3 defining cancellation and expiry expectations.

  **Acceptance Criteria**:
  - [ ] Studios can cancel open jobs and filled jobs with correct resulting job/application updates.
  - [ ] Scheduled expiry transitions unfilled jobs into a distinct historical outcome the app can hide from instructors and show to studios.
  - [ ] Existing instructor self-cancel flow still passes contract coverage.

  **QA Scenarios**:
  ```text
  Scenario: Studio open and filled cancellation tests go green
    Tool: Bash (bun test)
    Preconditions: Cancellation lifecycle implemented
    Steps:
      1. Run `bun test tests/contracts --filter cancel`
      2. Confirm open-job and filled-job studio cancel cases pass
    Expected Result: Cancellation tests pass with correct application/status side effects
    Failure Indicators: Wrong application status, stale filled instructor, or missing side effects
    Evidence: .sisyphus/evidence/task-9-cancel-green.txt

  Scenario: Expiry scheduler respects non-open jobs
    Tool: Bash (bun test)
    Preconditions: Expiry lifecycle implemented
    Steps:
      1. Run `bun test tests/contracts --filter expiry`
      2. Confirm filled/cancelled jobs are not re-expired and open jobs expire correctly
    Expected Result: Expiry tests pass for both happy path and guard cases
    Evidence: .sisyphus/evidence/task-9-expiry-green.txt
  ```

  **Evidence to Capture:**
  - [ ] Green cancellation and expiry contract outputs

  **Commit**: YES
  - Message: `feat(jobs): add cancellation and expiry transitions`
  - Files: `convex/jobs.ts`, `convex/schema.ts`, `tests/contracts/*`
  - Pre-commit: `bun test tests/contracts && bun run typecheck`

- [x] 10. Query and filter updates for instructor vs studio visibility

  **What to do**:
  - Update backend queries/selectors so instructors only receive live/open opportunities while studios retain expired and cancelled history as designed.
  - Ensure counts, stats, and list payloads remain internally consistent with the new closure/expiry metadata.

  **Must NOT do**:
  - Do not expose expired jobs in the instructor marketplace feed.
  - Do not remove historical records from studio views.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: query behavior spans multiple surfaces and cached data expectations.
  - **Skills**: [`convex-functions`]
    - `convex-functions`: covers query/mutation consistency in Convex.
  - **Skills Evaluated but Omitted**:
    - `convex-realtime`: helpful later if live subscriptions break, but query logic is primary.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6-T9)
  - **Blocks**: T12, T14
  - **Blocked By**: T2, T4, T8, T9

  **References**:
  - `convex/jobs.ts` - Instructor/studio job feed queries and tab counts.
  - `src/components/jobs/studio/use-studio-feed-controller.ts` - Studio feed expectations.
  - `src/components/jobs/studio/studio-jobs-list.types.ts` - List payload shape that must stay compatible.
  - `tests/contracts/` - Feed visibility tests added earlier.

  **Acceptance Criteria**:
  - [ ] Instructor job queries exclude expired jobs while preserving active open jobs.
  - [ ] Studio job queries include expired and cancelled history with enough metadata for UI state display.
  - [ ] Count/stat queries remain correct under the new states.

  **QA Scenarios**:
  ```text
  Scenario: Instructor feed excludes expired jobs
    Tool: Bash (bun test)
    Preconditions: Query filters implemented
    Steps:
      1. Run `bun test tests/contracts --filter availableJobs`
      2. Confirm expired jobs are absent and active open jobs remain
    Expected Result: Feed tests pass for instructor visibility rules
    Failure Indicators: Expired jobs leak into instructor results or open jobs disappear incorrectly
    Evidence: .sisyphus/evidence/task-10-instructor-feed.txt

  Scenario: Studio history retains expired jobs
    Tool: Bash (bun test)
    Preconditions: Studio query logic implemented
    Steps:
      1. Run `bun test tests/contracts --filter studioJobs`
      2. Confirm expired/cancelled jobs still appear in studio history queries
    Expected Result: Studio history tests pass with historical records intact
    Evidence: .sisyphus/evidence/task-10-studio-history.txt
  ```

  **Evidence to Capture:**
  - [ ] Feed/history contract test output

  **Commit**: NO

- [ ] 11. Studio settings and job composer UI

  **What to do**:
  - Add UI controls for studio auto-accept default, per-job expiry override, and boost preset selection.
  - Preserve existing visual language and form structure while making the new controls understandable and default-safe.

  **Must NOT do**:
  - Do not redesign unrelated profile or composer sections.
  - Do not default auto-accept to on.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: form/control work with clear UX constraints.
  - **Skills**: [`clarify`, `normalize`]
    - `clarify`: keeps settings labels/explanations easy to understand.
    - `normalize`: helps match existing design-system patterns.
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: preserve existing app patterns rather than introducing a new visual language.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T12-T14)
  - **Blocks**: T13
  - **Blocked By**: T2, T3, T6, T7

  **References**:
  - `src/app/(app)/(studio-tabs)/studio/profile/index.tsx` - Existing studio settings controls and expiry UI.
  - `src/components/jobs/studio/create-job-sheet.tsx` - Primary studio job composer container to extend with expiry/boost controls.
  - `src/components/jobs/studio/create-job-sheet-sections.tsx` - Existing form sections and control patterns for job creation.
  - `src/lib/jobs-utils.ts` - Preset values and labels exposed in UI.
  - `src/i18n/translations/en.ts` - Labels/help text that need matching copy keys.

  **Acceptance Criteria**:
  - [ ] Studio profile exposes default-off auto-accept and existing expiry default cleanly.
  - [ ] Job composer exposes optional per-job expiry override and 2-3 boost presets.
  - [ ] UI reflects stored defaults and validation errors without confusing state.

  **QA Scenarios**:
  ```text
  Scenario: Studio settings UI persists auto-accept and expiry default
    Tool: Playwright
    Preconditions: App running with seeded studio account
    Steps:
      1. Open the studio profile settings screen
      2. Toggle auto-accept on, choose an expiry default, save, then refresh
      3. Assert the toggle and selected expiry value persist after reload
    Expected Result: Saved settings reload accurately and remain default-safe when off
    Failure Indicators: Toggle resets, wrong expiry value displays, or save errors appear
    Evidence: .sisyphus/evidence/task-11-studio-settings.png

  Scenario: Composer rejects invalid expiry/boost combinations gracefully
    Tool: Playwright
    Preconditions: Job composer available
    Steps:
      1. Open job composer
      2. Attempt to submit with an invalid expiry override or unsupported boost state via the UI
      3. Assert inline validation appears and submission is blocked
    Expected Result: Clear validation messaging prevents bad payload submission
    Evidence: .sisyphus/evidence/task-11-composer-validation.png
  ```

  **Evidence to Capture:**
  - [ ] Screenshots showing persisted settings and composer validation

  **Commit**: NO

- [ ] 12. Job-card and jobs-list state presentation

  **What to do**:
  - Update job cards/lists to show expiry timing, boosted pay, and color-coded state consistently across relevant studio and instructor surfaces.
  - Ensure expired, cancelled, filled, open, and boosted combinations render with clear labels and safe fallbacks.

  **Must NOT do**:
  - Do not create a broad jobs-board redesign.
  - Do not hide required pay or timing information behind new interactions.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: focused UI state rendering and hierarchy work.
  - **Skills**: [`normalize`, `clarify`]
    - `normalize`: preserve existing component patterns.
    - `clarify`: keep status and expiry messaging readable at a glance.
  - **Skills Evaluated but Omitted**:
    - `colorize`: state colors should align with existing patterns, not become more decorative.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T11, T13, T14)
  - **Blocks**: T13, T14
  - **Blocked By**: T2, T4, T7, T8, T9, T10

  **References**:
  - `src/lib/jobs-utils.ts` - Tone/label/formatting helpers to update.
  - `src/components/jobs/studio/studio-jobs-list.types.ts` - Card/list data contract.
  - `src/components/jobs/studio/studio-jobs-list.tsx` - Studio job-card/list rendering surface.
  - `src/components/jobs/instructor/instructor-open-jobs-list.tsx` - Instructor feed rendering surface that must hide expired jobs.
  - `src/i18n/translations/en.ts` - State and expiry copy keys.

  **Acceptance Criteria**:
  - [ ] Job cards show exact expiry info where relevant.
  - [ ] Boosted jobs clearly display boosted pay/bonus state.
  - [ ] Color/tone mapping correctly differentiates open, filled, cancelled, and expired outcomes.

  **QA Scenarios**:
  ```text
  Scenario: Instructor feed card shows boosted pay and live expiry
    Tool: Playwright
    Preconditions: App seeded with an open boosted job that expires soon
    Steps:
      1. Open the instructor jobs feed
      2. Locate the seeded job card
      3. Assert displayed pay includes the boost and expiry text is visible
    Expected Result: Card shows boosted pay and readable expiry timing with the correct visual tone
    Failure Indicators: Missing boost, missing expiry, or incorrect status color
    Evidence: .sisyphus/evidence/task-12-instructor-card.png

  Scenario: Studio history card distinguishes expired from cancelled
    Tool: Playwright
    Preconditions: App seeded with one expired job and one studio-cancelled job
    Steps:
      1. Open the studio jobs/history view
      2. Assert both cards are present with distinct labels/copy
      3. Verify the expired card is not shown in the instructor feed
    Expected Result: Studio sees both historical outcomes clearly differentiated; instructors do not see expired item
    Evidence: .sisyphus/evidence/task-12-studio-history.png
  ```

  **Evidence to Capture:**
  - [ ] UI screenshots for instructor and studio card states

  **Commit**: YES
  - Message: `feat(jobs): update card state and boost presentation`
  - Files: `src/components/jobs/**`, `src/lib/jobs-utils.ts`, `src/i18n/translations/en.ts`
  - Pre-commit: `bun test && bun run lint`

- [ ] 13. Copy, notification wiring, and final utility alignment

  **What to do**:
  - Add/adjust the minimum copy, translation keys, and notification payload handling needed for studio cancellation, expiry, auto-accept, and boost display.
  - Align utility helpers and any small glue code so backend reasons surface coherently in UI and messaging.

  **Must NOT do**:
  - Do not broaden into a notification architecture rewrite.
  - Do not add verbose or redundant explanatory copy.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: copy and messaging consistency are the main concern.
  - **Skills**: [`clarify`]
    - `clarify`: useful for concise, user-facing state messages.
  - **Skills Evaluated but Omitted**:
    - `polish`: helpful later, but not essential for this targeted copy alignment.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T11, T12, T14)
  - **Blocks**: T14
  - **Blocked By**: T2, T4, T9, T11, T12

  **References**:
  - `src/i18n/translations/en.ts` - Current status and notification strings.
  - `convex/jobs.ts` - Notification enqueue points and lifecycle result payloads.
  - `src/lib/jobs-utils.ts` - Display helpers consuming translation/status metadata.
  - `src/components/calendar/calendar-controller-helpers.ts` - Downstream lifecycle presentation that should stay aligned with closure naming.

  **Acceptance Criteria**:
  - [ ] Copy distinguishes studio-cancelled, expired, manual-review, and auto-accepted outcomes where surfaced.
  - [ ] Translation keys and helper usage remain internally consistent.
  - [ ] Negative-path messaging remains concise and understandable.

  **QA Scenarios**:
  ```text
  Scenario: Notification/copy surfaces align with closure reasons
    Tool: Playwright
    Preconditions: App seeded with representative job outcomes
    Steps:
      1. Trigger or inspect studio-cancelled, expired, and auto-accepted job states
      2. Assert the visible copy differs appropriately across these states
    Expected Result: Users see concise, distinct messaging for each lifecycle outcome
    Failure Indicators: Generic repeated cancelled copy or missing translation strings
    Evidence: .sisyphus/evidence/task-13-copy-alignment.png

  Scenario: Translation keys resolve without placeholders
    Tool: Bash (bun test or app smoke)
    Preconditions: Translation keys updated
    Steps:
      1. Run relevant unit tests or smoke checks covering translation helper usage
      2. Inspect UI or output for unresolved keys like `jobs.status.*`
    Expected Result: No raw translation keys leak into the UI
    Evidence: .sisyphus/evidence/task-13-i18n.txt
  ```

  **Evidence to Capture:**
  - [ ] Screenshot or output proving copy/translation alignment

  **Commit**: NO

- [ ] 14. Regression pass for calendar, counts, and side effects

  **What to do**:
  - Verify and fix downstream side effects impacted by the lifecycle changes: calendar sync triggers, application stats recomputation, tab counts, and any lesson lifecycle guards.
  - Close out remaining regressions from new closure reasons, expiry handling, and auto-accept flow.

  **Must NOT do**:
  - Do not add unrelated marketplace features.
  - Do not ignore flaky or nondeterministic lifecycle tests.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: integration-focused cleanup across several touchpoints.
  - **Skills**: [`convex-best-practices`]
    - `convex-best-practices`: useful for auditing side-effect safety and consistency.
  - **Skills Evaluated but Omitted**:
    - `optimize`: performance is not the primary goal of this regression wave.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T11-T13)
  - **Blocks**: FINAL
  - **Blocked By**: T2, T5, T8, T9, T10, T12, T13

  **References**:
  - `convex/jobs.ts` - Scheduler hooks, notification enqueues, stats recomputation, lesson lifecycle guards.
  - `src/components/calendar/calendar-controller-helpers.ts` - Calendar/timeline lifecycle assumptions.
  - Count/query helpers in `convex/jobs.ts` - Tab counts and badge logic affected by new states.
  - All evidence and test outputs from T8-T13 - Regression source material.

  **Acceptance Criteria**:
  - [ ] Calendar sync and lifecycle guards still behave correctly for filled, cancelled, and expired jobs.
  - [ ] Application stats and tab counts remain accurate after cancellation, expiry, and auto-accept flows.
  - [ ] Full suite passes: `bun test`, `bun run lint`, and `bun run typecheck`.

  **QA Scenarios**:
  ```text
  Scenario: Full automated suite passes after lifecycle changes
    Tool: Bash
    Preconditions: All implementation tasks complete
    Steps:
      1. Run `bun test`
      2. Run `bun run lint`
      3. Run `bun run typecheck`
    Expected Result: All three commands pass with no regressions
    Failure Indicators: Any command fails or reveals stale side-effect assumptions
    Evidence: .sisyphus/evidence/task-14-full-suite.txt

  Scenario: Counts and history remain consistent in the app
    Tool: Playwright
    Preconditions: Seeded studio and instructor data with open, filled, cancelled, and expired jobs
    Steps:
      1. Open instructor jobs feed and note visible count/state
      2. Open studio jobs/history view and note counts/history entries
      3. Cancel or auto-accept a target job, then refresh both views
      4. Assert counts and history update consistently without leaking expired jobs to instructors
    Expected Result: Studio sees complete history and correct counts; instructor sees only live opportunities
    Evidence: .sisyphus/evidence/task-14-counts-history.png
  ```

  **Evidence to Capture:**
  - [ ] Full-suite output
  - [ ] UI evidence for count/history consistency

  **Commit**: YES
  - Message: `chore(jobs): finalize lifecycle regressions`
  - Files: affected lifecycle/query/UI files only
  - Pre-commit: `bun test && bun run lint && bun run typecheck`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit okay before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify every Must Have and Must NOT Have against implementation, evidence files, and resulting behavior.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run lint`, `bun run typecheck`, and `bun test`; inspect changed files for unsafe shortcuts, dead code, and generic AI slop.
  Output: `Lint [PASS/FAIL] | Typecheck [PASS/FAIL] | Tests [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Execute all task QA scenarios end-to-end, including auto-accept race simulation, expiry visibility, cancellation outcomes, and boost presentation. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare the actual diff against task scope and guardrails; flag unplanned changes, missing implementation, or overreach.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `test(jobs): add failing lifecycle coverage` — contract and utility tests only; pre-commit `bun test`
- **2**: `feat(jobs): add schema and lifecycle metadata` — schema/types/settings fields; pre-commit `bun run typecheck`
- **3**: `feat(jobs): implement auto-accept and cancellation flows` — backend lifecycle and query logic; pre-commit `bun test && bun run typecheck`
- **4**: `feat(jobs): update studio job controls and cards` — settings/composer/card UI; pre-commit `bun test && bun run lint`
- **5**: `chore(jobs): align copy notifications and regressions` — copy, notifications, side-effect cleanup; pre-commit `bun test && bun run lint && bun run typecheck`

## Success Criteria

### Verification Commands
```bash
bun test
bun run lint
bun run typecheck
```

### Final Checklist
- [ ] All Must Have items are present
- [ ] All Must NOT Have items remain absent
- [ ] Auto-accept accepts exactly one valid applicant
- [ ] Expired jobs are hidden from instructor feeds and retained in studio history
- [ ] Studio cancellation works for open and filled jobs
- [ ] Boost presets add fixed bonuses and display clearly on job cards
