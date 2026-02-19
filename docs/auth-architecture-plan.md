# Authentication Architecture Plan (Expo 54 + Convex)

## Decision Summary (as of 2026-02-17)
Recommended default: **Clerk + Convex** for fastest stable implementation in Expo.

Why:
- Convex has explicit Clerk integration docs for **Expo/React Native**.
- Clerk has mature Expo SDK and session handling.
- You can still keep your Convex data model provider-agnostic, so migration to AuthKit later is low-risk.

Keep as alternative: **WorkOS AuthKit** (good cost profile, viable in Expo, but less turnkey for Convex + Expo than Clerk today).

Avoid for MVP auth core: **Convex Auth** until it exits beta.

## Option Matrix
1. **Clerk + Convex**
- Strengths: best Expo + Convex docs, fast onboarding, low integration risk.
- Tradeoff: MAU pricing can exceed AuthKit at scale.

2. **WorkOS AuthKit + Convex**
- Strengths: very generous starter pricing, modern auth UX, Expo-native guide exists.
- Tradeoff: more custom integration/testing for token lifecycle with Convex in RN.

3. **Convex Auth (beta)**
- Strengths: tight Convex-native model.
- Tradeoff: beta risk for production-critical auth path.

## Scalable Design Rules (provider-agnostic)
- Use `ctx.auth.getUserIdentity()` as the only identity source in Convex.
- Never accept `userId` from client for authorization.
- In `users`, store:
  - `tokenIdentifier` (unique index)
  - `authSubject`
  - `authProvider` (`clerk` | `authkit`)
- Keep business tables referencing internal `users._id` only.
- Add `requireAuth()` + `requireRole()` helpers in `convex/lib/auth.ts`.

## Rollout Plan
1. **Provider wiring (Clerk path)**
- Add `@clerk/clerk-expo` and `convex/react-clerk`.
- Wrap app with `ClerkProvider` + `ConvexProviderWithClerk`.

2. **Server auth enforcement**
- Refactor Convex mutations/queries to remove `studioUserId` / `instructorUserId` args.
- Resolve caller via `tokenIdentifier -> users`.
- Add role checks (`studio` only for posting jobs, `instructor` only for claims).

3. **Onboarding linkage**
- On first login, upsert user from identity, then route to role-specific onboarding.
- Lock role changes behind explicit admin flow.

4. **Hardening for scale**
- Add per-user rate limits on job posting and claim attempts.
- Add idempotency keys for webhook/auth callbacks.
- Audit every public mutation for row-level authorization.

## Decision Gate
If you want minimum integration risk now: choose **Clerk**.
If your top priority is MAU cost and you accept more integration work: choose **AuthKit**.
