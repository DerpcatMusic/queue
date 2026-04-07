# Didit vs Airwallex KYC Audit

Date: 2026-04-07

## Current conclusion

Didit is still functionally required in the current app.

It is not part of the new Airwallex payment checkout path, but it still actively gates identity and compliance flows for both instructors and studios.

## What still depends on Didit

### Backend

- `convex/didit.ts`
  - Owns Didit session creation, refresh, webhook processing, and verification state updates.
- `convex/access.ts`
  - Builds instructor and studio access snapshots with Didit verification payloads.
- `convex/compliance.ts`
  - Instructor compliance still includes Didit-derived identity fields and decisions.
- `convex/complianceStudio.ts`
  - Studio compliance still uses owner identity state derived from Didit.
- `convex/http.ts`
  - Still exposes `POST /webhooks/didit`.
- `convex/webhooks.ts`
  - Still handles Didit webhook verification and dispatch.

### Frontend

- `src/app/(app)/(instructor-tabs)/instructor/profile/compliance.tsx`
  - Starts and refreshes native Didit verification for instructors.
- `src/app/(app)/(studio-tabs)/studio/profile/compliance.tsx`
  - Starts and refreshes native Didit verification for studio owners.
- `src/lib/didit-native.ts`
  - Native Didit SDK bridge used by the compliance flows.
- `src/features/compliance/didit-ui.ts`
  - UI state model and actions for Didit verification.

### App/package/config

- `package.json`
  - Depends on `@didit-protocol/sdk-react-native`.
  - Runs a Didit Android patch in `postinstall`.
- `app.json`
  - Includes the Didit plugin and camera permission copy for verification.
- `.env.example`
  - Still requires Didit API/workflow/webhook env vars.

## What Didit is doing today

Didit is being used as identity verification / KYC state, not as the payment processor.

- Instructor side: personal identity verification.
- Studio side: owner identity verification.
- It currently influences access snapshots and compliance readiness.

## Airwallex capability check

Airwallex connected accounts and native onboarding appear capable of replacing this eventually, including Israel support, but that is not implemented yet in this repo.

Relevant official Airwallex docs:

- Regional availability:
  - https://www.airwallex.com/docs/connected-accounts/about/regional-availability
- Israel individual KYC requirements:
  - https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding/native-api/individual-kyc-requirements/il
- Israel business KYB requirements:
  - https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding/native-api/business-kyc-requirements/il
- Connected account onboarding options:
  - https://www.airwallex.com/docs/payments-for-platforms/onboard-connected-accounts/kyc-and-onboarding

## Practical migration decision

Do not delete Didit yet.

Delete Rapyd first.

Only remove Didit after these are true:

1. Instructor connected-account onboarding in Airwallex is fully implemented.
2. Studio owner or studio business onboarding requirements are mapped to Airwallex native onboarding.
3. Compliance read models no longer depend on `didit*` fields.
4. The compliance screens no longer launch `startDiditNativeVerification`.
5. The Didit webhook route and backend module are unused.

## Recommended next phase

1. Finish deleting Rapyd runtime and legacy payment internals.
2. Build Airwallex onboarding requirements sync into compliance read models.
3. Replace Didit-driven compliance UI with Airwallex account requirement UI.
4. Remove Didit SDK, env vars, webhook route, and backend after cutover.
