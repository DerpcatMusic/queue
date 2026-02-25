# Convex Auth Migration (Clerk -> Convex Auth)

Date: 2026-02-19

## Scope completed in this pass

1. Removed Clerk client wiring from Expo app root.
2. Added Convex Auth server setup (`auth.ts`, `http.ts`, `auth.config.ts`).
3. Added email OTP provider via Resend (`convex/resendOtp.ts`).
4. Switched auth UI to Convex Auth actions (`signIn`, `signOut`).
5. Updated backend identity resolution to `getAuthUserId` from Convex Auth server helpers.
6. Removed Clerk index-based lookups (`by_clerk_id`) from auth-critical query/mutation paths.
7. Removed legacy `clerkId` from schema and user validators after backfilling existing user docs.

## Required environment variables

Set in Convex deployment:

1. `SITE_URL` (required for OTP providers; placeholder is fine for native)
2. `JWT_PRIVATE_KEY`
3. `JWKS`
4. `RESEND_API_KEY` (for email OTP)
5. Optional OAuth:
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `AUTH_APPLE_ID`
   - `AUTH_APPLE_SECRET`

Optional email sender:

1. `AUTH_EMAIL_FROM`
2. `AUTH_EMAIL_DEV_INBOX` (dev-only OTP reroute target for Resend test mode)

## Key generation

Use the script from Convex docs:

```js
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

process.stdout.write(`JWT_PRIVATE_KEY="${privateKey.trimEnd().replace(/\n/g, " ")}"`);
process.stdout.write("\n");
process.stdout.write(`JWKS=${jwks}`);
process.stdout.write("\n");
```

## Bun commands used

```bash
bun add @convex-dev/auth @auth/core@0.37.0 expo-secure-store
bun add resend @oslojs/crypto
bun remove @clerk/clerk-expo
bunx convex codegen
```

## Notes

1. OAuth buttons are wired in the new sign-in screen, but require provider env vars to be set.
2. OTP env aliases are accepted (`RESEND_API_KEY` and `AUTH_RESEND_KEY`).
3. For local testing with many account emails on a Resend test key, set `AUTH_EMAIL_DEV_INBOX` to your own inbox.
4. Legacy cleanup is complete:
   - A one-off migration removed old `clerkId` fields from existing users.
   - `users:getCurrentUser` no longer returns `clerkId`.
