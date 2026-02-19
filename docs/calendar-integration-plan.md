# Calendar Integration Plan (Instructor)

## Goal
- Let instructors auto-sync accepted sessions into calendar.
- Support Google Calendar first, then Apple Calendar.

## Why This Split
- Google requires OAuth and token lifecycle management.
- Apple calendar can be supported quickly via device calendar APIs on iOS.

## Phase 1 (Now in App)
- Persist calendar preference in Convex profile:
  - `calendarProvider`: `none | google | apple`
  - `calendarSyncEnabled`: boolean
  - `calendarConnectedAt`: number | undefined
- Expose these controls in Profile with native widgets (`Switch`, native `Pressable` chips).

## Phase 2 (Google Calendar OAuth)
1. Add OAuth flow in app using `expo-auth-session` + PKCE.
2. Perform authorization with a secure redirect URI (`makeRedirectUri`) and code exchange on backend.
3. Store encrypted Google refresh token in Convex (server-only).
4. On accepted job events, enqueue sync action to create/update Google Calendar event.
5. Add retry + conflict-safe upsert using provider event ID map.

## Phase 3 (Apple Calendar)
1. Use `expo-calendar` permissions and local calendar/event APIs on iOS.
2. Let instructor pick target calendar (or default device calendar).
3. Create/update local events for accepted sessions.
4. Keep a local provider-event mapping table in Convex for idempotent updates.

## Convex/Data Model Additions (Recommended Next)
- `calendarIntegrations` table:
  - `instructorId`, `provider`, `status`, `connectedAt`, `updatedAt`
- `calendarEventMap` table:
  - `jobId`, `instructorId`, `provider`, `providerEventId`, `lastSyncedAt`
- Internal actions:
  - `calendar.syncAcceptedSession`
  - `calendar.resyncInstructorRange`

## Security
- Never expose provider tokens to client queries.
- Keep OAuth code exchange and token refresh in Convex actions only.
- Add revoke/disconnect mutation and wipe provider tokens on disconnect.

## References
- Expo Calendar (SDK latest): https://docs.expo.dev/versions/latest/sdk/calendar/
- Expo AuthSession (SDK latest): https://docs.expo.dev/versions/latest/sdk/auth-session/
- Expo Auth guide: https://docs.expo.dev/guides/authentication/
- Google OAuth for native apps: https://developers.google.com/identity/protocols/oauth2/native-app
