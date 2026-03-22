# Top Sheet — Design Decisions

Documents the rationale behind the non-obvious constants, contracts, and architectural choices in the top-sheet system after tasks 0.1 through 7.1.

---

## Map Step Fractions: `[0.24, 0.56, 0.94]`

**Authoritative source: `use-map-tab-controller.tsx` line 396, not the registry.**

The map tab constructs its own full config object and passes it via `useGlobalTopSheet("map", mapSheetConfig)`. This overwrites any registry default before the sheet renders. The registry entry for map (`steps: [0.18, 0.52]`) is dead code.

The three steps and their meanings:

| Step index | Fraction | Meaning |
|---|---|---|
| 0 | `0.24` | Collapsed — map fully visible with sheet at bottom; camera receives `collapsedSheetHeight + 24` as top padding |
| 1 | `0.56` | Mid-expand — search results visible below the header; same camera padding (derived from step-0 height) |
| 2 | `0.94` | Fully expanded — sheet nearly fills the screen |

Camera padding does not vary by step. It is a single static value derived from the step-0 (collapsed) height, propagated via the settled-only `onLayout` chain. The padding does not update during live drag.

**Why these fractions and not others?** They were chosen to position the sheet at ergonomically useful heights on typical phone screens: step 0 leaves most of the map visible, step 1 brings search controls into thumb reach, step 2 shows the full results list. The exact values predate this refactor and were preserved to avoid changing map UX.

---

## Intrinsic `maxHeight`: `availableHeight * 0.9`

**Default cap formula (top-sheet.tsx line 179):**

```typescript
const intrinsicMaxHeight = maxHeight ?? Math.round(availableHeight * 0.9);
```

`availableHeight` is computed as `screenHeight - safeTop - Math.max(MIN_BOTTOM_CHROME_ESTIMATE, safeBottom + TAB_BAR_ESTIMATE)`.

The 90% cap prevents the sheet from filling the entire screen, leaving chrome visible (status bar, navigation bar, or tab bar depending on context). Callers override it in three ways:

1. **`TopSheetProps.maxHeight`** — per-instance prop on any `<TopSheet>` usage
2. **`TopSheetTabConfig.maxHeight`** — registry-level cap for a given tab
3. **Map** sets this via its controller config (`mapSheetConfig.maxHeight` indirectly through the intrinsic path if it were to use one; map currently uses explicit steps)

The bootstrap behavior uses `intrinsicMaxHeight` as the initial render height (not `intrinsicSheetHeight` which starts at 0 before measurement). This avoids a zero-height flash on first mount; the `useEffect` corrects the height once `onLayout` fires.

---

## Pinned Header/Footer with Scrollable Body

**Overflow model: header and footer stay fixed; only body scrolls.**

When `overflowMode === "overflow"` (content exceeds `maxHeight`):

- Sticky header is rendered in a `View` with `flex: 0` and an `onLayout` prop — outside the `ScrollView`
- Sticky footer is rendered in a `View` with `flex: 0` and an `onLayout` prop — outside the `ScrollView`
- Body children are wrapped in a `ScrollView` with `flex: 1` and `contentContainerStyle={{ flexGrow: 1 }}`
- The `onLayout` for body measurement is placed on an inner `<View>` wrapper, not the `ScrollView` itself, because `ScrollView.onLayout` measures container height not content height

The shell's `overflow: "hidden"` clips content at the sheet boundary. This is the pre-existing clipping mechanism; it works for the pinned model because the ScrollView handles its own internal scrolling.

The overflow indicator (task 4.2) is a `pointerEvents="none"` scrim at the bottom of the scroll body, visible only when `!hasExplicitSteps && overflowMode === "overflow"`. It does not affect header/footer pinning.

---

## Animation Spring and Motion Decisions

### Current spring config

```typescript
// top-sheet.helpers.ts:3–8
SHEET_SPRING = { damping: 24, stiffness: 220, mass: 0.7, overshootClamping: true };
```

This spring drives all `withSpring` calls in the component.

### Why `height` animation was the primary jitter source (5.1 finding)

The `outerStyle` animated `height: sheetHeight.value` on the shell container. `height` is a **layout property** — each frame triggered Yoga to re-layout the entire sheet subtree (sticky header, body, reveal content, sticky footer, drag handle) and the compositor to re-clip at the changing boundary.

This was structurally the issue, not spring physics. The spring is UI-thread only (`withSpring`), `runOnJS` fires only on settle, and there are no per-frame JS-bridge crossings. The thread analysis confirmed this definitively.

### What 5.2 actually implemented

The shell now uses a **fixed** `height: maxSheetHeight` and animates **`translateY: sheetTranslateY.value`** instead of `height`. The `translateY` transform only requires compositor offset, not layout recalculation.

A second shared value `sheetTranslateY` is derived as `maxSheetHeight - currentHeight`. During drag, both `sheetHeight.value` (for step-index math) and `sheetTranslateY.value` (for visual animation) are updated. On settle, `setLayoutHeight` fires via `runOnJS` after the spring completes.

### Spring tuning: `damping: 80 / stiffness: 500` was considered but deferred

The animation profile noted that a tighter spring (`damping: 50–80, stiffness: 500`) would reduce oscillation and improve settle feel. This was labeled as a possible tuning step **if** profiling showed the current spring was the issue.

It was not the issue. The layout-property animation was. The current spring (`damping: 24, stiffness: 220`) was retained because changing it would not fix the jitter and would alter the feel of the gesture-following path unnecessarily. Spring tuning remains optional future work.

### `withTiming` animations are unchanged

`backgroundColor` uses `withTiming(220ms)` — already UI-thread, no layout impact. `expandedProgress` uses `withTiming(180ms)` driving `opacity` and `translateY` interpolation — already transform-based. No changes were needed for these.

---

## Named Constants

| Constant | Value | Location | Purpose |
|---|---|---|---|
| `MIN_BOTTOM_CHROME_ESTIMATE` | `80` | `top-sheet-constants.ts:1` | Floor for bottom chrome when computing `availableHeight` |
| `TAB_BAR_ESTIMATE` | `64` | `top-sheet-constants.ts:2` | Added to `safeBottom` to estimate tab bar height |
| `ANIMATION_DURATION_BACKGROUND` | `220` | `top-sheet-constants.ts:3` | `withTiming` duration for background color transitions |
| `ANIMATION_DURATION_EXPANDED_PROGRESS` | `180` | `top-sheet-constants.ts:4` | `withTiming` duration for reveal opacity/translate |
| `GESTURE_ACTIVE_OFFSET_Y` | `[-4, 4]` | `top-sheet-constants.ts:5` | Vertical activation window for pan gesture |
| `GESTURE_FAIL_OFFSET_X` | `[-18, 18]` | `top-sheet-constants.ts:6` | Horizontal failure window for pan gesture |
| `VELOCITY_THRESHOLD` | `500` | `top-sheet-constants.ts:7` | Velocity (px/s) for swipe direction vs snap-back detection |
| `REVEAL_TRANSLATE_OFFSET` | `8` | `top-sheet-constants.ts:8` | Initial `translateY` offset for reveal content (px) |
| `DEFAULT_STEPS` | `[0.16, 0.4, 0.65, 0.95]` | `top-sheet.helpers.ts:10` | Fallback snap points for bare `<TopSheet>` with no `steps` prop |
| `SHEET_SPRING.damping` | `24` | `top-sheet.helpers.ts:4` | Spring damping — gesture-following and settle |
| `SHEET_SPRING.stiffness` | `220` | `top-sheet.helpers.ts:5` | Spring stiffness — gesture-following and settle |
| `SHEET_SPRING.mass` | `0.7` | `top-sheet.helpers.ts:6` | Spring mass — gesture-following and settle |
| `HANDLE_HEIGHT` | `BrandSpacing.xl + BrandSpacing.md` | `top-sheet.helpers.ts:11` | Drag handle area height |
| `HANDLE_PILL_WIDTH` | `36` | `top-sheet.helpers.ts:12` | Drag handle visual width |
| `HANDLE_PILL_HEIGHT` | `4` | `top-sheet.helpers.ts:13` | Drag handle visual thickness |

---

## Files

- `src/components/layout/top-sheet.tsx` — main component
- `src/components/layout/top-sheet.helpers.ts` — spring config and re-exports
- `src/components/layout/top-sheet-constants.ts` — pure numeric constants
- `src/components/layout/top-sheet-sizing.ts` — pure sizing functions
- `src/components/layout/use-measured-content-height.ts` — measurement hook
- `src/components/map-tab/map-tab/use-map-tab-controller.tsx` — map-specific config (authoritative for map steps)
- `docs/top-sheet-map-contract.md` — map camera padding contract
- `docs/top-sheet-animation-profile.md` — animation profiling findings
