# Global Top Sheet

This folder owns the shared top-sheet system used by the role-tab experience in `queue`.

## Architecture

- `role-tabs-layout.tsx` mounts one global `GlobalTopSheet` above tab scenes.
- screens provide scene bodies through `useTabSceneDescriptor(...)`.
- sheet configs come from two sources:
  - descriptor registration in `role-tabs-layout.tsx`
  - registry overrides via `useGlobalTopSheet(tabId, config, ownerId)`
- `top-sheet-registry.ts` resolves the active sheet by `tabId` plus route match, not just latest writer.
- `scroll-sheet-provider.tsx` exposes two heights:
  - `collapsedSheetHeight`: the hard minimum sheet footprint
  - `layoutSheetHeight`: the height that should affect surrounding layout

## Rules

1. Use **one global sheet**, never ad-hoc per-screen containers.
2. The collapsed minimum must be **content-driven** for normal tab sheets.
3. Snap points are **additive**, not the minimum collapsed height.
4. Keep the first step at `0` when using content-driven collapsed sizing.
5. Put always-visible minimum UI in `collapsedContent` or `stickyHeader`.
6. Put extra expansion UI in `expandedContent`.
7. `expandMode="resize"` means expanded height reshapes surrounding layout.
8. `expandMode="overlay"` means only the collapsed height blocks layout; expanded content floats over the screen.
9. Use explicit owner ids so route ownership stays stable.
10. When a tab can have more than one sheet producer, register with `routeMatchPath`.

## Current Contract

- `collapsedContent`
  - defines the minimum visible sheet footprint
  - is what content-driven collapsed sizing measures
- `expandedContent`
  - is the additional area revealed when the sheet expands
- `stickyHeader` / `stickyFooter`
  - are always visible rails inside the sheet shell
- `collapsedSheetHeight`
  - use when something must anchor to the minimum sheet blocker
- `layoutSheetHeight`
  - use when the rest of the screen should react to `expandMode="resize"`

## Deprecated Compatibility

- `content` is legacy. Prefer `collapsedContent`.
- `revealOnExpand` is legacy. Prefer `expandedContent`.
- `render()` is still supported for advanced cases, but simple sheets should not use it.

## Preferred API

Use `createContentDrivenTopSheetConfig({...})` from `top-sheet-registry.ts`.

### Collapsed content-driven sheet

```ts
const sheetConfig = useMemo(
  () =>
    createContentDrivenTopSheetConfig({
      collapsedContent: <CalendarSheetHeader />,
      backgroundColor: theme.color.primary,
      topInsetColor: theme.color.primary,
    }),
  [theme.color.primary],
);

useGlobalTopSheet("calendar", sheetConfig, "calendar:screen", {
  routeMatchPath: "/instructor/calendar",
});
```

### Expandable content-driven sheet

```ts
const sheetConfig = useMemo(
  () =>
    createContentDrivenTopSheetConfig({
      stickyHeader: <MapSheetHeader />,
      expandedContent: <MapSheetResults />,
      draggable: true,
      expandable: true,
      steps: [0, 0.56, 0.94],
      activeStep: step,
      onStepChange: setStep,
      expandMode: "overlay",
    }),
  [step],
);
```

### Push vs overlay

```ts
// Expanded height changes screen layout
expandMode: "resize"

// Only the collapsed height changes layout; expanded content overlays
expandMode: "overlay"
```

## Styling notes for this repo

- This repo uses **Unistyles v3 + the current `useTheme()` theme model**.
- Do not assume `useBrand()` or older styling patterns from sibling repos.
- Keep spacing token-based with `BrandSpacing` and avoid hardcoded collapsed heights.
- For touched top-sheet files, prefer `react-native-unistyles` `StyleSheet.create(...)` over inline objects.
- Dynamic values should go through Unistyles style functions when practical.

## If adding a new sheet

1. Build collapsed UI first.
2. Make the minimum visible state derive from actual content.
3. Decide whether expansion is `resize` or `overlay`.
4. Add extra snap points only for expansion behavior.
5. Register with `useGlobalTopSheet(...)` or descriptor-based sheet config.
6. If more than one route can own the same tab sheet, add `routeMatchPath`.
7. Verify underlying screen content uses the shared sheet inset contract.
