# Performance Architecture Rules (2026-03-26)

This file defines the render-performance architecture for the primitive-first rewrite.

## Source guidance

- Expo: reducing lag in Expo apps
- Shopify: FlashList performance guidance
- Shopify: React Native new architecture migration lessons
- Unistyles v3 docs

## Core principles

1. Keep reactive surfaces small.
2. Prefer thin primitives over deep wrapper trees.
3. Keep transient visual state off React when possible.
4. Make list rows and sheet content stable by default.
5. Centralize tokens and style resolution.
6. Measure before and after changes.

## Primitive rules

- Use `src/primitives/` for new UI foundations.
- `Box` is a thin token-aware `View`, not a smart container.
- Prefer `Stack`, `VStack`, `HStack`, `Inline`, `Center`, and `Spacer` for common layout composition.
- Do not create feature-specific layout wrappers when a primitive composition is enough.

## Rerender rules

- Split large screens into memo-friendly islands.
- Avoid broad context reads in hot paths.
- Stabilize callbacks, arrays, and objects passed into list rows and sheet subtrees.
- Do not store animation-only or gesture-only state in React state.
- Prefer Reanimated shared values for highly dynamic UI state.

## List rules

- Prefer `FlashList` for heavy or recycled feeds.
- Supply `estimatedItemSize`.
- Use `getItemType` when rows differ significantly.
- Keep `renderItem` stable.
- Avoid parent-level state churn that invalidates all rows.

## Styling rules

- All theme tokens live in `src/theme/theme.ts`.
- Prefer Unistyles variants for repeated layout/state combinations.
- Avoid ad hoc one-off style derivations in hot components.
- Avoid wrapper depth created only for styling.

## State ownership rules

- State should live at the lowest level that owns behavior.
- Feature screens should orchestrate data, not micromanage view-state for all descendants.
- Derive as little as possible during render in hot trees.

## Measurement rules

- Validate list changes with FlashList perf guidance.
- Profile render churn before adding memoization everywhere.
- Prefer structural fixes over defensive memoization.
