# NativeWind Migration Clusters

This document defines the migration split for parallel workers.

## Cluster A: Profile Foundation

- `src/components/profile/profile-settings-sections.tsx`
- `src/components/profile/status-signal.tsx`
- `src/components/profile/sports-multi-select.tsx`
- `src/components/profile/profile-subpage-sheet.tsx`

Focus:
- Replace arithmetic spacing/radius with semantic tokens.
- Normalize shared profile cards, rows, and signal surfaces.

## Cluster B: Instructor Profile Screens

- `src/app/(app)/(instructor-tabs)/instructor/profile/location.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/sports.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/calendar-settings.tsx`

Focus:
- Align controls and cards with the new radius system.
- Normalize repeated button / section spacing patterns.

## Cluster C: Home Surfaces

- `src/components/home/home-shared.tsx`
- `src/components/home/home-agenda-widget.tsx`
- `src/components/home/home-header-sheet.tsx`
- `src/components/home/studio-home-content.tsx`
- `src/components/home/instructor-home-content.tsx`

Focus:
- Normalize dashboard card spacing and internal stacks.
- Reduce one-off chip/badge styling.

## Cluster D: Maps and Command Panels

- `src/components/maps/queue-map.web.tsx`
- `src/components/map-tab/map-tab/map-web-command-panel.tsx`
- `src/components/map-tab/map-tab/map-web-header-panels.tsx`
- `src/components/map-tab/map/map-sheet-results.tsx`

Focus:
- Replace ad-hoc rounded values with `hard` / `medium` / `soft`.
- Reduce rgba usage where palette + opacity suffices.

## Cluster E: Auth and Shell

- `src/app/(auth)/sign-in-screen.tsx`
- `src/modules/navigation/role-tabs-layout.web.tsx`
- `src/components/loading-screen.tsx`
- `src/components/ui/sheet-header-block.tsx`

Focus:
- Normalize shell-level surfaces and pills.
- Remove bracketed one-off classes where semantic tokens exist.

## Cluster F: Jobs and Lists

- `src/components/jobs/studio/studio-jobs-list-parts.tsx`
- `src/components/jobs/instructor/instructor-job-card.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/jobs/studios/[studioId].tsx`
- `src/components/payments/payment-activity-list.tsx`

Focus:
- Normalize rows, chips, badges, and card shells.
- Replace one-off chip/button radius and padding math.
