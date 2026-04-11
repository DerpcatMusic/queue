# European SEPA Marketplace Optimization

**Date:** 2026-04-11
**Status:** Draft
**Scope:** Stripe Connect payment flow optimization for European marketplace

## Problem

The app serves a European marketplace where studios pay instructors for lessons. The current Stripe integration has three cost issues:

1. **Connect account fees:** Accounts created with `fees_collector: "application"` fall under the "You handle pricing" model, incurring EUR 2/month per active instructor + EUR 0.10 + 0.25% per payout
2. **US-centric payment method ordering:** `us_bank_account` is listed first, not SEPA DD, even for EUR transactions
3. **Card-first pricing:** SEPA Direct Debit (EUR 0.35 flat) is not prioritized over cards (1.5% + EUR 0.25)

## Requirements

- Instructors receive **full lesson price, zero fees deducted** — no processing fees, no monthly fees, no payout fees
- Platform collects **EUR 4 flat fee** per transaction via `application_fee_amount`
- Studio/customer pays lesson price + EUR 4 platform fee (Stripe processing fee absorbed by platform from the EUR 4)
- SEPA Direct Debit as primary payment method for EUR transactions
- Keep external invoicing (iCount/Morning) — no Stripe Invoicing product (avoids 0.4% fee)
- Keep existing embedded onboarding (already optimal)

## Prerequisites (Blocking)

Before implementation, these must be verified:

**P1. Destination charge fee deduction behavior under "Stripe handles pricing"**

Create a test-mode account with `fees_collector: "stripe"`, then create a destination charge with `application_fee_amount`. Confirm the connected account receives exactly `amount - application_fee_amount` with no Stripe processing fee deducted from the transfer. The processing fee should appear on the platform account. If Stripe deducts fees from the connected account under this model, the "zero fees to instructor" guarantee breaks and we must keep `fees_collector: "application"`.

**P2. `fees_collector: "stripe"` + `losses_collector: "application"` API validity**

Test that the Accounts v2 API accepts this combination. If invalid, both must be `"stripe"`. Under destination charges, the platform effectively bears losses regardless (the charge is on the platform account), so `losses_collector: "stripe"` is acceptable as a fallback.

**P3. Existing account migration feasibility**

Test `PATCH /v2/core/accounts/{id}` to update `fees_collector` from `"application"` to `"stripe"` on an existing v2 account. If the API rejects it, quantify how many existing accounts exist and plan a migration window. The monthly savings calculation assumes all instructors are on the new model.

## Current Architecture

### Payment Flow (already implemented)

```
Studio pays --> PaymentIntent (destination charge)
                    |
                    +--> application_fee_amount: EUR 4 --> Platform
                    |
                    +--> transfer_data.destination --> Instructor (full lesson price)
```

- Uses Stripe Accounts v2 API (`/v2/core/accounts`)
- `dashboard: "none"` — no Stripe Dashboard for instructors
- `ConnectAccountOnboarding` + `ConnectPayouts` for native embedded UI
- `disable_stripe_user_authentication: true` for seamless in-app flow
- External invoicing via iCount/Morning
- `presentStripeNativeBankPayment` serves USD bank payments (USBankAccount) — unchanged by this spec

### Key Files

| File | Role |
|------|------|
| `convex/integrations/stripe/connectV2.ts` | Stripe Accounts v2 API client |
| `convex/paymentsPricingV2.ts` | Pricing rules (EUR 4 standard / EUR 5 bonus) |
| `src/features/payments/lib/stripe-native.ts` | Native payment sheet + SDK init |
| `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx` | Embedded checkout UI |
| `src/components/sheets/profile/instructor/stripe-connect-embedded.native.tsx` | Instructor onboarding + payouts |

## Changes

### Phase 1: Payment method ordering (safe, independent of prerequisites)

#### 1a. Currency-aware payment method ordering

**File:** `src/features/payments/lib/stripe-native.ts`

Replace the static `DEFAULT_PAYMENT_METHOD_ORDER` with a shared function.

**Current:** `["us_bank_account", "sepa_debit", "bacs_debit", "au_becs_debit", "bancontact", "ideal", "eps", "p24", "fpx", "card"]`

**New:**
```typescript
export function getPaymentMethodOrder(currency: string): string[] {
  const c = currency.toUpperCase();
  switch (c) {
    case "EUR":
      return ["sepa_debit", "card"];
    case "GBP":
      return ["bacs_debit", "card"];
    default:
      return ["card"];
  }
}
```

Update `presentStripeNativePaymentSheet` to call `getPaymentMethodOrder(input.currencyCode ?? "EUR")` instead of using `DEFAULT_PAYMENT_METHOD_ORDER`.

**File:** `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx`

Update `paymentMethodOrder` in `embeddedConfiguration` to import and call the shared `getPaymentMethodOrder(checkout.currency)`.

**Impact:**
- EUR transactions: SEPA DD first (EUR 0.35 flat) — saves ~EUR 0.65 per EUR 50 vs cards
- GBP transactions: BACS first (GBP 0.30 flat)
- Other currencies (ILS, USD): cards only
- ILS path unchanged — continues using card-only via the `default` case

### Phase 2: "Stripe handles pricing" model (requires prerequisites P1-P3)

#### 2a. Update account creation

**File:** `convex/integrations/stripe/connectV2.ts` — `createStripeRecipientAccountV2`

Change `fees_collector` from `"application"` to `"stripe"`:

**Current:**
```typescript
responsibilities: {
  fees_collector: "application",
  losses_collector: "application",
}
```

**New (if P1 and P2 pass):**
```typescript
responsibilities: {
  fees_collector: "stripe",
  losses_collector: "application",
}
```

**Fallback (if P2 fails):**
```typescript
responsibilities: {
  fees_collector: "stripe",
  losses_collector: "stripe",
}
```

Under destination charges, the platform bears losses regardless — the charge is on the platform account, so `losses_collector: "stripe"` is acceptable.

#### 2b. Migrate existing accounts (if P3 succeeds)

Call `PATCH /v2/core/accounts/{id}` to update `fees_collector` for each existing connected account. This is a one-time migration script.

**If P3 fails:** Existing accounts remain on "You handle pricing". New accounts get "Stripe handles pricing". Track bifurcation in the database until a migration path is found.

### Phase 3: SEPA DD delayed confirmation (verification only)

SEPA Direct Debit takes ~6 business days to confirm. The existing code already has:
- `allowsDelayedPaymentMethods: true` in both payment sheet configs
- `payment_intent.succeeded` and `payment_intent.payment_failed` webhook handlers

**Verification needed:** Confirm `payment_intent.processing` webhook is registered in `convex/http.ts`. If not, add it. In Stripe test mode, SEPA DD confirms immediately — use `pay_{timeout}` test payment method or plan a staging test with real SEPA mandates to verify the 6-day pending flow.

### Phase 4: No changes

- External invoicing via iCount/Morning remains — no Stripe Invoicing product
- Embedded onboarding (`ConnectAccountOnboarding`, `ConnectPayouts`) remains unchanged
- `dashboard: "none"` + `disable_stripe_user_authentication: true` stays
- `presentStripeNativeBankPayment` continues serving USD bank payments

## Fee Analysis

### Per-transaction breakdown (EUR 50 lesson, no bonus)

| Component | Amount | Who pays |
|-----------|--------|----------|
| Lesson price | EUR 50 | Studio |
| Platform fee | EUR 4 | Studio |
| SEPA DD processing | EUR 0.35 | Platform (from EUR 4) |
| **Studio total** | **EUR 54** | |
| **Instructor receives** | **EUR 50** | Zero fees |
| **Platform nets** | **EUR 3.65** | After SEPA fee |

### Per-transaction breakdown (EUR 50 lesson, with bonus e.g. EUR 10)

| Component | Amount | Who pays |
|-----------|--------|----------|
| Lesson price + bonus | EUR 60 | Studio |
| Platform fee | EUR 5 | Studio |
| SEPA DD processing | EUR 0.35 | Platform (from EUR 5) |
| **Studio total** | **EUR 65** | |
| **Instructor receives** | **EUR 60** | Zero fees |
| **Platform nets** | **EUR 4.65** | After SEPA fee |

### Monthly savings (100 active instructors, fully migrated)

| Fee | Before (You handle) | After (Stripe handles) |
|-----|---------------------|----------------------|
| Monthly fee (100 x EUR 2) | EUR 200 | EUR 0 |
| Payout fees (200 payouts x (EUR 0.10 + 0.25% of EUR 50 avg)) | EUR 45 | EUR 0 |
| **Total monthly savings** | | **~EUR 245** |

## Risks and Considerations

1. **P1 failure (processing fee deducted from instructor):** If Stripe deducts processing fees from the connected account under `fees_collector: "stripe"`, keep `fees_collector: "application"` and accept the EUR 2/month cost. The savings from SEPA DD prioritization (Phase 1) still apply.

2. **SEPA mandate disputes:** SEPA DD allows 8-week "no questions asked" refunds. Already handled by existing dispute webhook logic.

3. **EUR-only SEPA:** SEPA Direct Debit only supports EUR. For GBP, BACS is used. For ILS and others, cards are used.

4. **Payout schedule:** With "Stripe handles pricing", Stripe manages the default payout schedule (typically 2 business days). Instructors configure bank details via `ConnectPayouts`.

5. **Test coverage for 6-day delay:** Stripe test mode confirms SEPA DD immediately. Plan a staging environment test with real SEPA mandates, or use `pay_{timeout}` test method if available.

## Out of Scope

- Multi-currency support beyond EUR/GBP/ILS
- Bank redirect methods (iDEAL, Bancontact, Sofort) as primary — can be added to `getPaymentMethodOrder` later
- Stripe Billing / subscriptions
- Instant payouts
