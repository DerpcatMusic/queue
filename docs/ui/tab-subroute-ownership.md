# Tab subroute ownership

This app now follows a single rule for pushed screens inside the role-tab shell:

## Rule

- If a detail screen is opened from a tab that already owns sheet/layout state, prefer a **tab-owned subroute**.
- Only use global `/profiles/...` routes as a **fallback** for entry points that do not yet own a nested stack.

## Why

Consistent morphing and sheet behavior require three things to agree:

1. the active tab resolver
2. the nested route stack that owns push/pop animation
3. the top-sheet/layout owner for that tab

If a screen is pushed into a global route instead of a tab-owned stack, the shell can lose transition consistency.

## Canonical patterns

### Instructor map-owned studio profile

- route: `/instructor/map/studios/[studioId]`
- branch route: `/instructor/map/studios/[studioId]/branches/[branchId]`

### Instructor jobs-owned studio profile

- route: `/instructor/jobs/studios/[studioId]`
- branch route: `/instructor/jobs/studios/[studioId]/branches/[branchId]`

### Studio jobs-owned instructor profile

- route: `/studio/jobs/instructors/[instructorId]`

### Global fallback profiles

- `/profiles/studios/[studioId]`
- `/profiles/studios/[studioId]/branches/[branchId]`
- `/profiles/instructors/[instructorId]`

Use these only when the launching surface does not yet have an owned nested stack.

## Shared infrastructure

- `src/components/layout/tab-subroute-stack.tsx`
  - shared stack shell for tab-owned pushed routes
- `src/navigation/role-routes.ts`
  - `resolveRoleTabRouteName(...)` keeps nested routes mapped to the correct owning tab
- `src/navigation/public-profile-routes.ts`
  - canonical builders for public profile route paths

## Current note about home tab

Home-origin profile pushes still use the global fallback path. This is intentional for now because home does not yet own a dedicated nested subroute stack.

If home later gets pushed detail routes, prefer adding a tab-owned stack first and then replacing the fallback route usage.
