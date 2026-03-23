# Top Sheet Intrinsic Sizing Plan

## Goal

Replace hardcoded fractional collapsed heights in the global top sheet system with intrinsic,
content-driven vertical sizing.

The target behavior is:

- The visible minimum height of a top sheet is derived from the rendered content inside it.
- Sticky regions remain pinned and define the always-visible baseline.
- Expandable sheets can still grow to larger heights, but their collapsed state no longer depends
  on guessed screen fractions.
- Components inside the sheet can size themselves responsively, and the sheet reacts to that
  measured result.

This plan applies to the existing global sheet stack:

- `src/modules/navigation/role-tabs-layout.tsx`
- `src/components/layout/global-top-sheet.tsx`
- `src/components/layout/top-sheet.tsx`
- `src/components/layout/top-sheet-registry.ts`

## Current Architecture

### Host and routing

- `RoleTabsLayout` mounts one shared `GlobalTopSheet` above `NativeTabs`.
- Each tab or route contributes sheet configuration through `useGlobalTopSheet(...)`.
- `GlobalTopSheet` resolves the active tab config and renders `TopSheet`.

### Current sizing model

`TopSheet` currently treats `steps` as fractions of available screen height:

- `availableHeight = screenHeight - safeTop - bottomChromeEstimate`
- `stepHeights = steps.map(step => Math.round(step * availableHeight))`
- `sheetHeight` animates to the selected pixel height

This means the collapsed height is currently caller-defined, not content-defined.

### Existing hardcoded usage patterns

There are three main patterns in the codebase:

1. Literal collapsed fractions
   - `src/components/jobs/instructor-feed.tsx`
   - `src/components/jobs/studio-feed.tsx`
   - `src/components/profile/profile-subpage-sheet.tsx`
   - `src/app/(auth)/sign-in-screen.tsx`
   - `src/app/onboarding.tsx`

2. Derived fractions from hardcoded desired pixel heights
   - `src/components/calendar/calendar-tab/index.tsx`
   - `src/components/home/home-tab/index.tsx`

3. Derived fractions from helper functions that still encode fixed heights
   - `src/app/(app)/(instructor-tabs)/instructor/profile/index.tsx`
   - `src/app/(app)/(studio-tabs)/studio/profile/index.tsx`
   - `src/components/home/home-header-sheet.tsx`
   - `src/components/profile/profile-tab/profile-hero-utils.ts`

### Existing but unused groundwork

`src/components/layout/top-sheet-sizing.ts` already contains logic that points in the right
direction:

- `computeAvailableHeight`
- `computeIntrinsicMinHeight`
- `resolveOverflowMode`

`src/components/layout/top-sheet-sizing.test.ts` already covers those helpers.

These helpers are not currently wired into `TopSheet`.

## Constraints and Platform Notes

This feature is feasible in React Native with Expo SDK 55 and Reanimated.

The relevant platform capabilities are:

- React Native `onLayout` for measuring rendered view size after layout
- React Native layout measurement APIs for synchronous post-layout measurement in effects
- Reanimated shared values for height animation
- Reanimated layout transitions for visual smoothing of content changes

This is not blocked by Expo or React Native. The missing piece is that the sheet does not yet use
measured content to drive its own height model.

## Target Behavior

### Minimum height behavior

The collapsed height should be computed from what is actually visible in the collapsed state:

- safe top inset
- top sheet vertical padding
- sticky header height
- collapsed body height
- sticky footer height
- drag handle height when present

If the avatar or title block grows because of a different device size, font scale, or dynamic
layout, the top sheet minimum height should grow with it automatically.

### Expand behavior

For expandable sheets, the first step should be the intrinsic collapsed height.

Additional expansion steps should still be supported, but should represent larger target heights,
not the collapsed baseline.

Examples:

- Collapsed = measured intrinsic content height
- Expanded step 1 = `0.56` of available height
- Expanded step 2 = `0.94` of available height

### Sticky content behavior

`stickyHeader` should remain in the system.

It already matches the desired semantics:

- it defines always-visible top content
- it stays pinned when the sheet expands
- it contributes to minimum height

No removal is required for the first refactor. It should be upgraded so its measured height is part
of intrinsic sizing.

## Proposed API

### Preserve compatibility

Keep the existing `steps`-based fractional API working during migration.

Add a new sizing mode to `TopSheetProps` and `TopSheetTabConfig`.

### New props

Recommended additions:

```ts
type TopSheetHeightMode = "fractional" | "content-min" | "content-min-overflow";

type TopSheetStep =
  | { kind: "fraction"; value: number }
  | { kind: "content" }
  | { kind: "pixels"; value: number };
```

Option A: minimal migration path

```ts
heightMode?: TopSheetHeightMode;
steps?: readonly number[];
expandedSteps?: readonly number[];
```

Behavior:

- `fractional`: current behavior
- `content-min`: collapsed height is intrinsic; no overflow mode
- `content-min-overflow`: collapsed height is intrinsic, but content may scroll internally if the
  measured height exceeds a cap

Option B: cleaner long-term API

```ts
heightMode?: TopSheetHeightMode;
steps?: readonly TopSheetStep[];
```

Behavior:

- `{ kind: "content" }` resolves to the intrinsic measured collapsed height
- fractional and pixel steps resolve against available height

Recommendation:

- Implement Option A first to reduce churn
- Move to Option B later if the sheet system needs more expressive step control

## Internal TopSheet Refactor

## 1. Add measured layout state

Inside `TopSheet`, add measured heights for:

- sticky header wrapper
- collapsed body wrapper
- sticky footer wrapper

Suggested state:

```ts
const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
const [contentHeight, setContentHeight] = useState(0);
const [stickyFooterHeight, setStickyFooterHeight] = useState(0);
```

Each region should be wrapped in a native `View` with `onLayout`.

Important:

- use dedicated wrappers, not direct measurement of arbitrary composite components
- set `collapsable={false}` on wrappers where required to prevent optimization issues
- avoid measuring `revealOnExpand` as part of collapsed intrinsic height

## 2. Compute intrinsic collapsed height

Define:

```ts
const intrinsicCollapsedHeight =
  safeTop +
  resolvedPadding.vertical +
  stickyHeaderHeight +
  contentHeight +
  stickyFooterHeight +
  resolvedPadding.vertical +
  (draggable ? HANDLE_HEIGHT : 0);
```

This should then be clamped to the maximum allowed sheet height.

The existing helper `computeIntrinsicMinHeight` should be used for the content sum portion.

## 3. Resolve target heights from height mode

### Fractional mode

No change from current behavior.

### Content-min mode

- collapsed target height = intrinsic collapsed height
- if there are additional expansion targets, append them after the intrinsic collapsed height

Example:

```ts
heightMode: "content-min"
expandedSteps: [0.56, 0.94]
```

Resolves to:

- step 0 = intrinsic collapsed height
- step 1 = 56% of available height
- step 2 = 94% of available height

### Content-min-overflow mode

Use this for cases where collapsed content may exceed a device-dependent cap.

Behavior:

- measure intrinsic collapsed height
- clamp it to a maximum target
- if measured height exceeds max, fix the sheet height at the cap and let internal content scroll

This mode will matter for sheets with dynamic text, accessibility font scaling, or unusually tall
collapsed content.

## 4. Keep gesture behavior, but drive it from resolved step heights

The pan logic can stay mostly intact.

Only the source of `stepHeights` changes:

- in fractional mode: derived from fractions
- in intrinsic mode: first height comes from measurement, later heights come from explicit
  expansion targets

Drag snapping logic remains valid once `stepHeights` is expressed entirely in pixels.

## 5. Separate collapsed and expanded measurement concerns

`revealOnExpand` should not influence the collapsed intrinsic baseline.

It should only affect larger steps when expanded.

This means:

- collapsed measurement only includes always-visible regions
- expanded state uses explicit larger targets
- if the expanded region itself needs intrinsic behavior later, that should be a separate phase of
  work

## GlobalTopSheet Changes

`GlobalTopSheet` should remain the route-aware host.

Required changes:

- pass through `heightMode` and any new sizing props
- continue reporting `collapsedSheetHeight` to `ScrollSheetProvider`
- stop relying on `steps[0] * screenHeight + safeTop` as the conceptual fallback baseline

Recommended fallback behavior:

- if measurement is not ready, use the previous measured height if available
- otherwise use a conservative tab-specific fallback
- once measured height arrives, update `collapsedSheetHeight`

This reduces startup jumps.

## Registry Changes

Update `TopSheetTabConfig` and related override types in
`src/components/layout/top-sheet-registry.ts` to include:

- `heightMode?: TopSheetHeightMode`
- `expandedSteps?: readonly number[]` if Option A is used

Defaults:

- existing tabs without `heightMode` continue to use `fractional`

## Recommended Migration Strategy

### Phase 1: infrastructure only

Files:

- `src/components/layout/top-sheet.tsx`
- `src/components/layout/top-sheet-registry.ts`
- `src/components/layout/global-top-sheet.tsx`
- `src/components/layout/top-sheet-sizing.ts`
- `src/components/layout/top-sheet-sizing.test.ts`

Deliverables:

- intrinsic height measurement support
- new sizing props
- no caller migrations yet
- existing tabs still work unchanged

### Phase 2: migrate simple non-expandable sheets

Migrate these first:

- `src/app/(auth)/sign-in-screen.tsx`
- `src/app/onboarding.tsx`
- `src/components/jobs/instructor-feed.tsx`
- `src/components/jobs/studio-feed.tsx`
- `src/components/profile/profile-subpage-sheet.tsx`

Why first:

- they are collapsed-only
- most already use `stickyHeader`
- they benefit immediately from content-driven sizing
- they are lower risk than the map sheet

Migration pattern:

- replace `steps: [x]` with `heightMode: "content-min"`
- keep padding and colors unchanged

### Phase 3: migrate computed-fraction header sheets

Migrate:

- `src/components/home/home-tab/index.tsx`
- `src/components/calendar/calendar-tab/index.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/index.tsx`
- `src/app/(app)/(studio-tabs)/studio/profile/index.tsx`

Required cleanup:

- remove local step-fraction math
- keep responsive component internals
- let the sheet measure the rendered result

This phase should also allow removal of helper functions whose only purpose was to turn content
height guesses into screen fractions:

- `getHomeHeaderExpandedHeight`
- `getProfileHeaderExpandedHeight`

Those helpers may remain temporarily if other layout code still depends on them, but they should no
longer be required for top sheet sizing.

### Phase 4: migrate the expandable map sheet

File:

- `src/components/map-tab/map-tab/use-map-tab-controller.tsx`

Target:

```ts
heightMode: "content-min"
expandedSteps: [0.56, 0.94]
```

Behavior:

- the search/header area determines collapsed height
- the sheet expands to larger caps
- sticky header remains pinned
- `revealOnExpand` remains the expansion-only content

This is the most important validation case for the new model.

## Device-reactive sizing examples

### Avatar sized as a percentage of screen height

If a sheet header uses:

```ts
const avatarSize = screenHeight * 0.1;
```

the avatar can grow or shrink based on device height. Because the sheet now measures the rendered
header, the collapsed height updates automatically without any additional sheet math.

### Dynamic text and localization

If title, subtitle, or badges wrap differently due to language or font scale:

- the header wrapper re-measures
- intrinsic collapsed height updates
- the sheet animates to the new target height

This gives the "reactive" feel being requested, even though it is implemented through layout
measurement rather than compiler-level reactivity.

## Testing Requirements

Add or extend tests for:

- fractional mode remains unchanged
- content-min computes intrinsic collapsed height correctly
- sticky header + footer + body measurement sum is correct
- handle height is included when draggable
- measured height changes update the collapsed target
- screen rotation recomputes caps and resolved heights
- content-min-overflow correctly chooses fit vs overflow behavior
- expandable intrinsic sheets prepend intrinsic height as step 0

In addition to unit tests, manual device checks should cover:

- small iPhone / small Android
- tall Android device
- large text / accessibility font scaling
- RTL language
- route transitions between tabs with different sheet shapes

## Known Risks

### Measurement jitter

Repeated `onLayout` updates can cause visible re-snaps if state is updated for sub-pixel changes.

Mitigation:

- ignore height changes smaller than 1 px
- keep previous measured values until new measurements stabilize

### Transition wrappers affecting measurement

`GlobalTopSheet` currently wraps content with Reanimated entering/exiting transitions. Measured
height should come from stable structural wrappers inside `TopSheet`, not from transient outer
animation wrappers.

### Async data causing repeated sheet growth

If sheet content loads in stages, the top sheet may re-measure several times.

Mitigation:

- accept this for now if changes are meaningful
- consider a short stabilization delay only if real usage shows noisy behavior

### Scroll container interaction

`useTopSheetContentInsets` depends on `collapsedSheetHeight`. Any measurement bug will surface as
incorrect top padding in downstream scroll views.

This is why Phase 1 should be completed and validated before broad caller migration.

## Recommended First Implementation Slice

Implement the smallest end-to-end slice in this order:

1. Add `heightMode: "content-min"` support to `TopSheet`
2. Measure sticky header, body, and footer wrappers
3. Resolve collapsed height from measurement
4. Update `GlobalTopSheet` to pass through the new prop
5. Migrate `sign-in` to `content-min`

Why `sign-in` first:

- it is isolated
- it has a simple sticky header
- it has one collapsed state and one slightly larger variant
- it will show quickly whether intrinsic measurement is stable enough

After that, migrate `jobs` headers, then `profile subpages`, then `home/profile/calendar`, and the
map sheet last.

## Definition of Done

The refactor is complete when:

- collapsed top sheet height is no longer guessed via per-screen fractions for standard tabs
- sticky content defines the minimum visible sheet height
- responsive child sizing changes are reflected in sheet height automatically
- expandable sheets retain drag snapping behavior with intrinsic collapsed height
- downstream scroll content insets remain correct across tabs and route transitions
