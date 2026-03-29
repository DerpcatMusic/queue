# Global Top Sheet

This folder owns the shared top-sheet system used by the role-tab experience in `queue`.

## Architecture

- `role-tabs-layout.tsx` mounts one global `GlobalTopSheet` above tab scenes.
- screens provide scene bodies through `useTabSceneDescriptor(...)`.
- sheet configs come from two sources:
  - descriptor registration in `role-tabs-layout.tsx`
  - registry overrides via `useGlobalTopSheet(tabId, config, ownerId)`
- `top-sheet-registry.ts` merges defaults + latest override for the active tab.
- `scroll-sheet-provider.tsx` exposes collapsed height so screen content can inset itself correctly.

## Rules

1. Use **one global sheet**, never ad-hoc per-screen containers.
2. The collapsed minimum must be **content-driven** for normal tab sheets.
3. Snap points are **additive**, not the minimum collapsed height.
4. Keep the first step at `0` when using content-driven collapsed sizing.
5. Put always-visible UI in `content` or `stickyHeader`.
6. Put overflow / expanded UI in `revealOnExpand`.
7. Use explicit owner ids so route ownership stays stable.

## Preferred API

Use `createContentDrivenTopSheetConfig({...})` from `top-sheet-registry.ts`.

### Collapsed content-driven sheet

```ts
const sheetConfig = useMemo(
  () =>
    createContentDrivenTopSheetConfig({
      stickyHeader: <CalendarSheetHeader />,
      backgroundColor: theme.color.primary,
      topInsetColor: theme.color.primary,
    }),
  [theme.color.primary],
);

useGlobalTopSheet("calendar", sheetConfig, "calendar:screen");
```

### Expandable content-driven sheet

```ts
const sheetConfig = useMemo(
  () =>
    createContentDrivenTopSheetConfig({
      render: () => ({
        stickyHeader: <MapSheetHeader />,
        revealOnExpand: <MapSheetResults />,
      }),
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

## Styling notes for this repo

- This repo uses **Unistyles + the current `useTheme()` theme model**.
- Do not assume `useBrand()` or older styling patterns from sibling repos.
- Keep spacing token-based with `BrandSpacing` and avoid hardcoded collapsed heights.

## If adding a new sheet

1. Build collapsed UI first.
2. Make the minimum visible state derive from actual content.
3. Add extra snap points only for expansion behavior.
4. Register with `useGlobalTopSheet(...)` or descriptor-based sheet config.
5. Verify underlying screen content uses the shared sheet inset contract.
