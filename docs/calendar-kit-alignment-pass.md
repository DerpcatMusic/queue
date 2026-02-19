# CalendarKit Alignment Pass (2026-02-19)

## Problem

The custom week/day scrubber header in `app/(tabs)/calendar.tsx` could drift from the timeline grid because it used a separate layout/gesture system from `CalendarBody`.

## Fix

1. Replaced the external scrubber strip with CalendarKit's native header pipeline:
   - `CalendarHeader` now renders directly above `CalendarBody` inside `CalendarContainer`.
   - Added `renderDayItem` for per-day customization while keeping CalendarKit's internal sizing/alignment.
2. Removed legacy rail gesture/resize code paths:
   - Removed day-rail and hour-rail gestures.
   - Removed related shared values, resize state, and manual header-width calculations.
3. Stabilized visible day behavior and day states:
   - Week mode now always uses `7` visible days.
   - Day mode uses `1` visible day.
   - Selected day is highlighted; "today" keeps a tinted indicator when not selected.
4. Hardened month rendering:
   - Strict `YYYY-MM-DD` parser for internal date-only labels.
   - Month grid always renders `6 x 7` cells for stable alignment.
5. Kept date synchronization callbacks on the calendar container:
   - `onDateChanged`
   - `onChange`

## Why this is safer

`CalendarHeader` and `CalendarBody` now use the same internal width, page offset, and column math from CalendarKit. This removes the split-brain layout source that caused header/grid mismatch.

## Validation

1. `bun run lint` passed.
2. `bun run typecheck` passed.

## Manual QA

1. Week mode: weekday labels sit exactly over event columns while swiping.
2. Day mode: single-day header and timeline remain aligned.
3. Month mode: unaffected.
4. Bottom area: no clipping under native tabs for timeline content or banners.
