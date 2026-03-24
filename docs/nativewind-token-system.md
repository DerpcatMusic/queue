# NativeWind Token System

This worktree is standardizing styling around a small semantic token set rather than ad-hoc math and one-off values.

## Goals

- Reduce the number of styling decisions made per screen.
- Prefer semantic tokens over raw numbers.
- Keep the brand recognizable while making surfaces and controls feel more coherent.
- Preserve compatibility with existing `BrandSpacing`, `BrandRadius`, `BrandType`, and `useBrand()` consumers during migration.

## Core Rules

- Use semantic tokens first.
- Use raw scale tokens only when the semantic token is genuinely the wrong fit.
- Do not create new radius or spacing values by subtracting or adding arbitrary numbers unless the component is mathematically derived.
- Prefer NativeWind class tokens for layout, spacing, and rounding when the value is static.
- Keep dynamic colors and dynamic dimensions in `style` / `vars()`.

## Radius System

We are collapsing the app to four rounding styles:

- `hard`: dense controls, chips, tags, segmented items
- `medium`: standard controls, inputs, inline cards
- `soft`: primary cards, sheets, hero surfaces
- `pill`: fully rounded badges, chips, avatars, capsules

### Canonical Values

- `hard = 12`
- `medium = 18`
- `soft = 24`
- `pill = 999`

### Backwards Compatibility Mapping

- `card -> soft`
- `cardSubtle -> medium`
- `button -> medium`
- `buttonSubtle -> hard`
- `input -> medium`
- `icon -> pill`
- `circle -> pill`

## Spacing System

Raw scale stays:

- `xs = 4`
- `sm = 8`
- `md = 12`
- `lg = 16`
- `xl = 24`
- `xxl = 32`

Semantic spacing should be preferred in component APIs and repeated layouts:

- `stackTight = sm`
- `stack = md`
- `stackRoomy = lg`
- `stackLoose = xl`
- `insetTight = md`
- `inset = lg`
- `insetRoomy = xl`
- `section = xxl`
- `controlX = 14`
- `controlY = 12`

## Size System

Use a small set of semantic sizes for controls and feature surfaces:

- `controlSm = 38`
- `controlMd = 44`
- `controlLg = 52`
- `iconSm = 18`
- `iconMd = 24`
- `iconLg = 32`
- `avatarSm = 38`
- `avatarMd = 48`
- `avatarLg = 78`

Only keep custom dimensions when they are truly feature-specific, such as map heights or animation halos.

## Color System

Use only these categories:

- `brand`: primary, primarySubtle, primaryPressed, secondary, onPrimary
- `surface`: appBg, surface, surfaceAlt, surfaceElevated
- `text`: text, textMuted, textMicro
- `border`: border, borderStrong
- `semantic`: success, successSubtle, warning, warningSubtle, danger, dangerSubtle
- `feature accents`: `calendar`, `payments`, `didit` only when the feature needs its own accent identity

Do not introduce new ad-hoc rgba colors if an opacity on an existing token will work.

## NativeWind Naming

NativeWind theme tokens should expose:

- `rounded-hard`
- `rounded-medium`
- `rounded-soft`
- `rounded-pill`

Spacing and sizes should expose semantic names where we reuse them:

- `gap-stack`
- `gap-stack-tight`
- `gap-stack-roomy`
- `px-inset`
- `px-inset-roomy`
- `min-h-control-sm`
- `min-h-control-md`
- `min-h-control-lg`

Raw scale utilities like `px-md` and `gap-lg` still exist, but semantic aliases are preferred for shared components.

## Migration Priority

1. Shared UI kit and profile scaffolding
2. Auth and onboarding surfaces
3. Profile screens with heavy style debt
4. Map / web shell surfaces
5. Home dashboards and list cards

## Review Standard

Every migrated file should answer yes to these:

- Are radius choices one of `hard`, `medium`, `soft`, or `pill`?
- Are repeated paddings and gaps using semantic tokens or the core scale?
- Are colors sourced from the palette or a defined feature accent?
- Is there less arithmetic in styles than before?
- Would another screen make the same styling decision by default?
