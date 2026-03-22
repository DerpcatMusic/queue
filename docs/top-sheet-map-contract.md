# Top Sheet — Map Contract

Documents the current runtime contract between the top-sheet system and the map tab's camera padding behavior.

---

## (a) Authoritative Source for Map Step Fractions

**Conclusion: `use-map-tab-controller.tsx` is authoritative for the map's `steps`.**

The map tab does NOT rely on the registry default `steps: [0.18, 0.52]` from `top-sheet-registry.ts` (line 91). Instead, it constructs its own full config object and passes it via `useGlobalTopSheet`:

```typescript
// src/components/map-tab/map-tab/use-map-tab-controller.tsx:396
const mapSheetConfig = useMemo(() => ({
  // ...
  steps: [0.24, 0.56, 0.94],
  // ...
}), [...]);

useGlobalTopSheet("map", Platform.OS === "web" ? null : mapSheetConfig);
```

`useGlobalTopSheet` calls `replaceConfig(tabId, "map", mapSheetConfig)` which stores the map's own config as an override. When `GlobalTopSheet` resolves the active config via `useResolvedTabSheetConfig("map")`, the override (which includes `steps: [0.24, 0.56, 0.94]`) is merged over the registry default. The override wins for every field it specifies.

The registry default `steps: [0.18, 0.52]` is therefore **dead code for the map tab** — it is overwritten before any sheet is rendered.

**Three steps** are used in practice: `0.24` (collapsed), `0.56` (mid-expand / search), `0.94` (fully expanded).

---

## (b) How Each Step Maps to Camera Padding

There is no explicit per-step → per-padding mapping in the code. The camera padding does not vary by step index. Instead, a single `collapsedSheetHeight` value (the pixel height at step 0 / collapsed state) flows into the camera padding, and the same padding is used at all step positions.

**Data flow:**

```
TopSheet
  └─ animates height = stepHeights[activeStep]
       stepHeights[i] = steps[i] * availableHeight
       availableHeight = screenHeight - safeTop - bottomChromeEstimate

GlobalTopSheet (onLayout handler → measuredHeight)
  └─ collapsedSheetHeight = measuredHeight ?? fallbackHeight
       fallbackHeight = steps[0] * screenHeight + safeTop

ScrollSheetProvider state: collapsedSheetHeight
  └─ useCollapsedSheetHeight() → consumed by map controller

use-map-tab-controller.tsx
  └─ mapCameraPadding = {
       top: collapsedSheetHeight + MAP_CAMERA_TOP_OFFSET,
       right: BrandSpacing.lg,       // 16px
       bottom: overlayBottom + MAP_CAMERA_BOTTOM_OFFSET,  // 16px
       left: BrandSpacing.lg,        // 16px
     }
```

`MAP_CAMERA_TOP_OFFSET = BrandSpacing.xl = 24` (defined at line 29 of `use-map-tab-controller.tsx`).

`overlayBottom` comes from `useAppInsets()`.

**Important:** The camera `top` padding is derived from `collapsedSheetHeight` alone — the height at step 0. It does not update when the sheet moves to step 1 or step 2. The map camera padding is a **single static value** based on the collapsed (step 0) height.

---

## (c) Live Drag vs. Settled Heights

**Conclusion: Camera padding follows settled heights, NOT live drag.**

The chain that propagates `collapsedSheetHeight` to consumers is entirely `useEffect`-based:

```
GlobalTopSheet handleLayout (onLayout callback)
  → setMeasuredHeight(h)

useEffect: setCollapsedSheetHeight(collapsedSheetHeight)
  → ScrollSheetProvider state update

useEffect in map controller: mapCameraPadding memo recomputes
  → new padding passed to map camera
```

`onLayout` fires only after the sheet settles at a new height, not during an active drag. While the sheet is being dragged between snap points, `sheetHeight` in `TopSheet` is updated frame-by-frame via a Reanimated shared value (`sheetHeight.value = ...`), but this animated value does NOT propagate back through `onLayout`. Therefore, consumers of `useCollapsedSheetHeight()` (including the map camera padding) only see updated values **after** the sheet snaps and `onLayout` fires.

From `scroll-sheet-provider.tsx` lines 26–28:
```typescript
const [collapsedSheetHeight, setCollapsedSheetHeight] = useState(140);
const updateCollapsedSheetHeight = useCallback((height: number) => {
  setCollapsedSheetHeight((current) => (Math.abs(current - height) < 1 ? current : height));
}, []);
```

And from `global-top-sheet.tsx` lines 134–136:
```typescript
useEffect(() => {
  setCollapsedSheetHeight(collapsedSheetHeight);
}, [collapsedSheetHeight, setCollapsedSheetHeight]);
```

Both are state-setter-in-useEffect patterns — they fire on the next render after layout commits, not during animation.

This confirms the **settled-only** behavior described in the plan's Open Decisions table.

---

## Summary Table

| Aspect | Current Behavior |
|--------|-----------------|
| Authoritative step source | `use-map-tab-controller.tsx` line 396 (`steps: [0.24, 0.56, 0.94]`) |
| Registry default for map | `[0.18, 0.52]` — overwritten by map controller's override |
| Camera padding varies by step? | No — single padding using collapsed (step 0) height |
| Camera `top` formula | `collapsedSheetHeight + 24` |
| Live drag updates padding? | No — `onLayout`/`useEffect` chain only fires after settle |
| `collapsedSheetHeight` update trigger | `onLayout` in `GlobalTopSheet` with a `|Δh| < 1` noise filter |
