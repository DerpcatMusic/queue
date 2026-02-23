# Performance Operations Runbook

Date: 2026-02-23  
Scope: `Queue/` Expo + Convex performance rollouts and audits

## 1. Rollout Flags

### Client (Expo)

- `EXPO_PUBLIC_ENABLE_MAP_PERF_TELEMETRY`
  - `true` to log map performance metrics (`map.first_interactive`, zone/city toggle latency)
  - Default: `false`
- `EXPO_PUBLIC_ENABLE_JOBS_PERF_TELEMETRY`
  - `true` to log jobs query/mutation performance metrics
  - Default: `false`

### Backend (Convex)

- `ENABLE_JOB_APPLICATION_STATS`
  - `1` (default behavior): use `jobApplicationStats` read model
  - `0`: fallback to direct `jobApplications` scans for studio counts
- `ENABLE_STUDIO_APPLICATIONS_BY_STUDIO`
  - `1` (default behavior): use `jobApplications.by_studio`
  - `0`: fallback to per-job `by_job` reads for studio applications

## 2. Migration & Repair Commands

Run from `Queue/`.

### Backfill `jobApplications.studioId`

1. `bun run perf:studio-ids:backfill`
2. Copy returned `continueCursor`.
3. Repeat:
   - `bunx convex run migrations:backfillJobApplicationStudioIds '{"batchSize":200,"cursor":"<continueCursor>"}'`
4. Stop when `hasMore` is `false`.

### Backfill `jobApplicationStats`

1. `bun run perf:stats:backfill`
2. Copy returned `continueCursor`.
3. Repeat:
   - `bunx convex run migrations:backfillJobApplicationStats '{"batchSize":200,"cursor":"<continueCursor>"}'`
4. Stop when `hasMore` is `false`.

### Consistency Report

- `bun run perf:stats:report`

Expected steady state:
- `missingStatsCount = 0`
- `mismatchedStatsCount = 0`
- `studioIdMismatchCount = 0`

### Targeted Repair

- `bunx convex run migrations:repairJobApplicationStatsForJobs '{"jobIds":["<jobId1>","<jobId2>"]}'`

## 3. Telemetry Baseline Procedure

1. Enable client telemetry flags in `.env.local`:
   - `EXPO_PUBLIC_ENABLE_MAP_PERF_TELEMETRY=true`
   - `EXPO_PUBLIC_ENABLE_JOBS_PERF_TELEMETRY=true`
2. Start app:
   - `bun run start` (or `bun run android`)
3. Run baseline flows:
   - Map tab cold open
   - Enter zone mode, search, toggle city, toggle zone
   - Jobs tab open for instructor and studio roles
   - Apply to job and review application
4. Capture logs containing `[perf]`.
5. Store p50/p95 values in `docs/performance-scale-plan.md` under SLO tracking.

## 4. Safety & Rollback

- If regressions appear in studio job feeds:
  - Set `ENABLE_JOB_APPLICATION_STATS=0`
  - Set `ENABLE_STUDIO_APPLICATIONS_BY_STUDIO=0`
  - Redeploy Convex functions
- Keep migrations idempotent; rerunning backfills is safe.

