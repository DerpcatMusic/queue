# Uber/Wolt Visual Research + Queue Implementation Plan

Date: 2026-02-23  
Scope: `Queue/` Expo app (`Queue/src`)

## 1. What Uber/Wolt UI Feels Like

### Shared traits

- Fast scan hierarchy: one primary action per viewport, everything else secondary.
- Strong contrast: dark text on light surfaces (or inverse in dark mode), low-noise backgrounds.
- Large touch targets: list rows, chips, and bottom actions are easy to hit one-handed.
- Motion with purpose: sheet transitions and list updates communicate state, not decoration.
- Repetition of primitives: same card/list/chip patterns everywhere, creating familiarity.

### Uber-leaning traits

- Utility-first visual language: map and status are dominant, chrome is minimized.
- Dense information layouts that still feel clean due strict spacing and typography rhythm.
- Action states are explicit (request, active trip, next step).

### Wolt-leaning traits

- Friendly editorial tone: image-heavy discovery, clear sectioning, rounded surfaces.
- Bright brand accent used sparingly for key actions and highlights.
- High-quality spacing cadence that makes long scrolling feel calm.

## 2. Why It Works

- KISS: both apps keep one core job-to-be-done visible at a time.
- DRY: a small set of reusable UI primitives is reused across many screens.
- SOLID: visual responsibilities are separated (tokens, base components, feature screens).
- YAGNI: avoid decorative complexity that does not improve conversion or clarity.

## 3. Queue App Audit (Current)

### Strengths already in place

- Global palette-based styling (`useBrand`) and reusable expressive primitives exist.
- Native-safe area behavior and list-first structures are already used.
- Home/jobs/map/profile screens already consume shared tokens.

### Gaps vs Uber/Wolt feel

- No explicit style mode switch between native semantic palette and a strong custom brand palette.
- Visual identity can feel too close to default system appearance on some devices.
- Map overlays and non-map surfaces were not driven by a single style mode selector.

## 4. Implemented in this change

- Added a persisted theme style mode: `native | custom`.
- Kept existing `system | light | dark` mode behavior unchanged.
- Added custom light/dark brand palettes and custom map palettes.
- Wired palette selection globally through `useBrand`.
- Wired map overlays to the same style mode.
- Added profile toggle: `Theme style` (device semantic colors vs Queue custom colors).

## 5. Two Viable Approaches

### Option A (Implemented, Recommended)

- Global token switch (`native` vs `custom`) via one context.
- Pros: KISS, DRY, low regression risk, reversible.
- Cons: If a single screen needs a special look, it still must use shared tokens first.

### Option B (Not implemented)

- Per-screen restyling only (home/jobs/map custom forks).
- Pros: Fast to prototype one screen.
- Cons: violates DRY/SOLID, high long-term maintenance cost.

## 6. Next Visual Iterations (Uber/Wolt Direction)

1. Home (`src/app/(tabs)/index.tsx`): reduce competing emphasis, keep one primary CTA block.
2. Jobs feeds (`src/components/jobs/instructor-feed.tsx`, `src/components/jobs/studio-feed.tsx`): tighten row hierarchy and payout/status emphasis.
3. Map tab (`src/app/(tabs)/map.tsx`): stronger bottom-sheet hierarchy and cleaner overlay contrast.
4. Typography: increase consistency of heading cadence and micro-label usage across tabs.

## 7. External References

- Uber iOS App Store page: https://apps.apple.com/us/app/uber-request-a-ride/id368677368
- Wolt iOS App Store page: https://apps.apple.com/us/app/wolt-delivery-and-takeaway/id943905271
- Wolt engineering on scaling mobile design systems: https://careers.wolt.com/en/blog/engineering/scaling-mobile-design-systems
- Wolt design system entry: https://wolt.design/
- Wolt flow screenshots (navigation examples): https://appfuel.com/tester/review/wolt-navigation
- Uber flow screenshot example: https://pageflows.com/post/ios/uber-navigation-tabs/

## 8. Progress Log

- 2026-02-23: Added global style-mode switch (`native` vs `custom`) and mapped palette switching through `useBrand` and map components.
- 2026-02-23: Reworked Home hierarchy with stronger hero metrics and single primary action treatment.
- 2026-02-23: Improved Jobs instructor/studio hierarchy with hero metrics and clearer section headers.
- 2026-02-23: Added Map top overlay context (title/mode/selected count) and clearer zone-mode hinting.
- 2026-02-23: Polished auth entry flow with explicit step pills and tighter OTP/email progression hierarchy.
- 2026-02-23: Polished onboarding flow with clearer role selection cards, section captions, and stronger step framing.
- 2026-02-23: Polished map zone list rows with clearer selection count badges and improved touch/readability styling.
- 2026-02-23: Added explicit map zone-mode action footer (`Back` + `Save/Done`) with deterministic save/discard behavior instead of implicit-only close.
- 2026-02-23: Cleaned profile UI source artifacts (removed mojibake comments) and aligned auth OTP comments/style text for maintainability.
- 2026-02-23: Refined Studio create-job flow into step-based sections (sport/time, pay/capacity, deadlines/notes) to reduce cognitive load and improve one-handed editing.
- 2026-02-23: Added purposeful motion to Jobs rows/cards using staggered `FadeInUp` transitions for better perceived responsiveness.
- 2026-02-23: Enforced custom-style mode boundaries so expressive surfaces, navigation theme colors, and glass/ripple/elevation effects do not leak native styling when `custom` mode is active.
