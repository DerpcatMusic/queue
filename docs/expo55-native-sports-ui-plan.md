# Expo 55 Native Sports UI Plan

Date: 2026-02-24  
Scope: `Queue/` (`src/app`, `src/components`, Convex-backed tabs)

## 1. Context and assumptions

- App direction remains two-sided marketplace (`Instructor` and `Studio`) with real-time job lifecycle.
- Existing role-gated tab shell and core flows are already in place.
- We optimize for native mobile clarity, not web dashboard mimicry.
- We preserve backend contracts and current Convex domain integrity.

## 2. Rough screenshot teardown (good and bad)

### Good signals to keep

- One-screen glanceability: each tab communicates one primary action.
- Strong scan hierarchy: hero > shortlist > CTA.
- Visible schedule relevance (calendar and time blocks are first-class).
- Role identity clarity: profile and credentials are not buried.
- Immediate action affordance (`Accept gig`) in list rows.

### Bad signals to avoid

- Over-boxing/card soup: too many framed containers reduce mobile readability.
- Weak information density discipline: decorative gradients can compete with critical status.
- Ambiguous filters and labels in jobs list (hard to parse fast).
- Repetitive visual rhythm across tabs (same card shape everywhere).
- Potentially fake/non-native controls that increase implementation cost and reduce trust.

## 3. Candidate UI architectures

### Option A: Native Command Center + Focused Lists (Recommended)

- Keep role-specific native tab shell.
- Each tab has one dominant purpose and one primary action path.
- Use list-first sections, semantic colors, and native controls.

Pros:
- KISS: simplest mental model for instructors/studios under time pressure.
- DRY: shared list/row primitives across home/jobs/calendar/profile.
- SOLID: clear screen responsibilities and fewer overloaded tabs.
- YAGNI: avoids speculative high-complexity widgets in v1.

Cons:
- Less visually flashy than a highly stylized dashboard.
- Requires discipline to prevent sections from expanding over time.

### Option B: Dense Dashboard Home + Secondary Detail Tabs

- Put most metrics/actions on home; use tabs mainly as deep-dive views.

Pros:
- Fast initial "everything in one place" feeling.

Cons:
- High cognitive load on mobile.
- Violates KISS and tends to regress into web-like card grids.
- Higher maintenance and slower iteration.

## 4. Recommended native Expo 55 building blocks

- `expo-router/unstable-native-tabs`:
  - `NativeTabs.Trigger.Badge` for urgency counts.
  - role-aware trigger sets for instructor vs studio tab shells.
- Native stack/search:
  - `headerSearchBarOptions` for searchable feeds on iOS-native patterns.
- Lists:
  - `ScrollView`/`FlatList`/`SectionList` with `contentInsetAdjustmentBehavior="automatic"`.
- Calendar/scheduling:
  - keep `@howljs/calendar-kit` for timeline depth.
  - optional quick date/time entry via `@react-native-community/datetimepicker`.
  - optional iOS-native `@expo/ui/swift-ui` `DatePicker` when feature-gated.
- Visual polish:
  - `expo-glass-effect` only for high-value overlays/chips.
  - semantic palette and `PlatformColor`-aligned token usage.
- Feedback:
  - `expo-haptics` for commit actions (`apply`, `accept`, `mark done`).
- Live glance surfaces:
  - `expo-widgets` for iOS lock-screen/home widgets and Live Activities (phase later).

## 5. Feature-to-page map (Instructor)

- `Home`:
  - Hero: greeting + role metrics.
  - "Next session" focus row (live/upcoming + countdown + quick action).
  - "Open matches near your zones" preview list (top 3).
  - Quick stats: this week sessions, pending applications, expected payout.
- `Calendar`:
  - Timeline/day-week controls.
  - Accepted sessions only.
  - Session detail panel: studio, pay, location zone, reminder toggle.
- `Jobs`:
  - Search + filters (sport, date window, zone, pay floor).
  - Open jobs list with immediate apply CTA.
  - Secondary sections: pending applications, archived outcomes.
- `Map`:
  - Zone coverage editing and map-first selection.
  - No dashboard overlays beyond one compact mode/status strip.
- `Profile`:
  - Credentials/certifications.
  - Calendar sync settings.
  - Payment setup + payout history entry.
  - Appearance/language/account controls.

## 6. Feature-to-page map (Studio)

- `Home`:
  - Hero: open jobs, pending applicants, filled today.
  - "Needs review now" shortlist (jobs with pending applicants).
  - Quick action: post emergency job.
  - Weekly spend snapshot.
- `Calendar`:
  - Posted job schedule and fill status.
  - Conflict visibility (overlapping jobs, unfilled close-to-start sessions).
- `Jobs`:
  - Primary create-job flow (step sections, native controls).
  - Active jobs with applicant queue and status transitions.
  - Archive/history with payout status.
- `Profile`:
  - Studio identity/location/contact.
  - Notification preferences.
  - Payments and settlement state.
  - Appearance/language/account controls.

## 7. Immediate implementation pass in this change

- Added native tab badges in `src/app/(tabs)/_layout.tsx`:
  - Instructor:
    - `Calendar` badge = accepted upcoming sessions.
    - `Jobs` badge = open available jobs not yet accepted.
    - `Profile` badge = unread notifications.
  - Studio:
    - `Calendar` badge = upcoming open/filled jobs.
    - `Jobs` badge = total pending applications.
    - `Profile` badge = unread notifications.

This moves the app closer to the screenshot's "always visible urgency" behavior while staying native and lightweight.

## 8. Phased rollout plan

1. Phase 1 (now): native urgency signals and page ownership clarity.
2. Phase 2: jobs search/filter UX hardening (system search + chips + better defaults).
3. Phase 3: calendar session detail sheet + reminder flow polish.
4. Phase 4: optional widgets/live activity for high-signal events.

## 9. Risks and guardrails

- Risk: badge queries add background query churn.
  - Mitigation: capped limits, role-based `skip`, minute-bucketed timing args.
- Risk: overloading home again with too many sections.
  - Mitigation: max 3 primary blocks per role home.
- Risk: visual drift from native principles.
  - Mitigation: enforce shared primitives and semantic palette usage.

## 10. Success criteria

- Users can identify the next required action within 2 seconds on each tab.
- Tab badge counts correlate with true actionable workload.
- No regression in tab-shell startup behavior or auth/role routing.
- Maintain existing lifecycle integrity for jobs/applications/payments.

## References

- Expo Router Native Tabs (SDK 55): https://docs.expo.dev/versions/v55.0.0/sdk/router-native-tabs/
- Expo Glass Effect (SDK 55): https://docs.expo.dev/versions/v55.0.0/sdk/glass-effect/
- Expo Widgets / Live Activities (SDK 55): https://docs.expo.dev/versions/v55.0.0/sdk/widgets/
