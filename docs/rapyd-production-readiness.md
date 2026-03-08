# Rapyd Production Readiness (Queue Expo 55 + Convex)

## What We Are Building
- Studios pay `lesson_pay + platform_processing_fee`.
- Instructors receive exactly `lesson_pay` via Rapyd payout destination.
- Platform keeps only the markup amount on captured payment.
- Every captured payment must produce an invoice record and external invoice document.

## Architecture (Implemented)
- Checkout: `convex/rapyd.ts:createCheckoutForJob`
- Payment ledger + webhook state transitions: `convex/payments.ts`
- Payout orchestration + retries: `convex/payouts.ts`
- Rapyd webhook endpoint: `convex/webhooks.ts` via `convex/http.ts`
- Invoicing orchestration: `convex/invoicing.ts`
- Invoice ledger: `convex/schema.ts` table `invoices`
- Hosted bank onboarding: `convex/rapyd.ts:createBeneficiaryOnboardingForInstructor`
- Beneficiary webhook processing -> verified payout destination:
  - `convex/webhooks.ts`
  - `convex/payments.ts:processRapydBeneficiaryWebhookEvent`

## Required Environment Variables

### Rapyd
- `RAPYD_MODE` (`sandbox` or `production`)
- `RAPYD_ACCESS_KEY`
- `RAPYD_SECRET_KEY`
- `RAPYD_WEBHOOK_SECRET` (recommended; falls back to `RAPYD_SECRET_KEY`)
- `RAPYD_COUNTRY` (default `IL`)
- `RAPYD_EWALLET` (required for payouts)
- `RAPYD_SANDBOX_BASE_URL` / `RAPYD_PROD_BASE_URL`
- `RAPYD_COMPLETE_CHECKOUT_URL`
- `RAPYD_CANCEL_CHECKOUT_URL`
- `RAPYD_PAYMENT_METHODS` (optional; country-valid values only)
- `RAPYD_WEBHOOK_MAX_SKEW_SECONDS` (default `300`)

### Payments/Payouts
- `PAYMENTS_CURRENCY` (default `ILS`)
- `QUICKFIT_PLATFORM_MARKUP_BPS` (default `1500`)
- `PAYOUT_RELEASE_MODE` (`manual` or `automatic`)
- `PAYOUT_MAX_ATTEMPTS`

### Invoicing (Israeli compliance)
- `INVOICE_PROVIDER` (`icount` or `morning`)
- If `icount`:
  - `ICOUNT_API_BASE_URL`
  - `ICOUNT_API_KEY`
- If `morning`:
  - `MORNING_API_BASE_URL`
  - `MORNING_API_TOKEN`
- `INVOICE_DEFAULT_VAT_RATE` (default `18`)

## Hard Truth Risks
- Rapyd webhook signature mismatch or clock skew will block payment capture progression.
- Missing/invalid invoice provider env will make invoice issuance fail.
- Israeli compliance details (document type, numbering, VAT handling, cancellation docs) must be finalized with CPA and encoded at provider payload level before go-live.
- Hosted onboarding event contracts can vary by account/program; verify your webhook payload fields in sandbox (`merchant_reference_id`, beneficiary ID, payout method type) and adjust parser if Rapyd account returns alternate field names.

## Go-Live Validation
- Complete one end-to-end sandbox run:
  - studio checkout -> webhook captured -> invoice issued -> payout paid.
- Verify that payout amount equals lesson pay for each payment.
- Verify that invoice amount equals studio charge (lesson pay + markup).
- Verify replay safety by re-sending same webhook event and checking no duplicate terminal transitions.
