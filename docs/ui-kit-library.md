# Queue UI Kit (Global, Custom, Native-Safe)

Date: 2026-02-23  
Scope: `Queue/src/components/ui/kit/*`

## Goals

- One reusable UI library for buttons, chips, FABs, headers, text fields, lists, switches, and segmented toggles.
- Zero component-level hardcoded colors.
- All visual styling derives from global semantic palette (`useBrand`) through one adapter hook (`useKitTheme`).
- Keep native behavior and animation support (haptics, ripple, reanimated press feedback, glass fallback rules).

## Architecture

- Global theme adapter: `src/components/ui/kit/use-kit-theme.ts`
  - Reads `useBrand()` + `useThemePreference()`.
  - Produces semantic kit tokens:
    - `glassBackground`
    - `highlightBorder`
    - `primaryLiftShadow`
    - `surfaceShadow`
    - `switchTrackOn` / `switchTrackOff`
    - `transparent`
    - `symbolTint`
- Color utility: `src/components/ui/kit/color-utils.ts`
  - Converts hex semantic colors into alpha variants without per-component color literals.

## Components

- `KitButton`
- `KitChip`
- `KitFab`
- `KitSurface`
- `KitTextField`
- `KitList`
- `KitListItem`
- `KitHeader`
- `KitSwitchRow`
- `KitSegmentedToggle`

Exports are centralized in `src/components/ui/kit/index.ts`.

## Migration + Cleanup

- Legacy `expressive/*` implementation removed.
- Existing wrappers now point to kit:
  - `src/components/ui/brand-button.tsx` -> `KitButton`
  - `src/components/ui/brand-surface.tsx` -> `KitSurface`
  - `src/components/ui/native-list.tsx` -> `KitList` + `KitListItem`
- Profile settings screens updated to use `KitHeader`, `KitSwitchRow`, and `KitSegmentedToggle`.

## Extension Rules

- New kit components must consume `useKitTheme()` and never declare hardcoded color literals.
- New shadow/glass/overlay treatments must be tokenized in `use-kit-theme.ts`.
- Feature screens should import from `@/components/ui/kit` and avoid ad-hoc control styling.

