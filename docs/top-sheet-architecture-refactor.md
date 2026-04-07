# Top Sheet Architecture Refactor

## What the sheet is supposed to do

The app uses a shared top-attached sheet above tab scenes.

That sheet currently has to solve three different jobs:

1. Reserve vertical layout space for the active tab scene.
2. Render and animate the visible sheet surface.
3. Swap sheet content as tabs and nested routes change.

Those jobs are currently mixed together. That is the core design bug.

## Correct mental model

There are two different heights:

1. `layoutHeight`
   - The amount of vertical space the scene below must reserve.
   - Changes here force React layout work and scene reflow.
2. `visualHeight`
   - The amount of sheet surface that looks visible to the user.
   - This should be animated mostly with `transform` and `opacity`.

`layoutHeight` is architecture.

`visualHeight` is animation.

If those two values are treated as the same thing, the app gets:

- rerenders during drag
- scene jumpiness
- conflicting gesture and step logic
- weird snap-back behavior when the visual layer and layout layer disagree

## Correct animation model

For sheet interactions, use this rule:

- commit layout rarely
- animate visuals continuously

That means:

1. Pick the target `layoutHeight` for the settled step.
2. Reserve that space in the layout host.
3. Animate the sheet chrome/content inside that reserved box with transforms.
4. Do not drive scene layout from per-frame drag updates.

This matches Reanimated guidance to prefer non-layout properties like `transform` and `opacity` over `height`, `margin`, or `padding` animation.

## What is wrong in the current implementation

### 1. `TopSheet` mixes layout and animation concerns

`src/components/layout/top-sheet.tsx` currently owns:

- min-height measurement
- step resolution
- drag gesture
- layout height publishing
- visual drag feedback
- expanded reveal behavior

That makes it too stateful and too responsible.

### 2. `overlay` mode is internally contradictory

In overlay mode, the outer shell is fixed to the collapsed footprint, while the sheet also tries to behave like a stepped expandable surface.

That is acceptable only for a pure overlay reveal.

It is not acceptable for map-style interaction where the expanded state should remain visibly larger and feel settled.

### 3. There are two control planes

The active sheet is resolved from both:

- descriptor-owned config in `src/modules/navigation/role-tabs-layout.tsx`
- legacy registry overrides in `src/components/layout/top-sheet-registry.ts`

Then `src/components/layout/global-top-sheet.tsx` merges them at runtime.

That means ownership is ambiguous.

### 4. Root tabs are not using one model

Current rough state:

- Home: mostly descriptor-owned
- Map: descriptor-owned, but using the most demanding sheet behavior
- Jobs: still hybrid
- Calendar: hybrid
- Profile index: descriptor-owned
- Nested profile/details: legacy route override takeover

The result is that every tab is effectively driving a different layout system.

## Good parts of the current system

These ideas are worth keeping:

1. One shared sheet host above tab scenes.
2. Shared layout state in `ScrollSheetProvider`.
3. Descriptor-based tab ownership in `RoleTabsLayout`.
4. Visual continuity across tab switches via preserved shell height.

The direction is right.

The boundaries are wrong.

## The target architecture

Split the current system into four primitives.

### 1. `SheetLayoutHost`

Responsible for:

- publishing `layoutHeight`
- reserving space above the scene
- exposing `sceneViewportHeight`

Not responsible for:

- gestures
- drag feedback
- content rendering decisions

### 2. `SheetSurface`

Responsible for:

- rendering the visible chrome
- animating `translateY`, `opacity`, and reveal progress
- rendering sticky header / collapsed / expanded regions

Not responsible for:

- global route resolution
- layout reservation policy

### 3. `SheetController`

Responsible for:

- state machine only
- step indices
- drag direction
- settle decisions
- mode semantics

This should output:

- `settledStep`
- `layoutHeight`
- `visualOffset`
- `expandedProgress`

### 4. `SheetResolver`

Responsible for:

- resolving the active tab/route sheet descriptor
- deciding which descriptor owns the host

This should have one source of truth for root tabs.

## Modes that should exist

The current `resize | overlay` split is too vague.

Use explicit sheet modes instead:

1. `header`
   - single fixed height
   - no expansion
2. `stepped-resize`
   - layout height changes between steps
   - use when scene must truly move
3. `stepped-overlay`
   - layout height stays at a committed base height
   - visual layer reveals more sheet within the reserved host
4. `route-replacement`
   - nested route fully replaces parent tab sheet content

Each mode needs a strict contract.

## Root ownership rule

For root tabs:

- only descriptor-owned config is allowed

For nested-route takeovers:

- allow route replacement through a separate explicit API

Do not let the legacy registry compete with root descriptors for the same tab.

## Recommended migration

### Phase 1. Stabilize ownership

1. Keep `GlobalTopSheet`, but make root tabs descriptor-only.
2. Restrict registry usage to explicit nested route replacement.
3. Tighten types in `RoleTabsLayout` so sheet config is not `unknown`.

### Phase 2. Split layout from visuals

1. Extract a layout host that owns `layoutHeight`.
2. Extract a surface that owns animated presentation.
3. Move gesture settle logic into a controller hook or reducer.

### Phase 3. Replace the mode contract

1. Remove the ambiguous `overlay` behavior.
2. Replace it with explicit `stepped-overlay` semantics.
3. In `stepped-overlay`, keep the reserved layout stable and animate reveal inside that box.

### Phase 4. Migrate tabs

Migration order:

1. Map
2. Jobs
3. Calendar
4. Profile nested routes

Map is first because it is the clearest failure case and forces the architecture to handle real stepped interaction correctly.

## Map-specific guidance

The map sheet is trying to act like a stepped results drawer.

That means:

- the system must commit a stable layout footprint for the sheet
- the surface must visually reveal more content as the step expands
- the gesture must update visual feedback without rewriting scene layout every frame

If the outer host stays clipped to collapsed height, expansion will never feel real.

## Performance rules for this refactor

1. Use Reanimated shared values for gesture and visual progress.
2. Animate `transform` and `opacity` for drag/reveal.
3. Avoid animating layout properties every frame.
4. Keep Unistyles static and merge animated styles with array syntax on `Animated.View`.
5. Commit layout only when the sheet settles or when a route/tab identity changes.

## Non-goals

This refactor should not try to solve:

- all screen-level design inconsistencies
- all primitive migration debt
- payments IA

It should solve sheet ownership, layout semantics, and animation semantics once.

## Definition of done

The refactor is complete when:

1. Every root tab uses the same ownership model.
2. Nested routes use an explicit replacement mechanism, not hidden precedence.
3. The scene layout reacts only to committed sheet height.
4. Dragging the sheet does not relayout the scene each frame.
5. Map expansion visibly sticks and settles at the expanded step.
6. Jobs, calendar, and profile behave as predictable variants of one sheet system.
