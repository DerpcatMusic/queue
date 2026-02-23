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
  - Produces semantic kit tokens with explicit groups:
    - `theme.color.primary`, `theme.color.primaryPressed`, `theme.color.secondary`, `theme.color.danger`
    - `theme.background.surface`, `theme.background.surfaceSecondary`, `theme.background.surfaceElevated`, `theme.background.glass`
    - `theme.foreground.primary`, `theme.foreground.secondary`, `theme.foreground.muted`
    - `theme.border.primary`, `theme.border.secondary`, `theme.border.highlight`
    - `theme.interaction.switchTrackOn`, `theme.interaction.switchTrackOff`, `theme.interaction.ripple`
    - `theme.shadow.primaryLift`, `theme.shadow.surface`
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
- Legacy compatibility wrappers removed:
  - `src/components/ui/brand-button.tsx`
  - `src/components/ui/brand-surface.tsx`
  - `src/components/ui/native-list.tsx`
- Screens now import kit primitives directly from `@/components/ui/kit`.
- Profile settings screens updated to use `KitHeader`, `KitSwitchRow`, and `KitSegmentedToggle`.

## Extension Rules

- New kit components must consume `useKitTheme()` and never declare hardcoded color literals.
- Use semantic token names only (`.primary`, `.secondary`, `.surface`, `.foreground`, `.border`, etc.) instead of direct palette fields inside components.
- New shadow/glass/overlay treatments must be tokenized in `use-kit-theme.ts`.
- Feature screens should import from `@/components/ui/kit` and avoid ad-hoc control styling.
