# Primitive-First Unistyles Rewrite RFC (2026-03-26)

## Status

- Draft
- Branch: `perf/primitive-first-unistyles`
- Worktree: `/home/derpcat/projects/queue-worktrees/primitive-first-unistyles`
- Primary target: iOS + Android first
- Secondary target: web parity after native architecture is proven

## Summary

We will do a **big-bang UI architecture rewrite**.

The app currently mixes:

- NativeWind / `className`
- `global.css` theme tokens
- JS tokens in `src/lib/design-system.ts`
- `BrandSpacing` / `BrandRadius` / `BrandType` aliases
- `useTheme()`-driven inline styles
- kit wrappers and theme adapters

This hybrid architecture increases rerender risk, boilerplate, and maintenance cost.

The target state is a **primitive-first**, **token-first**, **Unistyles-first** UI system with:

- one styling engine
- one token source of truth
- thin primitives
- fewer wrapper hops
- less screen-level boilerplate
- better theme/runtime performance characteristics

This rewrite explicitly prioritizes **end-state quality over temporary app stability**.

## Why a Big-Bang Rewrite Is Justified

An incremental migration would keep the most expensive part of the system alive the longest: **the mixed stack**.

Today we already have enough signals that the app is paying for overlap:

- NativeWind is wired through Metro and global CSS
- design tokens exist separately in JS
- theme values are pulled through hooks in many files
- Expo Symbols, `expo-image`, and FlashList are only partially standardized
- wrapper depth is too high in shared controls

Keeping old and new UI systems alive simultaneously would create:

1. two mental models
2. two sources of styling truth
3. more adapter code
4. longer migration time
5. higher regression surface

For this repo, the clean break is more rational than prolonged dual maintenance.

## Goals

1. Reduce rerenders caused by styling/theme plumbing where practical.
2. Reduce UI boilerplate per screen and per component.
3. Standardize on one token model for spacing, sizing, radius, typography, color, and motion.
4. Replace layered UI wrappers with a small primitive set.
5. Standardize app iconography on Expo Symbols wherever platform-native symbols exist.
6. Standardize high-impact performance primitives:
   - FlashList for heavy lists
   - `expo-image` for remote/recycled images
7. Make native screens easier to build, scan, and maintain.

## Non-Goals

1. Preserving temporary compatibility with the current kit APIs.
2. Keeping NativeWind as a permanent fallback.
3. Achieving web-perfect parity before native architecture is proven.
4. Designing a giant abstraction DSL that hides React Native.

## Product/Platform Strategy

### Native first

This rewrite optimizes first for:

- iOS
- Android

Web remains in scope, but it is **not** the pacing constraint for the rewrite.

Reason:

- Unistyles' strongest value proposition is on native
- web has the most migration quirks
- native is the highest-confidence path to meaningful UI performance improvement

### Web second

Once native architecture is stable, we will close the remaining web gaps intentionally.

This means some rewrite phases may temporarily degrade or suspend web fidelity.

## Decision

We will:

1. Adopt `react-native-unistyles` as the primary styling engine.
2. Remove NativeWind from the long-term architecture.
3. Replace duplicated token definitions with one canonical theme contract.
4. Introduce a small primitive layer instead of growing the current kit abstraction tree.
5. Flatten shared component layers aggressively where they do not create clear leverage.

## Performance Hypothesis

We are not assuming a miracle from Unistyles alone.

Expected wins come from the combination of:

1. less theme/context-driven style churn
2. fewer inline style objects and ad hoc style derivations
3. thinner shared components
4. more stable list rows and image primitives
5. less duplicated layout/styling code
6. a simpler mental model that produces fewer accidental rerender traps

Unistyles is valuable here because it supports a native-oriented style runtime and a typed theme system that better matches this app's design-system direction.

## Current Problems To Eliminate

### 1. Split styling model

- NativeWind for layout and typography utilities
- inline JS for colors and dynamic dimensions
- duplicated token definitions in CSS and JS

### 2. Wrapper depth

Example patterns already exist where a simple button passes through multiple layers before reaching native primitives.

### 3. Token drift risk

The app currently has multiple token representations that can drift independently.

### 4. Screen noise

Some screens are too large and too styling-heavy, with too many one-off layout decisions.

### 5. Inconsistent primitive usage

- some places use `className`
- some use `StyleSheet.create`
- some use inline objects
- some use legacy themed wrappers
- some use kit wrappers

## Target Architecture

## 1) One Theme Contract

Create a single canonical theme contract in one file:

- `src/theme/theme.ts`

This file is the source of truth for:

- tokens
- light/dark themes
- theme types
- theme preference helpers
- status token helpers
- Unistyles runtime configuration

Other old theme-related files should become temporary compatibility re-exports only, then be deleted.

### Canonical token families

#### Space

Core scale:

- `xs = 4`
- `sm = 8`
- `md = 12`
- `lg = 16`
- `xl = 24`
- `xxl = 32`

Semantic aliases where reuse is strong:

- `stackTight`
- `stack`
- `stackRoomy`
- `stackLoose`
- `insetTight`
- `inset`
- `insetRoomy`
- `section`

#### Size

- control heights
- icon sizes
- avatar sizes
- feature-specific dimensions only when truly needed

#### Radius

- `hard = 12`
- `medium = 18`
- `soft = 24`
- `pill = 999`

#### Typography

- `caption`
- `body`
- `bodyStrong`
- `label`
- `title`
- `heading`
- `display`

#### Color

- brand
- surface
- text
- border
- semantic states
- limited feature accents only when justified

#### Motion

- `fast = 140ms`
- `normal = 220ms`
- `slow = 320ms`
- `emphasis = 420ms`

### Semantic alias mapping

These aliases are not free-form.

- `stackTight = sm`
- `stack = md`
- `stackRoomy = lg`
- `stackLoose = xl`
- `insetTight = md`
- `inset = lg`
- `insetRoomy = xl`
- `section = xxl`

New aliases require proof of repeated use across multiple components or screens.

## 2) Primitive-First Layer

We will use a very small primitive set.

### Core primitives

- `Box`
- `Stack`
- `Inline`
- `Text`
- `Icon`
- `Surface`
- `Button`
- `TextField`
- `List`

These live in one centralized folder:

- `src/primitives/`

## 2.1) Centralized custom component library

Anything above primitives but still reusable UI belongs in a centralized custom component library, not scattered through feature folders.

Initial target:

- `src/components/ui/`

Rule:

- `src/primitives/` = building blocks
- `src/components/ui/` = reusable composed UI
- feature folders = feature-specific UI only

### Primitive rules

Primitives exist to remove repetitive code, not to become a second language.

They must:

- expose only stable token-backed props
- accept `style` as an escape hatch
- pass through relevant native props
- remain visually predictable
- be reusable across multiple features, not one feature only

They must not:

- expose every flexbox prop as shorthand
- introduce boolean soup
- become feature-specific mega-components
- hide composition so aggressively that debugging becomes harder

### Primitive admission criteria

A component qualifies as a primitive only if it satisfies all of these:

1. It solves a repeated UI need across multiple features.
2. Its visual contract is token-driven and stable.
3. It does not encode feature/business logic.
4. It reduces repeated code without introducing a component-specific mini-language.

Examples:

- `Surface` qualifies because cards/panels/sheets repeat across the app.
- `Badge` may qualify later if multiple features need the same status or count treatment.
- `PaymentsBalanceHero` does not qualify; it is feature UI.

### `Surface` definition

`Surface` is a tokenized container primitive for card-like or panel-like backgrounds.

It is responsible for:

- background tone
- border treatment
- radius
- padding

It is not responsible for:

- business state logic
- feature-specific copy/layout
- custom shadow tuning per screen

## 3) Tokenized Layout Props

Yes: tokenized spacing/layout props are part of the target architecture.

But they must be **limited and disciplined**.

### Allowed shorthand family

For containers and layout primitives, support tokenized spacing props like:

- `p`
- `px`
- `py`
- `pt`
- `pr`
- `pb`
- `pl`
- `m`
- `mx`
- `my`
- `mt`
- `mr`
- `mb`
- `ml`
- `gap`

Examples:

- `p="sm"`
- `px="lg"`
- `gap="stack"`
- `mt="section"`

### Why this is worth it

These props meaningfully reduce screen boilerplate while still mapping cleanly to design tokens.

### What we will not do

We will **not** introduce shorthand for everything.

Avoid:

- `jc`
- `ai`
- `fd`
- `br`
- `bw`
- transform shorthands
- position shorthands for every edge case

The goal is not a mini Tailwind clone in props.

The goal is a small number of **high-value token props**.

### Enforcement rule for shorthand props

Only the approved spacing shorthands listed above are allowed.

If a layout need cannot be expressed with those props plus a normal `style` escape hatch, that does **not** automatically justify a new shorthand. The default answer is to use `style` first and only promote a new shorthand after repeated evidence.

## 4) Styling Engine Policy

### Unistyles becomes the only styling engine

Long-term target:

- remove NativeWind Metro integration
- remove `global.css` as a token source
- remove `className` as the standard styling path
- remove the current custom UI kit once its useful pieces are replaced or absorbed

### Style authoring rules

1. Shared primitives use Unistyles stylesheets.
2. Feature components use Unistyles stylesheets or primitive props.
3. Avoid hook-driven theme access in render-heavy code unless required.
4. Prefer theme access inside Unistyles style definitions instead of ad hoc object construction in render.

### Escape hatch policy

`style` remains available, but it is constrained.

Allowed uses:

- one-off layout adjustments
- rare transforms
- platform-specific edge cases
- temporary migration glue

Disallowed uses:

- recreating old token systems inline
- repeated ad hoc spacing/color conventions
- bypassing primitive variants for common states

Any repeated `style` escape hatch pattern should be either:

1. normalized into the primitive/token system, or
2. kept explicitly one-off and documented as such.

Temporary migration glue added via `style` should be treated as debt and cleaned up before the rewrite branch is considered complete.

## 4.1) Migration Mechanics

`migrate` must mean one of three concrete actions:

1. **Rewrite in place**: replace NativeWind / inline / legacy style logic directly with Unistyles + primitives.
2. **Split then rewrite**: first break a giant file into smaller pieces, then migrate those pieces.
3. **Delete and replace**: remove a low-value wrapper or compatibility layer entirely and replace call sites.

We should avoid compatibility wrappers whose only job is to let old and new systems coexist longer.

### Pattern conversion rules

- `className` layout/spacing -> primitive props or Unistyles stylesheet
- duplicated token constants -> canonical theme tokens
- hook-built inline style objects -> Unistyles stylesheet or memoized primitive configuration
- low-value passthrough wrappers -> delete and inline or replace

## 5) Icon Policy

### Default rule

Use Expo Symbols for app UI iconography.

### Allowed exception

Brand logos may use a dedicated isolated brand-icon component.

Examples:

- Google
- Apple
- Instagram
- TikTok

### Platform expectations

- iOS: SF Symbols
- Android/web: Material Symbols via Expo Symbols mapping/fallbacks

We will not allow scattered direct icon-pack imports across feature code.

## 6) List and Image Policy

### Lists

Use FlashList for heavy, scrollable, repeated content.

### Images

Use `expo-image` for remote, repeated, cached, or recycled images.

Remaining RN `Image` usage should be treated as migration debt unless there is a concrete reason to keep it.

## Scope of Deletions

The end state should remove or collapse the following categories:

1. NativeWind styling path
2. duplicated token definitions in CSS and JS
3. `Brand*` alias indirection if redundant
4. theme adapter layers that exist only to translate between systems
5. thin passthrough wrappers with no durable value
6. old kit components that duplicate primitive responsibilities

## Migration Plan

## Phase 0 — Proof Before Full Cutover

Deliverables:

1. Unistyles configuration works on Expo 55 in this repo.
2. Native theme switching works.
3. Breakpoints work.
4. Primitive spike compiles on native.

Exit criteria:

1. We are confident enough to commit to the rewrite.
2. The base primitive model feels materially simpler than the current stack.
3. Native measurement baselines are captured for comparison.

### Required baselines before Phase 1

At minimum record:

1. render/commit behavior on onboarding
2. render/commit behavior on instructor payments
3. one heavy list flow
4. theme switch behavior
5. current web support assumptions and known Unistyles web gaps
6. global top sheet behavior as the first dynamic proving ground

### Phase 0 web deliverable

Before Phase 1 begins, write down:

1. known Unistyles web limitations observed in this repo
2. acceptable temporary web regressions during native-first rewrite
3. unacceptable web failures that would force a strategy change

## Phase 1 — Foundation Rewrite

Deliverables:

1. Canonical token contract.
2. Light and dark themes.
3. Primitive implementations.
4. Icon primitive.
5. Theme/runtime bootstrapping.

Hard rule:

No new UI work lands on the old styling system in the rewrite branch.

## Phase 2 — Core Surface Cutover

Migrate foundational/shared surfaces first:

1. app shell wrappers
2. shared controls
3. buttons
4. text fields
5. surfaces/cards
6. profile scaffolding
7. empty/loading/error states

Goal:

Destroy the old shared abstractions before migrating the largest feature screens.

## Phase 3 — Feature Rewrite

This phase does **not** start until Phase 2 shared controls are stable enough that feature work will not need immediate re-migration.

Priority order:

1. auth
2. onboarding
3. payments
4. profile
5. jobs cards/lists
6. map support surfaces
7. remaining settings/screens

High-noise files should be split while migrating instead of mechanically restyled in place.

## Phase 4 — Cleanup and Standardization

Delete:

- NativeWind wiring
- obsolete kit layers
- duplicated token systems
- dead compatibility shims

Then enforce the new standard via lint rules / review rules / docs.

## Rollback Boundary

The rewrite is big-bang, but it still needs a decision boundary.

If the branch reaches the end of Phase 1 and either of these is true:

1. the primitive foundation is not clearly simpler than the current stack, or
2. native performance characteristics are not trending in the right direction,

then the rewrite pauses and we reassess before deeper feature migration.

We do **not** push into full feature rewrite just because foundation work has already started.

## Validation Gates

We should not trust the rewrite by vibes alone.

### Measure before and after on representative native screens

At minimum:

1. app start responsiveness
2. theme switch behavior
3. list scroll smoothness
4. interaction latency on heavy screens
5. React commit volume on hot flows

### Representative screens

At minimum:

1. onboarding
2. instructor payments
3. profile hero/settings surface
4. one heavy list screen

## Governance Rules For The Rewrite Branch

1. No new `className` usage.
2. No new duplicated tokens.
3. No new wrapper layers without explicit justification.
4. New shared UI must be primitive-first.
5. Any new abstraction must prove it removes repeated code in multiple places.
6. Native-first decisions win when web concerns conflict during the rewrite.

## Enforcement Plan

Documentation alone is not enough.

We should add automated guardrails in the rewrite branch:

1. lint rule or code search check blocking new `className` usage
2. lint rule or code search check blocking new `BrandSpacing` / `BrandRadius` / `BrandType` imports once the new token system exists
3. review checklist for any new shared abstraction requiring proof of repeated use
4. migration checklist showing acceptable conversions for `className`, inline styles, and old wrappers

### Native-first decision rule

When native and web concerns conflict during the rewrite:

1. if native UX/perf materially improves and web breakage is non-fatal, native wins temporarily
2. if the choice creates long-term architectural lock-in that makes web support unrealistic, pause and reassess
3. if a compromise adds a permanent second styling path, reject the compromise

## Risks

### 1. Web parity risk

Unistyles on web may require extra handling and should not dictate the native rewrite.

### 2. Primitive bloat risk

If we expose too many props, we will recreate a slower, more confusing version of the current kit.

### 3. False-performance-win risk

If we only swap styling syntax but keep bad component boundaries, rerender improvements may disappoint.

### 4. Rewrite fatigue risk

A broken-branch rewrite can stall if the target architecture is not decided early and defended consistently.

## Kill Criteria

Pause or downgrade the plan if any of these become true:

1. Unistyles proves unstable enough in this repo that native development becomes friction-heavy.
2. The primitive model starts growing into another abstraction maze.
3. After representative migrations, native performance is not materially better.
4. The team cannot converge on one token contract.

## Initial File Targets

### Foundation

- `src/theme/theme.ts`
- `src/lib/design-system.ts`
- `src/constants/brand.ts`
- `src/global.css`
- `src/hooks/use-theme.ts`
- `src/hooks/use-theme-preference.tsx`
- `src/components/ui/kit/use-kit-theme.ts`

### Shared UI simplification candidates

- `src/primitives/`
- `src/components/ui/`
- `src/components/ui/action-button.tsx`
- `src/components/ui/app-button.tsx`
- `src/components/ui/app-button.shared.tsx`
- `src/components/ui/kit/kit-pressable.tsx`
- `src/components/ui/kit/kit-button-group.tsx`
- `src/components/ui/kit/kit-text-field.tsx`

### Feature hotspots

- `src/app/onboarding.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx`
- `src/components/profile/profile-tab/profile-mobile-hero.tsx`
- `src/components/map-tab/map/map-sheet-results.tsx`
- `src/components/layout/global-top-sheet.tsx`
- `src/components/layout/top-sheet.tsx`
- `src/components/layout/top-sheet-search-bar.tsx`

## Recommended End-State Folder Shape

One reasonable target:

- `src/theme/theme.ts`
- `src/primitives/`
- `src/components/ui/`
- `src/features/<feature>/`

Where:

- `theme.ts` owns tokens + themes + runtime config
- `primitives` owns reusable UI building blocks
- `components/ui` owns reusable composed UI
- `features` own screen composition

## Open Questions

1. How far should tokenized props go before they become noise?
2. Which current kit components survive as thin wrappers over primitives?
3. What is the minimum viable web support bar during rewrite?

## Recommendation

Proceed.

This repo is a strong candidate for a big-bang primitive-first rewrite because the current overlap is already expensive, and the desired destination is clear:

- less rerender overhead
- less boilerplate
- fewer abstractions
- stronger token discipline
- native-first performance
