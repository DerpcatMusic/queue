# Calendar Integration Audit (2026-03-03)

## Current Status

### Already in place
- Calendar tab UI and timeline data query:
  - `src/components/calendar/calendar-tab-screen.tsx`
  - `convex/jobs.ts#getMyCalendarTimeline`
- Instructor calendar preferences persisted in Convex:
  - `convex/schema.ts` (`instructorProfiles.calendarProvider`, `calendarSyncEnabled`, `calendarConnectedAt`)
  - `convex/users.ts` (`getMyInstructorSettings`, `updateMyInstructorSettings`)
- Expo config and dependency are present:
  - `package.json` has `expo-calendar`
  - `app.json` includes `expo-calendar` plugin + permissions text

### Gaps found (before this pass)
- No runtime usage of `expo-calendar` in app code.
- No Google Calendar OAuth/token flow for calendar sync.
- No provider event mapping table for idempotent cloud sync.
- Existing docs referenced `src/lib/device-calendar-sync.ts`, but file was missing.

## File Edits Completed In This Pass

1. Added native device calendar integration module:
   - `src/lib/device-calendar-sync.ts`
   - Includes:
     - permission check/request
     - dedicated calendar creation (`Queue Sessions`)
     - idempotent upsert/delete sync by `externalId`

2. Wired instructor calendar tab to sync accepted timeline events when Apple sync is enabled:
   - `src/components/calendar/calendar-tab-screen.tsx`
   - Behavior:
     - for instructor role + `calendarProvider=apple` + `calendarSyncEnabled=true`
     - sync non-cancelled events from timeline into device calendar

3. Hardened calendar settings UX to avoid false-positive Google sync state:
   - `src/app/(app)/(instructor-tabs)/instructor/profile/calendar-settings.tsx`
   - Changes:
     - prepares Apple permission/calendar before saving enabled sync
     - disables auto-sync toggle when provider is Google (until OAuth backend exists)
     - adds provider-specific guidance rows

4. Added i18n copy for new provider notes:
   - `src/i18n/translations/en.ts`
   - `src/i18n/translations/he.ts`

5. Added Google Calendar OAuth env placeholders:
   - `.env.example`

## Practical Expo-Managed Plan (Next)

### Phase A: Complete Google Calendar (Convex action + AuthSession)
- Add Google OAuth connect flow in app (AuthSession PKCE) and exchange code in Convex action.
- Persist encrypted refresh token server-side only.
- Add calendar sync action to upsert Google events with retry/idempotency.

Suggested file edits:
- New:
  - `convex/calendar.ts` (actions/mutations for connect, disconnect, sync, refresh)
  - `convex/lib/googleCalendar.ts` (token refresh + Google API calls)
- Existing:
  - `convex/schema.ts` (add `calendarIntegrations`, `calendarEventMap` tables)
  - `src/app/(app)/(instructor-tabs)/instructor/profile/calendar-settings.tsx` (Connect/Disconnect Google buttons)
  - `src/app/(auth)/sign-in-screen.tsx` pattern can be reused for AuthSession browser flow

### Phase B: Improve Apple Native Sync Robustness
- Add job lifecycle trigger sync:
  - on accept, cancel, reschedule, complete
- Expand event details (location, notes, deep link).
- Add explicit “Resync now” and “Disconnect + remove Queue events” controls.

Suggested file edits:
- Existing:
  - `src/lib/device-calendar-sync.ts` (add explicit remove-all + force-resync helpers)
  - `src/app/(app)/(instructor-tabs)/instructor/profile/calendar-settings.tsx` (resync/disconnect actions)
  - `convex/jobs.ts` (optional mutation hooks to enqueue sync intent if moving to server-driven queue)

### Phase C: Shared Reliability/Data Model
- Add mapping tables for both providers and reconciliation jobs.
- Add telemetry for sync errors and retry counts.

Suggested file edits:
- Existing:
  - `convex/schema.ts`
- New:
  - `convex/calendarMigrations.ts` (backfills/reconciliation jobs)

