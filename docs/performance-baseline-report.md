# Performance Baseline Report

Date: 2026-02-23  
Scope: `Queue/`  
Build: Dev client (Expo SDK 55 preview)

## 1. Environment

- Device model: `TBD`
- OS version: `TBD`
- App build id / commit: `TBD`
- Network profile: `TBD` (Wi-Fi / 4G / 5G)
- Convex deployment: `TBD`

## 2. Measurement Setup

- Client telemetry flags:
  - `EXPO_PUBLIC_ENABLE_MAP_PERF_TELEMETRY=true`
  - `EXPO_PUBLIC_ENABLE_JOBS_PERF_TELEMETRY=true`
- Backend flags:
  - `ENABLE_JOB_APPLICATION_STATS=1`
  - `ENABLE_STUDIO_APPLICATIONS_BY_STUDIO=1`
- Consistency report command:
  - `bun run perf:stats:report`

## 3. Captured Metrics

### Map

- `map.first_interactive`
  - p50: `TBD ms`
  - p95: `TBD ms`
- `map.city_toggle_latency`
  - p50: `TBD ms`
  - p95: `TBD ms`
- `map.zone_toggle_latency`
  - p50: `TBD ms`
  - p95: `TBD ms`

### Jobs

- `jobs.instructor.available_jobs_query`
  - p50: `TBD ms`
  - p95: `TBD ms`
- `jobs.instructor.my_applications_query`
  - p50: `TBD ms`
  - p95: `TBD ms`
- `jobs.studio.jobs_with_applications_query`
  - p50: `TBD ms`
  - p95: `TBD ms`
- `jobs.instructor.apply_mutation`
  - p50: `TBD ms`
  - p95: `TBD ms`
- `jobs.studio.review_application_mutation`
  - p50: `TBD ms`
  - p95: `TBD ms`

## 4. Convex Consistency

- `missingStatsCount`: `TBD`
- `mismatchedStatsCount`: `TBD`
- `studioIdMismatchCount`: `TBD`

## 5. SLO Comparison

- Map first interactive <= 1.5s (p95): `TBD`
- Map pan/zoom >= 55 FPS (p95): `TBD`
- Zone tap feedback <= 120ms (p95): `TBD`
- Instructor feed query <= 150ms (p95): `TBD`

## 6. Notes

- Add raw `[perf]` log snippets used for p50/p95 extraction.
- Record anomalies and device thermal/network conditions for reproducibility.

