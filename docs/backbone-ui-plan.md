# UI Backbone Plan (Phase 1)

## Goal
Ship the first real app backbone on top of working Convex Auth + Convex backend:
- role-gated onboarding
- consistent visual system
- non-placeholder home/explore tabs

## In Scope (This Slice)
- One visual direction: flat surfaces with tactile, skeuomorphic-like buttons.
- `/onboarding` flow for `pending` users.
- Convex wiring to existing onboarding mutations.
- Tab-level route guard so non-onboarded users cannot access app flows.
- Home and Explore tabs converted from template content to product scaffolding.

## Explicitly Out Of Scope (Next Slice)
- Studio emergency job posting form.
- Instructor live open-jobs feed.
- Claim mutations and optimistic race UX.
- Push token registration and dispatch workers.
- Map rendering and polygon zone selection.

## UX Direction
- **Duolingo energy**: clear progress, positive accent color, chunky controls.
- **Uber clarity**: strong contrast text and direct hierarchy.
- **Wolt freshness**: cool cyan accents and soft surfaces.
- **Flat + tactile**: mostly flat layout, but depth on primary actions via layered shadows and press offset.

## Success Criteria
- Signed-in `pending` user is redirected to `/onboarding`.
- Completing onboarding routes user into tabs.
- Home and Explore render meaningful scaffolding content.
- Styles are reusable via shared primitives/tokens (not screen-local one-offs).
