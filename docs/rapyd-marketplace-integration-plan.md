# Rapyd Marketplace Integration Plan (Expo 55 + Convex)

## Scope
- Target stack: `Queue/` (Expo + Convex).
- Goal: studios pay for lessons, instructors receive bank payouts, platform takes a `15%` markup while keeping payment, payout, and tax records auditable.
- Constraint: keep Flutter backend contracts stable during migration.

## Current State (from repo audit)
- `Queue/convex/schema.ts` and `Queue/convex/jobs.ts` have job/applications lifecycle but no payment/payout tables.
- Legacy backend already has a production-grade flow:
  - checkout creation (`quickfit-flutter/backend/convex/rapyd.ts`)
  - payment ledger + webhook idempotency (`quickfit-flutter/backend/convex/payments.ts`)
  - payout orchestration with retries (`quickfit-flutter/backend/convex/payouts.ts`)
  - webhook endpoint and signature validation (`quickfit-flutter/backend/convex/webhooks.ts`)

## Two Viable Architectures

### Option A (Recommended): Migrate legacy payment domain into `Queue/convex`
- Reuse legacy table design (`payments`, `paymentEvents`, `payouts`, `payoutEvents`, `payoutDestinations`, `invoices`).
- Port Rapyd actions and webhook handlers with minimal changes.
- Wire `jobs` lifecycle to payment triggers.

Pros
- Fastest path, lowest risk, follows DRY by reusing battle-tested logic.
- Strong idempotency/retry model already exists.
- Clear audit trail for disputes and accounting.

Cons
- More initial schema growth in `Queue`.

### Option B: Thin `Queue` ledger + external payment microservice
- Keep minimal payment state in Convex.
- Move Rapyd orchestration/webhooks to separate server.

Pros
- Smaller Convex surface.
- Isolation from app domain.

Cons
- More infra complexity.
- Higher operational burden now (YAGNI risk).

## Recommended Money Model (15% markup, instructor gets full base amount)

Use three amounts per transaction:
- `instructorBaseAmount` (what instructor must receive): example `120.00 ILS`
- `platformMarkupAmount = instructorBaseAmount * 0.15`: example `18.00 ILS`
- `studioChargeAmount = instructorBaseAmount + platformMarkupAmount`: example `138.00 ILS`

Then:
- Charge studio: `138.00`
- Payout instructor: `120.00`
- Platform gross margin before processor fees/tax: `18.00`

Important pricing decision:
- Either treat `18.00` as VAT-exclusive service fee, or VAT-inclusive.
- This must be finalized with Israeli CPA/tax advisor before go-live and encoded in invoice logic.

## Rapyd Integration Blueprint

## Server Placement Options (Expo docs-aligned)

### Option 1 (Recommended): Convex actions + Convex HTTP webhooks
- Keep all Rapyd secrets in Convex env and run signed requests from server actions.
- Keep webhook processing in Convex HTTP route for direct state transitions.

### Option 2: Expo Router API Routes (`+api.ts`) + Convex as data store
- Use Expo API Routes as a server layer for Rapyd calls/webhooks.
- Persist all state in Convex tables.

Tradeoff
- Option 1 is simpler in this codebase because `Queue` already uses Convex auth/data primitives.
- Option 2 is valid when you specifically need Expo server runtime features or co-located web APIs.

## 1) Checkout (studio pay-in)
- Create hosted checkout page from server-side code only.
- In Expo client, open hosted URL via `expo-web-browser`.
- Never expose Rapyd secret key in app code.
- Store provider references on payment row (`providerCheckoutId`, `providerPaymentId`).

## 2) Webhooks (source of truth)
- Add Rapyd webhook HTTP route in `Queue/convex/http.ts`.
- Verify signature and timestamp, persist raw event hash, enforce idempotency by provider event ID.
- Drive payment status transitions from webhook outcomes.

## 3) Instructor payout onboarding (bank info)
- Prefer Rapyd hosted beneficiary tokenization page.
- Save only non-sensitive references (beneficiary ID, payout method type, last4, country/currency).
- On payout run, use stored beneficiary reference and selected payout method.

## 4) Payout execution
- Trigger payout only when payment is captured and lesson is in payout-eligible state.
- Use retry/backoff for transient failures.
- Keep terminal states monotonic (`paid`, `failed`, `cancelled`, `needs_attention`).

## 5) Marketplace capability validation before production
- Programmatically confirm available methods for your account in IL:
  - payment methods by country/currency
  - payout method types by beneficiary country/entity
  - payout required fields for chosen method
- Do this in production mode as sandbox can expose methods not enabled for your live account.

## `Queue/` Implementation Steps (file-level)

1. Schema and indexes
- Extend `Queue/convex/schema.ts` with:
  - `payments`
  - `paymentEvents`
  - `payouts`
  - `payoutEvents`
  - `payoutDestinations`
  - `invoices`
- Mirror index strategy from legacy to keep hot queries index-driven.

2. New Convex modules
- Add files:
  - `Queue/convex/payments.ts`
  - `Queue/convex/payouts.ts`
  - `Queue/convex/rapyd.ts`
  - `Queue/convex/webhooks.ts`
  - `Queue/convex/invoicing.ts` (or merge minimal invoice logic first pass)

3. HTTP wiring
- Update `Queue/convex/http.ts` to register `/webhooks/rapyd`.

4. Job lifecycle hooks
- `Queue/convex/jobs.ts`:
  - on accepted booking: prepare payable state and idempotency keys
  - on completion or payout-eligible transition: trigger capture/payout scheduling logic

5. App screens
- Studio flow: checkout start + payment status.
- Instructor flow: payout destination setup + payout status timeline.

6. Environments and secrets
- Add server env vars:
  - `RAPYD_ACCESS_KEY`
  - `RAPYD_SECRET_KEY`
  - `RAPYD_WEBHOOK_SECRET`
  - `RAPYD_MODE`
  - `RAPYD_COUNTRY`
  - `RAPYD_EWALLET`
  - `RAPYD_MERCHANT_ID` (if used)
  - `QUICKFIT_PLATFORM_FEE_BPS=1500`

## Israel Tax and Compliance Considerations (Implementation-impacting)

Not legal or tax advice. This is a build checklist to finalize with Israeli CPA + legal counsel.

1. VAT
- Current standard VAT is reported as `18%` from 2025.
- Decide whether platform markup is VAT-inclusive or VAT-exclusive.
- Invoices and ledger must store VAT basis explicitly.

2. Withholding at source
- Payment operators in Israel commonly need to validate withholding certificates for payees.
- Build admin flow to store instructor withholding status/certificate metadata and effective rates from official confirmations.

3. Israel e-invoicing allocation numbers
- For B2B tax invoices above threshold, allocation number rules apply and thresholds tighten in 2026.
- If studio invoices are in scope, integrate invoice issuance flow with allocation-number compliance.

4. Social insurance context
- Instructor classification (employee vs self-employed contractor) changes obligations materially.
- Product should force explicit classification path and store supporting tax profile fields.

## Rollout Plan

Phase 1
- Port schema + core payment/payout modules from legacy backend.
- Sandbox end-to-end: checkout -> webhook -> payout queued.

Phase 2
- Instructor payout destination onboarding via hosted beneficiary flow.
- Retry, alerting, and admin reconciliation screens.

Phase 3
- Invoicing + VAT/withholding controls finalized with CPA/legal.
- Production pilot with limited studios.

Phase 4
- Full rollout + dashboarding of failures, webhook lag, payout aging.

## Validation Checklist
- Unit tests for amount math and state transitions.
- Idempotency tests for duplicate checkout requests and duplicate webhooks.
- Signature verification tests for valid and invalid Rapyd webhooks.
- Payout retry tests (429/5xx vs permanent failures).
- Reconciliation test: sum(studio charges) = sum(instructor payouts) + sum(platform fees) +/- processor costs.

## External References Used
- Expo API Routes: https://docs.expo.dev/router/web/api-routes/
- Expo WebBrowser: https://docs.expo.dev/versions/latest/sdk/webbrowser/
- Expo Constants (Expo Go/runtime checks): https://docs.expo.dev/versions/latest/sdk/constants/
- Rapyd Checkout Page: https://docs.rapyd.net/en/checkout-page.html
- Rapyd Payout overview: https://docs.rapyd.net/en/payout.html
- Rapyd List Payout Method Types: https://docs.rapyd.net/es/-en--list-payout-method-types.html
- Rapyd Beneficiary Tokenization: https://docs.rapyd.net/es/-en--create-beneficiary-tokenization-page.html
- Rapyd Webhook Authentication: https://docs.rapyd.net/en/webhook-authentication.html
- Rapyd Header Parameters: https://docs.rapyd.net/en/header-parameters.html
- Rapyd Idempotency: https://docs.rapyd.net/en/idempotency.html
- Rapyd production vs sandbox method visibility: https://docs.rapyd.net/en/viewing-payment-methods.html
- Rapyd payout methods visibility: https://docs.rapyd.net/en/viewing-payout-methods.html
- Rapyd supported countries (includes Israel): https://docs.rapyd.net/en/global.html
- Israel Tax Authority withholding certificate service: https://www.gov.il/en/service/itc-gmishurim
- Israel Tax Authority allocation number service (2025/2026 thresholds): https://www.gov.il/en/service/request-assignment-number-for-tax-invoice
- PwC Israel tax summary (VAT reference): https://taxsummaries.pwc.com/israel

## Why this follows KISS / YAGNI / SOLID / DRY
- KISS: start from existing proven domain model.
- YAGNI: defer multi-provider abstraction changes until Rapyd launch is stable.
- SOLID: keep jobs lifecycle and payments orchestration in separate modules.
- DRY: port existing payment/payout primitives instead of rewriting parallel logic.
