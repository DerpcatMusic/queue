# Queue Performance & Scale Plan

Date: 2026-02-23  
Scope: `Queue/` (Expo + Convex)  
Primary pain points: map lag, unusable zone mode, avoidable backend query churn

## Migration Note

- Canonical Expo route root is `Queue/src/app`.
- Legacy `Queue/app` references in older notes are historical and should be treated as deprecated.

## 1. Goals

- Deliver consistently smooth map UX without hacks.
- Keep backend reads/writes predictable as jobs and instructors scale.
- Preserve existing backend contracts during optimization.
- Make improvements measurable, reversible, and staged.

## 2. Non-Negotiable Constraints

- Keep authorization server-derived (`ctx.auth.getUserIdentity()` path unchanged).
- Keep lifecycle monotonic/idempotent for jobs, applications, and notifications.
- Keep Convex hot paths index-driven (`withIndex`).
- Avoid web-dashboard-style UI patterns in native map/zone experiences.

## 3. Success Metrics (SLO Targets)

- Map tab first interactive: <= 1.5s (p95 mid-tier Android).
- Map pan/zoom: >= 55 FPS (p95).
- Zone tap-to-visual feedback: <= 120ms (p95).
- Instructor feed query: <= 150ms (p95 server time).
- Background network while map/jobs tab is unfocused: near-zero steady state.

## 4. Architecture Options

### Option A: Convex-Centric + Tile-First Map (Recommended)

- Keep Convex as primary backend.
- Shift map display to PMTiles/vector-tile-first rendering.
- Keep selected/preview overlays minimal in client memory.
- Add Convex read models to remove fan-out query paths.

Pros:
- Lowest migration risk.
- Fastest delivery.
- Preserves existing contracts.

Cons:
- Requires projector/read-model discipline.
- Requires tile asset pipeline maturity.

### Option B: Hybrid Geo Service + Convex App Backend

- Keep Convex for auth/workflow/realtime.
- Move geo-heavy workloads to dedicated geo stack.

Pros:
- Highest geospatial flexibility long-term.

Cons:
- More ops complexity.
- Split data ownership and synchronization risk.

## 5. Recommendation

Implement Option A now. Reassess Option B only if SLOs are still missed after Phase 2.

Rationale:
- KISS: minimum system complexity for current needs.
- YAGNI: avoid premature service split.
- SOLID/DRY: isolate map data plane and feed projection logic by responsibility.

## 6. Workstreams

### WS1: Map Data Plane

- Replace full in-memory zone rendering with tile-first display.
- Keep interactive overlays constrained to selected/preview subsets.
- Remove eager parsing of heavy zone assets on startup routes.

Deliverables:
- Map source/layer model doc.
- Tile asset generation/versioning pipeline.
- Runtime lazy-loading boundaries.

### WS2: Map Interaction Plane

- Maintain stable map callbacks and prevent list/sheet churn from re-rendering map canvas.
- Virtualize zone list and precompute searchable city/zone indexes.
- Keep zone mode default state map-usable (sheet not over-expanded by default).

Deliverables:
- Zone list indexing strategy.
- Interaction budget tests (tap latency, drag/zoom smoothness).

### WS3: Convex Read/Write Plane

- Remove N+1 query patterns in `convex/jobs.ts` endpoints.
- Introduce read-model projection for instructor job feed (indexed by instructor + postedAt).
- Keep projection idempotent and replay-safe.

Deliverables:
- Schema additions for read model.
- Projector mutations/actions.
- Backfill job and consistency checks.

### WS4: Observability & Guardrails

- Add client performance telemetry (FPS, render stalls, interaction latency).
- Add backend query timing + payload-size monitoring.
- Add rollout toggles for staged enable/disable.

Deliverables:
- SLO dashboard.
- Alert thresholds and incident playbook.

## 7. Phased Delivery Plan

### Phase 0: Baseline & Instrumentation (1 week)

Tasks:
- Capture current p50/p95 metrics for map, zone mode, feed query times.
- Add profiling scripts/checkpoints in CI/dev workflow.

Exit criteria:
- Baseline report committed.
- Performance dashboard available.

### Phase 1: Map Rendering Hardening (2 weeks)

Tasks:
- Complete tile-first rendering path.
- Reduce full-dataset overlay usage.
- Finalize lazy loading for heavy zone data.

Exit criteria:
- Map tab first interactive <= 1.8s p95.
- Frame drops reduced by >= 50% from baseline.

### Phase 2: Zone Mode Interaction Hardening (2 weeks)

Tasks:
- Zone list virtualization + indexed search.
- Strict map/list rerender boundaries.
- Interaction stress tests on low/mid devices.

Exit criteria:
- Zone feedback <= 120ms p95.
- No major jank during search/selection flows.

### Phase 3: Convex Query/Feed Scale (2 weeks)

Tasks:
- Remove per-job fan-out where avoidable.
- Add instructor feed read model + incremental backfill.
- Validate consistency and idempotency.

Exit criteria:
- Feed query <= 150ms p95.
- Stable DB read profile under load test.

### Phase 4: Rollout, Monitoring, and Cleanup (1 week)

Tasks:
- Gradual rollout with flags.
- Compare metrics vs baseline.
- Remove dead paths and finalize docs.

Exit criteria:
- SLOs met for 7 consecutive days.
- Rollback verified.

## 8. Risks and Mitigations

- Risk: stale read models.
  - Mitigation: deterministic projector + replay/backfill tools + consistency audit jobs.

- Risk: tile source mismatch with zone IDs.
  - Mitigation: versioned mapping manifest + compatibility checks in CI.

- Risk: regression in onboarding/profile map flows.
  - Mitigation: shared map contracts + flow-level tests before rollout.

## 9. Rollback Strategy

- Keep old map data path behind a feature flag during Phases 1-2.
- Keep old feed query path behind a feature flag during Phase 3.
- On SLO breach/error spike, roll back by flag first, code rollback second.

## 10. Validation Checklist

- `bunx tsc --noEmit`
- `bun run lint`
- Map interaction smoke tests on Android and iOS dev clients
- Convex query performance checks under representative data volumes
- Regression checks for onboarding, map tab, jobs tab, profile location flows

## 11. Immediate Sprint Backlog (Start Here)

1. Build and commit baseline telemetry report.
2. Implement zone list index + virtualization. (Completed)
3. Complete tile-first map source path for zone mode. (Completed)
4. Refactor `getAvailableJobsForInstructor` to remove per-job application lookup fan-out. (Completed)
5. Draft read-model schema for instructor feed and backfill plan. (Completed)

## 12. Progress Log

- 2026-02-23: Implemented lightweight `zone-city-index.json` and decoupled map tab city grouping from heavy zone geometry imports.
- 2026-02-23: Added zone-mode list virtualization + indexed filtering in `src/app/(tabs)/map.tsx` using `BottomSheetFlatList`.
- 2026-02-23: Hardened native map interaction by keeping static city/zone sources mounted and stabilizing press/zoom callbacks with refs.
- 2026-02-23: Removed instructor feed application-status N+1 in `convex/jobs.ts` by switching to a single `jobApplications.by_instructor` read and in-memory mapping.
- 2026-02-23: Added `jobApplicationStats` read model with studio/job indexes, wired mutation-time recompute, and switched studio job feed counts to use the read model.
- 2026-02-23: Added `jobApplications.by_studio` path (via denormalized `studioId`) and rewired studio jobs-with-applications query to one indexed studio read + in-memory grouping.
- 2026-02-23: Added rollout flags for backend read-model paths (`ENABLE_JOB_APPLICATION_STATS`, `ENABLE_STUDIO_APPLICATIONS_BY_STUDIO`) with safe fallbacks.
- 2026-02-23: Added performance telemetry plumbing (`src/lib/perf-telemetry.ts`) and client flags (`src/constants/feature-flags.ts`) for map/jobs latency tracking.
- 2026-02-23: Added operations runbook (`docs/performance-operations.md`) plus migration/report scripts in `package.json`.
- 2026-02-23: Added baseline capture artifact (`docs/performance-baseline-report.md`) with reproducible measurement procedure.
- 2026-02-23: Refactored map tab zone selection architecture by extracting zone indexing/view-model logic and bottom-sheet UI into `src/components/map-tab/*`, reducing `src/app/(tabs)/map.tsx` from 994 to 486 lines and tightening rerender boundaries.
- 2026-02-23: Removed startup-critical gating in `src/app/_layout.tsx` (no blocking on font/localization readiness), deferred non-critical native setup with `InteractionManager`, and added RN startup timing telemetry.
- 2026-02-23: Reworked tab shell in `src/app/(tabs)/_layout.tsx` to avoid blocking navigation on `getCurrentUser`/sync roundtrips, added cached-role fallback for immediate tab shell rendering, and added idle-time module prewarming for heavy tabs.
- 2026-02-23: Introduced lazy route boundaries for `src/app/(tabs)/map.tsx`, `src/app/(tabs)/calendar/index.tsx`, and `src/app/(tabs)/jobs/index.tsx` to keep heavy tab modules out of cold-start path.
- 2026-02-23: Removed eager heavy zone imports from `src/app/(tabs)/profile/location.tsx`; zone label/geometry resolution now loads on demand during user actions.
- 2026-02-23: Enabled Metro `inlineRequires` in `metro.config.js` to reduce cold-start JS evaluation cost.
- 2026-02-23: Completed zone-edit sheet deep audit and optimization pass: debounced sheet search pipeline in `src/components/map-tab/zone-mode-sheet.tsx`, deferred zone-model recompute in `src/components/map-tab/map-tab-screen.tsx`, and reduced map label pressure for full-zone source in `src/components/maps/instructor-zones-map-component.native.tsx` to prevent selection-triggered map jank.
- 2026-02-23: Reworked zone overlay rendering in `src/components/maps/instructor-zones-map-component.native.tsx` from dynamic `ShapeSource` rebuilds to static-source layer filters (`filter` expressions for selected/preview IDs), reducing per-selection geometry churn and map layer reset cost.
- 2026-02-23: Split Home tab monolith into modular components (`src/components/home/home-screen.tsx`, `src/components/home/instructor-home-content.tsx`, `src/components/home/studio-home-content.tsx`, `src/components/home/home-shared.tsx`) and converted `src/app/(tabs)/index.tsx` into a lazy route wrapper to reduce cold-start parsing pressure.
- 2026-02-23: Replaced tab-shell `Promise.all` warmup burst in `src/app/(tabs)/_layout.tsx` with staged idle-time module prewarming (sequenced imports with spacing), preventing startup JS-thread saturation while preserving eventual warm cache behavior.
- 2026-02-23: Reduced map-zone edit overhead by loading `src/components/map-tab/zone-mode-sheet.tsx` on demand (lazy + suspense), changing `@gorhom/bottom-sheet` usage in `map-tab-screen` to type-only until zone mode opens, and caching query-filtered city groups in `zone-selection-model.ts` to avoid repeated full-text scans on every selection toggle.
- 2026-02-23: Removed zone-sheet city reordering by selection state in `zone-selection-model.ts` so `BottomSheetFlatList` retains stable ordering, lowering row churn and selection-time list jank.
