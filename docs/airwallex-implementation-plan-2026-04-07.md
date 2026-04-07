# Airwallex Implementation Plan

Date: 2026-04-07
Depends on: `docs/airwallex-from-scratch-migration-plan-2026-04-07.md`
Status: Ready for execution

## Scope

Build a provider-agnostic payments core in Convex.

Ship only Airwallex.

Delete Rapyd entirely after cutover.

This plan includes the updated pricing model:

- studio defines instructor payout amount
- studio can add a bonus
- platform fee is `12 ILS` without bonus
- platform fee is `15 ILS` with bonus
- instructor receives full offered amount
- platform absorbs processor fees
- instructor funds must not be routed through platform payout cashflow

## Core design decisions

### Business truth

The canonical business record is the accepted commercial offer, not the provider payment object.

Every payment must preserve these fields:

- `baseLessonAmountAgorot`
- `bonusAmountAgorot`
- `instructorOfferAmountAgorot`
- `platformServiceFeeAgorot`
- `studioChargeAmountAgorot`
- `pricingRuleVersion`

The payment domain must also preserve settlement intent:

- instructor share is allocated by FundsSplit
- instructor share settles to the instructor connected account
- platform retains only the service-fee side minus processor fees

### Convex boundaries

Use Convex the way it is meant to be used:

- `query`: read-only projections
- `mutation`: state transitions and local writes
- `action`: outbound provider calls
- `internalMutation` / `internalAction`: orchestration only
- scheduler: retries, webhook processing, reconciliation

### Provider boundary

The adapter API must speak in platform terms:

- offer
- charge
- capture
- split
- release
- transfer
- connected account
- requirement

Do not leak provider nouns into app-facing APIs.

## Reuse vs replace

### Reuse as-is

- `integrationEvents` ingestion pattern: [convex/schema.ts#L906](/home/derpcat/projects/queue/convex/schema.ts#L906)
- `webhookDeliveries` pattern: [convex/schema.ts#L1177](/home/derpcat/projects/queue/convex/schema.ts#L1177)
- rate-limit and invalid-signature throttles: [convex/schema.ts#L939](/home/derpcat/projects/queue/convex/schema.ts#L939), [convex/schema.ts#L952](/home/derpcat/projects/queue/convex/schema.ts#L952)
- the general ledger idea, but not the exact table shape: [convex/schema.ts#L1066](/home/derpcat/projects/queue/convex/schema.ts#L1066)

### Keep as legacy read-only

- `paymentOrders`: [convex/schema.ts#L1008](/home/derpcat/projects/queue/convex/schema.ts#L1008)
- `paymentProviderLinks`: [convex/schema.ts#L1047](/home/derpcat/projects/queue/convex/schema.ts#L1047)
- `payouts`: [convex/schema.ts#L737](/home/derpcat/projects/queue/convex/schema.ts#L737)
- `payoutDestinations`: [convex/schema.ts#L820](/home/derpcat/projects/queue/convex/schema.ts#L820)
- Rapyd onboarding/event tables: [convex/schema.ts#L860](/home/derpcat/projects/queue/convex/schema.ts#L860)

### Replace with v2

- payment order domain
- provider links
- payout destination model
- payout scheduling model
- ledger buckets and entry types
- provider method cache

## v2 schema

### `paymentOffersV2`

Purpose:

- immutable commercial offer accepted by studio before checkout

Fields:

- `jobId`
- `studioId`
- `studioUserId`
- `instructorId`
- `instructorUserId`
- `currency`
- `baseLessonAmountAgorot`
- `bonusAmountAgorot`
- `instructorOfferAmountAgorot`
- `platformServiceFeeAgorot`
- `studioChargeAmountAgorot`
- `pricingRuleVersion`
- `bonusReason`
- `bonusAppliedByUserId`
- `expiresAt`
- `status`: `draft | ready | superseded | paid | cancelled`
- `createdAt`
- `updatedAt`

Indexes:

- by job
- by studio user
- by instructor user
- by status

### `paymentOrdersV2`

Purpose:

- canonical payment lifecycle record

Fields:

- `offerId`
- `jobId`
- `studioId`
- `studioUserId`
- `instructorId`
- `instructorUserId`
- `provider`: `airwallex`
- `status`: `draft | requires_payment_method | processing | succeeded | partially_refunded | refunded | failed | cancelled`
- `currency`
- `studioChargeAmountAgorot`
- `instructorOfferAmountAgorot`
- `platformServiceFeeAgorot`
- `capturedAmountAgorot`
- `refundedAmountAgorot`
- `correlationKey`
- `createdAt`
- `updatedAt`
- `succeededAt`
- `cancelledAt`

Indexes:

- by offer
- by job
- by studio user
- by instructor user
- by status
- by correlation key

### `paymentAttemptsV2`

Purpose:

- one provider-level payment-intent or attempt record per try

Fields:

- `paymentOrderId`
- `provider`: `airwallex`
- `providerPaymentIntentId`
- `providerAttemptId`
- `clientSecretRef`
- `status`
- `statusRaw`
- `requestId`
- `idempotencyKey`
- `lastError`
- `createdAt`
- `updatedAt`

Indexes:

- by payment order
- by provider payment intent
- by idempotency

### `providerObjectsV2`

Purpose:

- generic link table for provider object IDs

Fields:

- `provider`
- `entityType`: `payment_order | payment_attempt | connected_account | fund_split | payout_transfer`
- `entityId`
- `providerObjectType`
- `providerObjectId`
- `createdAt`

Indexes:

- by provider object
- by entity

### `connectedAccountsV2`

Purpose:

- instructor recipient account in Airwallex
- recipient of split funds without routing the instructor share through platform payout balance

Fields:

- `userId`
- `role`: `instructor`
- `provider`: `airwallex`
- `providerAccountId`
- `accountCapability`: `ledger | withdrawal | full`
- `status`: `pending | action_required | active | restricted | rejected | disabled`
- `kycStatus`
- `kybStatus`
- `serviceAgreementType`
- `country`
- `currency`
- `defaultPayoutMethod`
- `createdAt`
- `updatedAt`
- `activatedAt`

Indexes:

- by user
- by provider account
- by status

### `connectedAccountRequirementsV2`

Purpose:

- normalized provider requirements for onboarding UI

Fields:

- `connectedAccountId`
- `providerRequirementId`
- `kind`
- `code`
- `message`
- `blocking`
- `resolvedAt`
- `createdAt`
- `updatedAt`

Indexes:

- by connected account
- by unresolved blocking

### `fundSplitsV2`

Purpose:

- split the full instructor offer amount from platform-owned payment to instructor connected account
- make the instructor share settle directly to the connected account before final settlement

Fields:

- `paymentOrderId`
- `paymentAttemptId`
- `connectedAccountId`
- `provider`: `airwallex`
- `providerFundsSplitId`
- `sourcePaymentIntentId`
- `destinationAccountId`
- `amountAgorot`
- `currency`
- `autoRelease`
- `releaseMode`: `automatic | manual | scheduled`
- `status`: `pending_create | created | released | settled | failed | reversed`
- `requestId`
- `idempotencyKey`
- `createdAt`
- `updatedAt`
- `releasedAt`
- `settledAt`
- `failureReason`

Indexes:

- by payment order
- by connected account
- by provider split ID
- by status

### `payoutTransfersV2`

Purpose:

- transfer funds from recipient account to external bank account when applicable

Fields:

- `connectedAccountId`
- `fundSplitId`
- `provider`: `airwallex`
- `providerTransferId`
- `amountAgorot`
- `currency`
- `status`
- `statusRaw`
- `requestId`
- `idempotencyKey`
- `failureReason`
- `createdAt`
- `updatedAt`
- `paidAt`

Indexes:

- by connected account
- by split
- by provider transfer ID
- by status

### `payoutPreferencesV2`

Purpose:

- instructor payout timing preferences, separate from provider-specific destination models

Fields:

- `userId`
- `mode`: `immediate_when_eligible | scheduled_date | manual_hold`
- `scheduledDate`
- `autoPayoutEnabled`
- `createdAt`
- `updatedAt`

Indexes:

- by user

### `ledgerEntriesV2`

Purpose:

- provider-neutral financial truth

Fields:

- `paymentOrderId`
- `paymentAttemptId`
- `fundSplitId`
- `payoutTransferId`
- `jobId`
- `studioUserId`
- `instructorUserId`
- `entryType`
- `bucket`
- `amountAgorot`
- `currency`
- `dedupeKey`
- `referenceType`
- `referenceId`
- `createdAt`

Required entry types:

- `studio_charge`
- `platform_gross_revenue`
- `processor_fee_expense`
- `instructor_offer_reserved`
- `fund_split_created`
- `fund_split_released`
- `payout_transfer_sent`
- `refund_gross`
- `refund_platform_reversal`
- `refund_instructor_reversal`
- `adjustment`

Required buckets:

- `provider_clearing`
- `platform_gross_revenue`
- `platform_fee_expense`
- `platform_net_revenue`
- `instructor_split_pending`
- `instructor_split_available`
- `instructor_payout_in_flight`
- `instructor_paid_out`
- `refund_reserve`
- `adjustments`

### `pricingRulesV2`

Purpose:

- versioned pricing policy

Fields:

- `code`
- `country`
- `currency`
- `basePlatformFeeAgorot`
- `bonusPlatformFeeAgorot`
- `bonusTriggerMode`
- `active`
- `version`
- `createdAt`
- `updatedAt`

Use:

- fee = `bonusPlatformFeeAgorot` when `bonusAmountAgorot > 0`
- otherwise fee = `basePlatformFeeAgorot`

## Service modules

### New Convex modules

- `convex/paymentsCoreV2.ts`
- `convex/paymentsPricingV2.ts`
- `convex/paymentsReadV2.ts`
- `convex/payoutsV2.ts`
- `convex/webhooksAirwallex.ts`
- `convex/reconciliationV2.ts`
- `convex/integrations/airwallex/auth.ts`
- `convex/integrations/airwallex/client.ts`
- `convex/integrations/airwallex/accounts.ts`
- `convex/integrations/airwallex/payments.ts`
- `convex/integrations/airwallex/fundsSplit.ts`
- `convex/integrations/airwallex/payouts.ts`
- `convex/integrations/airwallex/webhooks.ts`
- `convex/integrations/providerAdapter.ts`

### Frontend modules

- `src/features/payments/start-checkout.ts`
- `src/features/payments/use-airwallex-checkout.ts`
- `src/features/payments/use-instructor-connected-account.ts`
- `src/features/payments/use-payout-preferences.ts`
- `src/features/payments/screens/instructor-payouts-screen.tsx`
- `src/features/payments/screens/studio-pay-screen.tsx`
- `src/lib/payments/airwallex-native.ts`

## Airwallex implementation notes

### Checkout path

1. Convex action creates `PaymentIntent`
2. Convex mutation creates `paymentOrderV2` and `paymentAttemptV2`
3. App receives client secret
4. App launches Airwallex React Native SDK
5. Webhook marks payment success
6. Convex action creates `FundsSplit`

### Funds split path

Recommended rule:

- always split full `instructorOfferAmountAgorot`
- never split platform fee
- processor fee never affects split amount
- do not model the instructor share as a platform payable
- the split is the primary instructor money movement; payout transfer is only the later bank-withdrawal leg from the connected account

Bonus case example:

- base lesson payout `120 ILS`
- bonus `20 ILS`
- instructor offer `140 ILS`
- platform fee `15 ILS`
- studio charge `155 ILS`
- funds split `140 ILS`
- platform gross `15 ILS`
- net = `15 - actual processor fee`

### Connected account path

1. Create or sync Airwallex connected account for instructor
2. Show pending requirements from `connectedAccountRequirementsV2`
3. Block split release and payout transfer when account is not eligible
4. Keep Didit only if it remains useful as a pre-check, but Airwallex account state is the final payout eligibility source

### Israel rollout constraints

Use Israel as the primary market assumption.

Verified current references:

- `22 July 2025`: Airwallex announced its Israel Payment Service License.
- `9 March 2026`: Airwallex stated that Israeli legal entities can accept Visa, Mastercard, Apple Pay, and Google Pay.

Execution rule:

- implementation must be gated on the exact Airwallex features enabled for your Israeli entity
- kickoff checklist must explicitly confirm:
  - Payments for Platforms
  - Connected Accounts
  - FundsSplit
  - required payment methods for Israel
  - payout coverage for instructor withdrawal destinations

## Webhook design

### Router

Add Airwallex routes in `convex/http.ts`:

- `/webhooks/airwallex/payments`
- `/webhooks/airwallex/accounts`
- `/webhooks/airwallex/payouts`

### Processing

1. verify signature
2. record `webhookDeliveries`
3. record `integrationEvents`
4. async canonical processor
5. update v2 entities
6. emit ledger entries if state transition occurred

### Rules

- all state transitions must be monotonic
- event processors must be idempotent
- event ingestion must never directly depend on app client state

## Mobile build plan

### SDK path

Use Airwallex React Native SDK.

Implications:

- Expo prebuild required
- development builds required
- EAS build required in CI
- no Expo Go for payments

### App code touchpoints

Current Rapyd touchpoints to replace:

- [src/components/jobs/studio/use-studio-feed-controller.ts#L84](/home/derpcat/projects/queue/src/components/jobs/studio/use-studio-feed-controller.ts#L84)
- [src/components/jobs/studio/use-studio-feed-controller.ts#L475](/home/derpcat/projects/queue/src/components/jobs/studio/use-studio-feed-controller.ts#L475)
- [src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx#L184](/home/derpcat/projects/queue/src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx#L184)
- [src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx#L329](/home/derpcat/projects/queue/src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx#L329)

Delete after migration:

- `src/lib/rapyd-hosted-flow.ts`
- `src/contexts/rapyd-return-context.tsx`
- `src/app/rapyd/*`

## Work breakdown

### Workstream A: schema and pricing

Deliverables:

- v2 tables
- pricing rule engine
- bonus-aware fee calculation
- ledger v2 types

Acceptance:

- can compute `studioChargeAmountAgorot` deterministically from offer
- can represent bonus and no-bonus offers

### Workstream B: Airwallex adapter

Deliverables:

- auth and token caching
- payment intent create/retrieve/refund
- connected account create/sync
- funds split create/release
- payout transfer create/retrieve

Acceptance:

- no Rapyd imports in new path
- deterministic idempotency on all outbound requests

### Workstream C: webhook and reconciliation

Deliverables:

- Airwallex webhook routes
- canonical event processors
- daily reconciliation job
- operator error views

Acceptance:

- replay-safe processing
- daily drift report

### Workstream D: Expo native checkout

Deliverables:

- Airwallex RN SDK wrapper
- studio pay CTA wired to `paymentOrderV2`
- native 3DS flow
- payment result sync

Acceptance:

- no external browser for standard card checkout
- app survives background/resume during payment

### Workstream E: instructor payout experience

Deliverables:

- connected account status query
- requirements UI
- payout preferences UI
- payout history UI from v2 tables

Acceptance:

- user can see why payout is blocked
- user can request payout only when eligible

## Execution order

### Phase 1

- add v2 schema
- add pricing engine
- add provider-neutral adapter interface

### Phase 2

- implement Airwallex auth/client
- implement connected accounts
- implement webhook ingestion

### Phase 3

- implement payment order start flow
- integrate RN SDK in Expo dev build
- create payment attempt sync

### Phase 4

- implement FundsSplit create/release
- implement ledger v2 entries
- implement instructor payout transfer flow
- enforce direct split settlement to the instructor connected account
- reject any design that recreates “platform receives instructor share, then platform pays instructor later” behavior

### Phase 5

- implement refunds and reversals
- implement reconciliation jobs
- migrate read models

### Phase 6

- switch studio payment UI
- switch instructor payout UI
- disable new Rapyd traffic

### Phase 7

- remove Rapyd backend
- remove Rapyd frontend
- remove Rapyd config and docs

## Cutover checklist

- Airwallex sandbox end-to-end passes
- native iOS build passes
- native Android build passes
- webhook signatures verified
- payment success creates split
- split release updates ledger
- payout transfer updates ledger
- refund before release handled
- refund after release handled
- reconciliation report clean
- Rapyd routes disabled

## Risks to manage early

1. Connected-account onboarding requirements may force a different instructor identity flow than current Didit assumptions.
2. Refund-after-payout policy is still a business decision and blocks final ledger behavior.
3. Expo native SDK rollout changes local dev workflow immediately.
4. Current v1 and v2 payment reads can drift if not clearly separated.
5. Airwallex fee reporting shape must be validated early so `processor_fee_expense` is reliable.

## Recommended first implementation PRs

1. `schema-v2-pricing-core`
2. `airwallex-auth-client`
3. `airwallex-webhooks-ingestion`
4. `connected-accounts-v2`
5. `studio-native-checkout-v2`
6. `funds-split-v2`
7. `instructor-payouts-v2`
8. `refunds-reconciliation-v2`
9. `remove-rapyd-runtime`
