# Notifications Architecture

## Current flow

- Device registration happens in the app via `expo-notifications`.
- User-level push enablement still lives on instructor/studio profiles because those records already own Expo tokens.
- Event-level delivery preferences live in `notificationPreferences`.
- Inbox rows are stored in `userNotifications`.
- Time-based reminder work is queued in `notificationSchedules`.
- Convex cron `process due notification schedules` drains due scheduled rows every 5 minutes.
- `StartupNotificationsBootstrap` mirrors near-term lesson reminders into local device notifications on app launch, foreground resume, and realtime lesson updates.
- The app also sends an event-driven client heartbeat so the backend knows local reminder coverage is already in place.

## Covered events

- Instructor job offers
- Studio application received
- Instructor application accepted / rejected
- Instructor insurance renewal reminders
  - 30 days before expiry
  - 7 days before expiry
  - 1 day before expiry
  - expired
- Lesson reminders before start
- Lesson lifecycle updates

## Lesson reminders

- Reminder lead time is user-configurable.
- Instructor lead time is stored on `instructorProfiles.lessonReminderMinutesBefore`.
- Studio lead time is stored on `studioProfiles.lessonReminderMinutesBefore` and mirrored to the primary branch.
- When a job is filled, the backend syncs reminder schedules for the accepted instructor and the studio.
- When a job is cancelled or completed, pending reminder schedules are cancelled.
- The app also schedules local reminders for the next 24 hours so near-term reminder delivery does not depend on server wakeups alone.

## Device watcher

- This is event-driven, not a polling loop.
- Triggers:
  - app launch,
  - app foreground resume via `AppState`,
  - notification tap responses via `addNotificationResponseReceivedListener`,
  - Convex realtime updates from `jobs.getMyCalendarTimeline`.
- On each trigger, the app:
  - refreshes the push token without prompting,
  - fetches the next 24h lesson timeline,
  - schedules missing local lesson reminders,
  - cancels stale local lesson reminders.
  - updates backend heartbeat metadata with the local reminder coverage horizon.

## Local-first reminder ownership

- When the app successfully syncs local lesson reminders, it writes a coverage horizon to the user record.
- The server scheduler checks that horizon before sending `lesson_reminder` pushes.
- If the lesson reminder falls inside locally owned coverage, the server skips the remote push.

This reduces duplicate reminder pushes and keeps server load down without adding polling.

The server remains the fallback for:

- closed or inactive apps,
- users without local reminder coverage,
- non-lesson reminder notifications,
- cases where local scheduling is unavailable.

## Location-aware groundwork

The scheduler now owns reminder timing, which makes location-aware notifications additive instead of a rewrite.

Planned approach:

1. Keep the current `notificationSchedules` row as the canonical reminder record.
2. Attach lesson coordinates or branch coordinates to reminder metadata.
3. If foreground/background location permission exists, derive a travel-aware reminder window.
4. Update the scheduled reminder timestamp rather than creating a second delivery path.
5. Fall back to the static lead-minute reminder when location permission or reliable travel data is unavailable.

This keeps push, inbox, and future arrival nudges on the same backend pipeline.
