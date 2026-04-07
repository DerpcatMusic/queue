# Airwallex From-Scratch Migration Plan

Date: 2026-04-07
Owner: Payments platform refactor
Status: Proposed

## Goal

Replace Rapyd completely.

Build a provider-agnostic payments core in Convex, but ship only one provider implementation in this migration: Airwallex.

Target business model:

- Studio defines the instructor payout amount for the lesson
- Studio may add a time-pressure bonus to increase instructor payout
- Platform service fee is `12 ILS` normally
- Platform service fee is `15 ILS` when a bonus is applied
- Instructor receives the full offered payout amount, including any bonus
- Studio total charge is `offered payout + platform service fee`
- Platform gross revenue before processor fees is the platform service fee
- Airwallex processing fees are absorbed by the platform
- Platform owns the payment
- Funds are split to the instructor using Airwallex FundsSplit
- The instructor share must not be routed through the platform as an operational payout balance
- The instructor share must settle directly to the instructor connected account via FundsSplit
- Instructor payout to bank happens through Airwallex connected-account flows, not Rapyd beneficiaries

## Non-goals

- No Rapyd fallback
- No dual-provider routing
- No temporary bridge where new payments can still start on Rapyd
- No web-hosted checkout unless native Airwallex mobile SDK is blocked by a hard platform constraint

## Current state summary

The current repo has a provider abstraction, but the runtime is Rapyd-bound:

- checkout creation is Rapyd-specific
- payout onboarding is Rapyd-specific
- payout execution is Rapyd-specific
- webhook ingestion is Rapyd-specific
- Expo deep links and hosted auth flows are Rapyd-specific
- tests and readiness checks are Rapyd-specific

There is partial Airwallex scaffolding in `convex/integrations/airwallex`, but it is not wired into production flows and does not implement FundsSplit or connected-account onboarding.

## Recommended Airwallex model

Use Airwallex Payments for Platforms with platform-owned payments.

Why:

- your platform interacts with the payer
- you want the instructor to receive a fixed amount
- you want the platform to bear fees, refunds, and disputes
- this matches Airwallex's "collect payments directly" model

Recommended money flow:

1. Compute the instructor offered amount
2. Compute the platform service fee:
   - `12 ILS` when no bonus is present
   - `15 ILS` when any bonus is present
3. Create `PaymentIntent` for `offered payout + platform service fee`
4. Capture payment through Airwallex mobile SDK
5. Create or attach `FundsSplit` for the full instructor offered amount to the instructor connected account
6. The instructor share settles to the instructor connected account and must not become a manual platform payout liability
7. Keep the service fee as platform gross revenue
8. Record actual Airwallex fees as platform expense on the platform side only
9. Release split automatically or manually based on payout policy
10. Payout from instructor connected account to their bank account if needed

Important:

- Connected accounts are required for Payments for Platforms
- the instructor account receiving split funds must satisfy the required KYC state
- KYB is only needed when the connected account is a business and/or needs payment acceptance capability
- for your use case, instructors should not be merchant-of-record
- this is not a “platform collects then later pays instructor from platform cash” model
- this is a direct split-to-connected-account model before final settlement

## Israel constraints

This plan assumes Israeli-market support is current and verified, not speculative.

Verified references:

- `22 July 2025`: Airwallex announced it had secured a Payment Service License in Israel.
- `9 March 2026`: Airwallex release notes stated that merchants with Israeli legal entities can accept Visa, Mastercard, Apple Pay, and Google Pay.

Implementation consequence:

- treat Israel as supported for your target rollout
- still validate your exact account entitlements for Payments for Platforms, Connected Accounts, and FundsSplit during implementation kickoff
- do not assume every globally documented Airwallex feature is automatically enabled for your Israeli entity without account configuration

## Product and UX direction

### Studio payment UX

Use Airwallex React Native SDK inside the Expo app.

Target:

- native in-app checkout
- no external browser redirect for standard card checkout
- 3DS handled by the SDK
- no Rapyd return context
- no Rapyd bridge URLs

Expo implications:

- this requires native modules
- use Expo prebuild + development build / EAS build
- do not depend on Expo Go for payments

### Instructor payout UX

Do not reuse the Rapyd hosted beneficiary model.

Build a new instructor payout onboarding flow backed by Airwallex connected accounts:

- identity status
- payout account status
- payout preference
- payout history

Keep the UI native and reactive:

- status from Convex queries
- actions through Convex mutations/actions
- no provider browser flow unless Airwallex mandates one specific onboarding step

## Target architecture

### 1. Canonical payment domain

Create a provider-neutral payments core in Convex:

- `payment_orders`
- `payment_attempts`
- `payment_provider_links`
- `payment_events`
- `fund_splits`
- `connected_accounts`
- `connected_account_requirements`
- `payout_instructions`
- `payout_events`
- `ledger_entries`

Provider-specific fields should live in provider link tables or typed metadata, not in the main business records.

### 2. Provider adapter boundary

Define one stable interface in Convex:

- `createCheckoutSession`
- `confirmOrCapturePayment`
- `retrievePayment`
- `refundPayment`
- `createConnectedAccount`
- `syncConnectedAccount`
- `createFundsSplit`
- `releaseFundsSplit`
- `createExternalTransfer`
- `verifyWebhook`
- `mapWebhookToCanonicalEvent`

The interface should describe business capabilities, not provider nouns.

Bad:

- `createRapydBeneficiary`

Good:

- `ensureRecipientPayoutDestination`

### 3. Airwallex implementation

Implement the adapter under:

- `convex/integrations/airwallex/`

Recommended modules:

- `auth.ts`
- `client.ts`
- `payments.ts`
- `fundsSplit.ts`
- `accounts.ts`
- `payouts.ts`
- `webhooks.ts`
- `mappers.ts`
- `types.ts`
- `config.ts`

### 4. App integration boundary

Frontend should call app-domain APIs only:

- `api.payments.startCheckout`
- `api.payments.syncPaymentStatus`
- `api.payments.getStudioPaymentSummary`
- `api.payments.getInstructorPayoutSummary`
- `api.payments.startInstructorOnboarding`
- `api.payments.submitPayoutRequest`

Frontend must not call provider-named actions like `api.rapyd.*`.

## Security requirements

### Secrets

- Airwallex keys only on server
- never in Expo public env
- separate sandbox and production credentials
- rotate webhook secrets and API keys on schedule
- document ownership and rotation procedure

### Authentication and authorization

- every mutation/action must derive actor from Convex auth, never trust client-submitted user IDs
- validate studio owns the job before creating payment
- validate instructor owns the payout account before updating payout preferences
- validate payout actions against ledger balance, not client amounts

### Idempotency

Every external side effect must use deterministic idempotency keys:

- payment intent create
- capture
- refund
- connected account create/update
- funds split create
- funds split release
- payout/transfer create

Persist outbound idempotency keys and provider object IDs.

### Webhooks

- strict signature verification
- reject unsigned events
- store raw payload hash
- dedupe by provider event ID
- ingest first, process asynchronously
- canonical event mapping must be pure and testable
- no direct state mutation from raw webhook parser

### Replay and race protection

- terminal payment states must be monotonic
- payout and split release operations must be compare-and-swap guarded
- duplicate captures, duplicate releases, and duplicate refunds must be harmless

### Input validation

- explicit validators on all money, currency, country, account IDs, timestamps
- use integer minor units in app domain
- convert to Airwallex major/minor format only at adapter edge

### Auditability

Persist:

- who initiated action
- request ID / idempotency key
- provider object IDs
- canonical event type
- raw provider status
- normalized status
- before/after business state

## Financial model

Canonical order amounts:

- `base_lesson_amount_agorot`
- `bonus_amount_agorot`
- `instructor_offer_amount_agorot = base_lesson_amount_agorot + bonus_amount_agorot`
- `platform_service_fee_agorot = bonus_amount_agorot > 0 ? 1500 : 1200`
- `studio_charge_amount_agorot = instructor_offer_amount_agorot + platform_service_fee_agorot`
- `processor_fee_agorot = actual from settlement/reporting`
- `platform_net_agorot = platform_service_fee_agorot - processor_fee_agorot`

Ledger buckets:

- `provider_clearing`
- `platform_gross_revenue`
- `platform_fee_expense`
- `platform_net_revenue`
- `instructor_split_pending`
- `instructor_split_released`
- `instructor_payout_pending`
- `instructor_paid_out`
- `refund_reserve`
- `adjustments`

Key rule:

Instructor amount is contractual and fixed per accepted offer.

Processor fees must never reduce instructor gross for this use case.

Operational rule:

The instructor amount must be represented as a split allocation to the instructor connected account, not as platform cash temporarily held for later manual disbursement.

## Migration strategy

Use a hard-cut rebuild, not an in-place conversion.

### Phase 0: Freeze and prep

- stop adding features to Rapyd code
- mark all `api.rapyd.*` flows deprecated
- document current data model and export a migration inventory
- add feature flag `PAYMENTS_PROVIDER=airwallex`

### Phase 1: Build new core beside old code

- create provider-neutral schema additions
- add canonical payment service layer
- add Airwallex auth/client with token management
- add Airwallex webhook router
- add ledger v2 entries for platform fee expense

Do not route production traffic yet.

### Phase 2: Connected accounts and payout domain

- implement connected-account creation and sync
- model instructor onboarding requirements from Airwallex account status
- implement payout destination status from connected-account state
- remove Rapyd beneficiary session concept from new flows

### Phase 3: Native checkout

- integrate Airwallex React Native SDK
- create `startCheckout` API that creates `PaymentIntent`
- hand `client_secret` and checkout metadata to mobile SDK
- sync final payment state from webhook first, client poll second

Preferred path:

- SDK-native checkout pages
- server-created PaymentIntent
- no provider browser redirect for standard checkout

### Phase 4: FundsSplit

- on payment success, create split for `120 ILS`
- choose one of:
  - inline `funds_split_data` during capture
  - explicit create/release split after `payment_intent.succeeded`

Recommendation:

- use explicit split creation after success for clearer auditability and easier retries
- use manual release if payout policy needs operational control

### Phase 5: Refunds and dispute handling

- map refunds to split reversal policy
- define who bears refund loss
- define how already-released instructor funds are handled
- add operator tooling for negative-balance reconciliation

Important open business decision:

If a studio payment is refunded after instructor funds were released, do you claw back from instructor future earnings, or absorb the loss at platform level?

### Phase 6: Cutover

- disable new Rapyd checkout entry points
- disable Rapyd onboarding entry points
- migrate UI routes to provider-neutral names
- remove Rapyd env vars from active environments
- rotate secrets after cutover

### Phase 7: Deletion

Delete:

- `convex/rapyd.ts`
- `convex/rapydReturnBridge.ts`
- Rapyd webhook route
- Rapyd return context
- Rapyd hosted flow helpers
- Rapyd tests and docs
- Rapyd env vars and app links

## Schema changes

### Keep

- business entities like jobs, studios, instructors

### Replace or add

- replace provider-specific payout destination assumptions with `connectedAccounts`
- add `fundSplits`
- add `providerAccounts`
- add `providerRequirements`
- add `settlementFeeEntries`

### Data migration

Do not mutate historical Rapyd records into fake Airwallex records.

Instead:

- keep old records read-only as historical data
- mark legacy provider on old payments
- route all new payments through v2 tables

This avoids corrupting audit trails.

## Testing strategy

### Unit tests

- status mappers
- money conversion
- idempotency key generation
- webhook signature verification
- monotonic state transitions

### Contract tests

- Airwallex client request/response mapping
- connected-account sync
- funds split creation/release
- refund flows

### Integration tests

- studio pays lesson
- payment succeeds
- split created
- instructor balance updates
- payout request triggers transfer
- refund before split release
- refund after split release
- duplicated webhook delivery
- out-of-order webhook delivery

### Security tests

- forged webhook signature
- replayed webhook
- user attempts payout for another user
- duplicate client submission
- stale client tries to release already released split

### Mobile tests

- iOS dev build
- Android dev build
- 3DS challenge flow
- app background/resume during checkout
- offline recovery after payment attempt

## Operational requirements

### Observability

Track:

- payment intent create success rate
- payment capture success rate
- split creation success rate
- split release latency
- payout success rate
- webhook lag
- reconciliation drift

### Reconciliation

Build a daily reconciliation job that compares:

- local canonical payments
- Airwallex payment intents
- Airwallex funds splits
- Airwallex transfers/payouts
- internal ledger balances

Any mismatch should open an internal operations alert.

### Runbooks

Write runbooks for:

- payment stuck in pending
- split not released
- payout failed
- webhook outage
- refund after payout
- duplicate capture attempt

## Concrete implementation order

1. Add v2 schema and canonical service interfaces
2. Implement Airwallex auth, token caching, and HTTP client
3. Implement Airwallex webhook ingestion and canonical event processing
4. Implement connected-account onboarding and instructor payout status sync
5. Implement mobile checkout with Airwallex React Native SDK
6. Implement payment success to FundsSplit flow
7. Implement payout/transfer flow from connected account to external bank
8. Implement refunds, reversals, and reconciliation jobs
9. Switch UI to new provider-neutral APIs
10. Delete Rapyd code and config

## Codebase changes expected

### New

- `convex/paymentsCore.ts`
- `convex/paymentsAdapter.ts`
- `convex/integrations/airwallex/accounts.ts`
- `convex/integrations/airwallex/fundsSplit.ts`
- `convex/integrations/airwallex/payments.ts`
- `convex/integrations/airwallex/payouts.ts`
- `convex/integrations/airwallex/webhooks.ts`
- `src/lib/payments/airwallex-native.ts`
- `src/features/payments/`

### Remove

- `convex/rapyd.ts`
- `convex/rapydReturnBridge.ts`
- `convex/integrations/rapyd/`
- `src/contexts/rapyd-return-context.tsx`
- `src/lib/rapyd-hosted-flow.ts`
- `src/app/rapyd/`

### Refactor

- `convex/payments.ts`
- `convex/payouts.ts`
- `convex/paymentsRead.ts`
- `convex/http.ts`
- `src/components/jobs/studio/use-studio-feed-controller.ts`
- `src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx`

## Risks

### High

- Airwallex connected-account onboarding may require a different instructor identity model than current Didit-only flow
- refunds after released splits need explicit policy and ledger treatment
- Expo native SDK integration requires development builds and native config

### Medium

- read models may temporarily diverge during migration if old and new tables coexist
- settlement fee visibility may depend on the exact Airwallex reporting data exposed to your account

### Low

- deleting Rapyd deep links and routes is straightforward once traffic is cut over

## Decisions needed before implementation

1. Are instructors onboarded as individuals only, or can studios also receive split funds as recipients?
2. Do you want automatic split release immediately on successful payment, or delayed/manual release?
3. If refund happens after instructor payout, who eats the loss: platform or instructor future balance?
4. Do instructors need same-name payout only, or payouts to third-party business accounts too?
5. Is Expo development-build adoption acceptable for all environments starting this migration?

## Recommendation

Proceed with a greenfield v2 payments domain and a hard Rapyd deletion path.

Do not spend effort abstracting Rapyd behind a nicer interface.

Build the provider-agnostic core now, but keep only one concrete provider in the tree: Airwallex.

That gives you:

- clean security boundaries
- lower migration risk
- native mobile checkout
- better auditability
- simpler long-term maintenance

## Source references

- Airwallex mobile SDK overview: https://www.airwallex.com/docs/payments/online-payments/mobile-sdk
- Airwallex React Native SDK: https://www.airwallex.com/docs/developer-tools/sdks/mobile-sdks#react-native-sdk
- Airwallex Payments for Platforms gateway overview: https://www.airwallex.com/docs/payments-for-platforms/airwallex-gateway/airwallex-payment-gateway-overview
- Airwallex collect payments directly: https://www.airwallex.com/docs/payments-for-platforms/airwallex-gateway/process-payments-and-manage-funds/collect-payments-directly
- Airwallex process payments and manage funds: https://www.airwallex.com/docs/payments-for-platforms/airwallex-gateway/process-payments-and-manage-funds
- Airwallex FundsSplit create API: https://www.airwallex.com/docs/api/payments/funds_splits/create
- Airwallex FundsSplit release API: https://www.airwallex.com/docs/api/payments/funds_splits/release
- Airwallex connected accounts overview: https://www.airwallex.com/docs/connected-accounts/about/connected-accounts-and-embedded-finance
- Airwallex Israel license announcement: https://www.airwallex.com/newsroom/airwallex-secures-payment-service-license-in-israel-enabling-global-payment-solutions
- Airwallex March 2026 release notes: https://www.airwallex.com/blog/new-at-airwallex-march-edition-2026
