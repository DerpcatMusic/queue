# Top Sheet — Animation Profile (5.1)

Documents the current top-sheet animation path, identifies likely jitter sources, and states what was and was not measured at runtime.

---

## Current Animated Properties

The `TopSheet` component animates **four distinct properties** via Reanimated shared values:

| Property | Shared Value | Driver | Thread | Style Target |
|----------|-------------|--------|--------|-------------|
| `height` | `sheetHeight` | `withSpring` | UI thread | `outerStyle` (shell `Animated.View`) |
| `backgroundColor` | `animatedBackground` | `withTiming` (220ms) | UI thread | `innerStyle` + `shellBackgroundStyle` |
| `opacity` | `expandedProgress` | `withTiming` (180ms) | UI thread | `revealStyle` |
| `translateY` | `expandedProgress` (interpolated) | `withTiming` → `interpolate` | UI thread | `revealStyle` |

### Key finding: `height` is the primary motion driver

The shell's `outerStyle` (line 299–301 of `top-sheet.tsx`) is:

```typescript
const outerStyle = useAnimatedStyle(() => ({
  height: sheetHeight.value,
}));
```

This is applied to the outermost `Animated.View` (line 354), which is the shell container with `overflow: "hidden"`, border radii, and z-index. Every frame that updates `sheetHeight.value` triggers a layout property change on this container.

---

## Spring Configuration

All `withSpring` calls use the same config:

```typescript
// top-sheet.helpers.ts:3–8
export const SHEET_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true,
};
```

This spring is used in three call sites:
1. **Intrinsic path useEffect** (line 204): `sheetHeight.value = withSpring(intrinsicSheetHeight, SHEET_SPRING)`
2. **Explicit-step path useEffect** (line 217): `sheetHeight.value = withSpring(nextHeight, SHEET_SPRING)`
3. **Pan gesture `.onEnd()`** (line 277): `sheetHeight.value = withSpring(targetHeight, SHEET_SPRING)`

During active drag (`.onUpdate()`, line 243), `sheetHeight.value` is set directly (no spring) — it follows the finger 1:1 with clamping.

---

## Thread Analysis

### What runs on the UI thread
- `withSpring` → Reanimated UI-thread animation driver (good)
- `withTiming` → Reanimated UI-thread animation driver (good)
- Shared value reads inside `useAnimatedStyle` callbacks → UI thread (good)
- Pan gesture `.onUpdate()` / `.onStart()` / `.onEnd()` → UI thread via `Gesture.Pan()` (good)

### What does NOT run on the JS thread during animation
- No `useDerivedValue` reads propagate to JS during animation
- `runOnJS` is used only for `setInternalStepIndex` and `onStepChange` callbacks in `.onEnd()` — these fire once per snap settle, not per frame
- No `useAnimatedProps` or `useAnimatedReaction` exists in the component

**Conclusion: The animation is fully UI-thread driven. There is no JS-thread bottleneck in the animation loop itself.**

---

## Layout Property vs. Transform

### The `height` animation concern

`height` is a **layout property**. When Reanimated updates `height` on the UI thread each frame:
1. The new value is applied to the shadow tree / native view
2. Yoga must re-layout the subtree (children, padding, flex calculations)
3. The compositor must re-composite the changed region

This happens on the UI thread, not the JS thread, but it is still more expensive than a transform update. A `translateY` change only requires the compositor to offset a pre-rendered layer — no layout recalculation.

### Current property breakdown

| Property | Layout cost | Compositor cost | Likely jitter risk |
|----------|------------|-----------------|-------------------|
| `height` (outerStyle) | **High** — triggers Yoga relayout of entire sheet subtree every frame | Medium | **Primary suspect** |
| `backgroundColor` (innerStyle, shellBackgroundStyle) | None | Low (shader) | Negligible |
| `opacity` (revealStyle) | None | Low | Negligible |
| `translateY` (revealStyle) | None | Low | Negligible |

---

## Gesture Path

The pan gesture (lines 229–289) updates `sheetHeight.value` directly in `.onUpdate()`:

```typescript
sheetHeight.value = Math.max(minH, Math.min(maxH, startHeight + event.translationY));
```

This is a raw assignment (not wrapped in `withSpring`) during drag. On `.onEnd()`, it snaps with `withSpring`. This means:
- During drag: height changes every frame with no spring smoothing — the layout recalculation happens at the gesture update rate
- On release: spring animation takes over with `SHEET_SPRING` config

The lack of spring during drag means the sheet follows the finger exactly (expected UX), but each gesture frame still triggers a layout property change.

---

## Other Animated Elements

### `revealOnExpand` (reveal style)
Uses `opacity` + `translateY` interpolation from `expandedProgress`. This is a **transform-based** animation — low cost, unlikely to contribute to jitter. The `expandedProgress` value transitions via `withTiming(180ms)`, not `withSpring`, so there is no oscillation risk here.

### `backgroundColor` transitions
Uses `withTiming(220ms)` — linear interpolation, UI-thread, no layout impact. Already optimal.

### Overflow indicator
Uses `animatedBackground.value` for background color only — same `withTiming` driver, negligible cost.

---

## Intrinsic Sizing Path

When `hasExplicitSteps === false` (intrinsic path), the sheet height is driven by `intrinsicSheetHeight`, which is computed from `useMeasuredContentHeight` hooks. The `useEffect` on line 202–205:

```typescript
useEffect(() => {
  if (hasExplicitSteps) return;
  sheetHeight.value = withSpring(intrinsicSheetHeight, SHEET_SPRING);
}, [hasExplicitSteps, intrinsicSheetHeight, sheetHeight]);
```

This fires whenever measured content heights change (via `onLayout`). Between measurements, `intrinsicSheetHeight` is stable and no animation runs. The animation only triggers on actual content size changes — not per-frame.

The bootstrap starts at `intrinsicMaxHeight` (90% of available) and corrects down once measurements arrive. This may cause a visible "snap down" on first render.

---

## What Was Measured

### Static code analysis: ✅ complete
All animation properties, drivers, thread paths, and style targets were identified by reading the source.

### Runtime FPS measurement: ❌ not performed
This environment does not provide a native runtime surface (the map top sheet is disabled on web per `Platform.OS === "web" ? null : mapSheetConfig`). No Reanimated dev tools, FPS monitor, or `__reanimatedWorkletInit` logs were available.

### Native profiling (Flipper/Perfetto): ❌ not performed
No native device or emulator was accessible for Flipper or Perfetto-based frame timing analysis.

### Why static analysis is still useful
The thread-path analysis (UI thread only, no JS bridge per-frame calls) and property-type analysis (layout vs. transform) can be determined definitively from code without runtime observation. The conclusion that `height` animation is the primary jitter risk is structural, not empirical.

---

## Likely Jitter Source

**Primary cause: Animated `height` is a layout property.**

Evidence:
1. `outerStyle` animates `height: sheetHeight.value` (line 300)
2. `sheetHeight` is driven by `withSpring` on the UI thread — no JS bottleneck
3. `height` changes trigger Yoga relayout of the sheet subtree every animation frame
4. The subtree includes sticky header, body (possibly ScrollView), reveal content, sticky footer, and drag handle — a non-trivial layout tree
5. `overflow: "hidden"` on the shell means the compositor must clip at the changing boundary each frame

**Not the cause:**
- ~~JS-thread SharedValue reads~~ — confirmed UI-thread only; `runOnJS` only fires on settle
- ~~Spring physics~~ — `SHEET_SPRING` config (damping 24, stiffness 220) is moderate; jitter would manifest as oscillation, not frame drops. `overshootClamping: true` prevents excess oscillation
- ~~backgroundColor animation~~ — `withTiming`, no layout impact
- ~~revealStyle animation~~ — transform-based (`translateY` + `opacity`), low cost

**Secondary factor: Spring tuning.**
The `damping: 24` is on the lower end. Combined with `stiffness: 220`, the spring has noticeable oscillation before settling. This is a *feel* issue (bouncy) rather than a *performance* issue (frame drops), but it compounds the perception of jitter. A tighter spring (e.g., `damping: 50–80`, `stiffness: 500`) would reduce oscillation frames and settle faster.

---

## Recommendations for 5.2

Based on this profile, the clear path forward is:

1. **Replace `height` animation with `translateY` transform** — fix the shell at `maxSheetHeight` and animate `translateY = maxHeight - currentHeight`. This eliminates per-frame layout recalculation entirely.
2. **Consider a separate settle spring** — a tighter spring config for the `translateY` settle animation vs. the gesture-following path.
3. **Keep `withTiming` animations unchanged** — background color and expanded progress are already optimal.

---

## Files Analyzed

- `src/components/layout/top-sheet.tsx` — main component, all animated styles and gesture handlers
- `src/components/layout/top-sheet.helpers.ts` — `SHEET_SPRING` config and named constants
- `src/components/layout/top-sheet-constants.ts` — pure numeric constants
- `src/components/layout/use-measured-content-height.ts` — measurement hook (intrinsic path)
- `docs/top-sheet-map-contract.md` — settled-only camera padding behavior
