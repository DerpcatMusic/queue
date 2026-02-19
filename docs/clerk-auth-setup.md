# Clerk + Convex Setup (Expo)

## 1) Required env vars
Set these locally (`.env.local`) and in deployment where relevant:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`
- `CLERK_JWT_ISSUER_DOMAIN` (Convex env var, not Expo public)

`.env.example` already includes placeholders.

## 2) Clerk dashboard configuration
1. In Clerk, enable your sign-in methods (email + password is used by current screens).
2. In Clerk, create a JWT template named `convex`.
3. In that template, ensure audience (`aud`) is `convex`.
4. Copy your Clerk issuer domain (looks like `https://<your-domain>.clerk.accounts.dev`).

### Phone requirement warning (important for IL launch)
- If Phone Number is marked **required** in Clerk and your instance cannot send SMS to `+972`, sign-up will fail with `unsupported_country_code`.
- For this app's current flow, set phone as **optional/off** and use email verification only.
- If phone auth is required later, verify Clerk SMS coverage for Israel before enabling it in production.

## 3) Convex auth config
`convex/auth.config.ts` is configured for Clerk with:
- `applicationID: "convex"`
- `domain: CLERK_JWT_ISSUER_DOMAIN`

Set Convex env var:

```bash
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-domain>.clerk.accounts.dev
```

## 4) Current app behavior
- Signed-out users are redirected to `app/(auth)/sign-in.tsx`.
- `app/(auth)/sign-up.tsx` creates account + verifies email code.
- After sign-in, the app syncs identity into Convex `users` via `users.syncCurrentUser`.
- Backend authorization uses `ctx.auth.getUserIdentity()` and role checks.

## 5) Common failure modes
- `Unauthenticated` in Convex: JWT template or audience mismatch.
- `Authenticated user is not registered`: `users.syncCurrentUser` did not run yet.
- Auth works in Clerk but not Convex: wrong `CLERK_JWT_ISSUER_DOMAIN` in Convex env.
