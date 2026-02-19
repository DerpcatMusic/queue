# Runtime Auth Debug Checklist (Expo + Clerk + Convex)

Date: 2026-02-17

This app's current MVP target is a two-sided emergency-shift marketplace with:
- role-based onboarding (`studio` / `instructor`)
- auth-gated Convex user sync
- zone-based job notification and atomic claim flow

## Primary docs
- Expo Router auth flows: https://docs.expo.dev/router/advanced/authentication-rewrites/
- Convex Clerk integration (Expo/React Native): https://docs.convex.dev/auth/clerk
- Convex `useConvexAuth` reference: https://docs.convex.dev/api/modules/react#useconvexauth
- Clerk Expo quickstart: https://clerk.com/docs/quickstarts/expo

## Critical contract checks
1. Clerk token template exists and is named `convex`.
2. That template audience (`aud`) is exactly `convex`.
3. Convex deployment env has `CLERK_JWT_ISSUER_DOMAIN` set to the same Clerk issuer domain used by your app.
4. Expo env has a valid `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
5. Expo env has a valid `EXPO_PUBLIC_CONVEX_URL` for the same deployment.

## Symptom -> likely root cause
- "Auth Initialization Timeout":
  - Clerk failed to initialize in client (network, publishable key, or Clerk-side outage).
- "Convex Auth Timeout":
  - Clerk session exists, but Convex cannot exchange/accept token (template/audience/issuer mismatch is most common).
- "Account Setup Failed" with sync error:
  - `users.syncCurrentUser` failed, usually because Convex does not see a valid identity yet.

## Commands to run locally (outside this restricted environment)
```bash
bun run lint
bunx tsc --noEmit
bunx convex env list
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-domain>.clerk.accounts.dev
```

## App behavior expectation
1. Signed-out: redirected to `/sign-in`.
2. Signed-in (Clerk), Convex auth loading: "Negotiating Convex session...".
3. Convex auth established:
  - read `users.getCurrentUser`
  - if missing, call `users.syncCurrentUser`
  - then render tab routes.
