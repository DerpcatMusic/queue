# Account Model Reset Plan

## Verdict

The app currently uses the wrong identity model for the product:

- one `users` row can own both instructor and studio roles
- profile switching is implemented as role switching on the same account
- this behaves like workspaces, not account switching

For the product you described, the target should be:

- one account = one role
- studios are separate accounts
- instructors are separate accounts
- account switching is session switching, not role switching
- the same email should resolve to one canonical account across providers

## What Exists Today

Current multi-role behavior is intentional in:

- `convex/schema.ts`
- `convex/onboarding.ts`
- `convex/users.ts`
- `src/contexts/user-context.tsx`
- `src/components/profile/profile-role-switcher-card.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/index.tsx`
- `src/app/(app)/(studio-tabs)/studio/profile/index.tsx`

## Product Direction

### Keep

- one auth identity session at a time
- same-email linking across Google / Apple / email providers
- ability to remember multiple signed-in accounts on device

### Remove

- `users.roles`
- `switchActiveRole`
- “set up instructor workspace” / “set up studio workspace”
- role switcher card in profile
- onboarding flows that merge a second role into the same user

### Replace With

- a lightweight account switcher, like Instagram
- each remembered account has:
  - avatar
  - display name
  - role badge
  - email
- tapping an account switches session context
- “Add account” starts a fresh sign-in flow

## UX Recommendation

### Primary entry point

Put account switching in the Profile tab, at the top of the profile screen.

Reason:

- account switching is identity-scoped, not task-scoped
- it is lower-frequency than home/jobs/calendar actions
- users already expect identity/account controls in Profile

### Best interaction

Use a compact account chip in the profile header:

- avatar
- name
- role label
- chevron

Tap:

- opens a bottom sheet with remembered accounts

Long press:

- optional shortcut to open the same sheet

### Secondary shortcut

Long-pressing the Profile tab icon can also open the account switcher sheet later.

This should be a power-user shortcut, not the only entry point.

Do not put a permanent navbar switcher button in the main tab bar.
That over-promotes a secondary action and adds noise on every screen.

## Switcher Sheet Contents

Keep it minimal:

1. Current account row
2. Other remembered accounts
3. `Add account`
4. `Manage accounts`
5. `Sign out`

No nested workspace concepts.
No role toggles inside the switcher.
No “switch to studio mode” on the same user.

## Backend Refactor Plan

### Phase 1: Freeze multi-role growth

- stop offering “setup second workspace” UI
- stop calling `switchActiveRole` from the app
- stop exposing `availableRoles` as a product concept
- prevent onboarding from adding a second role to an existing user

### Phase 2: Make role single-source-of-truth

- keep `users.role`
- deprecate `users.roles`
- remove code that merges owned roles
- make current role immutable after onboarding, unless changed by an explicit admin migration

### Phase 3: Session-based account switching

- store remembered accounts locally on device
- each stored account corresponds to a distinct auth session / user
- switching accounts restores that session, not a role on the same user

### Phase 4: Data cleanup

- audit duplicate emails
- resolve canonical users
- decide migration rule for existing multi-role users:
  - split into separate accounts, or
  - keep one side and archive the other until manual migration

## Duplicate Email Policy

Target rule:

- one canonical `users` account per email
- all providers for that email link to the same account
- if email ownership is ambiguous, block linking and require explicit recovery

Current code already attempts to dedupe and link by verified email, but live data must still be audited.

## Immediate Next Steps

1. Add a protected duplicate-email report and inspect all live duplicates.
2. Remove profile role-switcher UI from the app.
3. Stop onboarding from attaching a second role to the same user.
4. Design and implement the account switcher sheet in Profile.
5. Plan the migration of existing multi-role users before deleting `users.roles`.
