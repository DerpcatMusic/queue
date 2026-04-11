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
- Studio/customer pays lesson price + EUR 4 platform fee (+ Stripe processing fee absorbed by platform from the EUR 4)
- SEPA Direct Debit as primary payment method for EUR transactions
- Keep external invoicing (iCount/Morning) — no Stripe Invoicing product (avoids 0.4% fee)
- Keep existing embedded onboarding (already optimal)

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

### Key Files

| File | Role |
|------|------|
| `convex/integrations/stripe/connectV2.ts` | Stripe Accounts v2 API client |
| `convex/paymentsPricingV2.ts` | Pricing rules (EUR 4 standard / EUR 5 bonus) |
| `src/features/payments/lib/stripe-native.ts` | Native payment sheet + SDK init |
| `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx` | Embedded checkout UI |
| `src/components/sheets/profile/instructor/stripe-connect-embedded.native.tsx` | Instructor onboarding + payouts |

## Changes

### 1. Switch to "Stripe handles pricing" model

**File:** `convex/integrations/stripe/connectV2.ts` — `createStripeRecipientAccountV2`

Change `fees_collector` from `"application"` to `"stripe"` in the account creation request.

**Current:**
```typescript
responsibilities: {
  fees_collector: "application",
  losses_collector: "application",
}
```

**New:**
```typescript
responsibilities: {
  fees_collector: "stripe",
  losses_collector: "application",
}
```

**Impact:**
- Eliminates EUR 2/month per active instructor
- Eliminates EUR 0.10 + 0.25% per payout
- Platform still collects EUR 4 via `application_fee_amount` (independent of pricing model)
- Platform still bears chargeback losses (`losses_collector: "application"`)
- Instructor receives full lesson price via destination charge — Stripe processing fee is on the platform account

**Note:** This only applies to NEW accounts. Existing accounts with `fees_collector: "application"` may need a migration path (Stripe API update or recreate). This should be verified during implementation.

### 2. Europe-first payment method ordering

**File:** `src/features/payments/lib/stripe-native.ts`

Replace the static `DEFAULT_PAYMENT_METHOD_ORDER` with a function that returns the order based on currency.

**Current:** `["us_bank_account", "sepa_debit", "bacs_debit", "au_becs_debit", "bancontact", "ideal", "eps", "p24", "fpx", "card"]`

**New:**
```typescript
function getPaymentMethodOrder(currency: string): string[] {
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

Update `presentStripeNativePaymentSheet` to use `getPaymentMethodOrder(currency)` instead of the static default.

**File:** `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx`

Update `paymentMethodOrder` in `embeddedConfiguration` from the hardcoded `["us_bank_account", "sepa_debit", "card"]` to use the same currency-aware function.

**Impact:**
- EUR transactions: SEPA DD first (EUR 0.35 flat) — saves ~EUR 0.65 per EUR 50 vs cards
- GBP transactions: BACS first (GBP 0.30 flat)
- Other currencies: cards only

### 3. SEPA DD delayed confirmation UX

SEPA Direct Debit takes ~6 business days to confirm. The existing code already has:
- `allowsDelayedPaymentMethods: true` in both payment sheet configs
- Webhook handler `applyStripePaymentIntentWebhookV2` processes `payment_intent.processing` and `payment_intent.succeeded`

**No code changes needed** for the payment flow. The `payment_intent.processing` status will be shown as "pending" in the payment activity list, and `payment_intent.succeeded` triggers the fund split.

### 4. No changes to invoicing or onboarding

- External invoicing via iCount/Morning remains — no Stripe Invoicing product
- Embedded onboarding (`ConnectAccountOnboarding`, `ConnectPayouts`) remains unchanged
- `dashboard: "none"` + `disable_stripe_user_authentication: true` stays

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

### Monthly savings (100 active instructors)

| Fee | Before (You handle) | After (Stripe handles) |
|-----|---------------------|----------------------|
| Monthly per instructor | EUR 200 | EUR 0 |
| Payout fees (2 payouts/mo each) | ~EUR 30 | EUR 0 |
| **Total monthly savings** | | **~EUR 230** |

## Risks and Considerations

1. **Existing accounts migration:** Accounts already created with `fees_collector: "application"` may not be updatable via the API. Need to verify if Stripe supports updating this field on existing v2 accounts. If not, existing instructors may need to be migrated to new accounts.

2. **SEPA mandate disputes:** SEPA DD allows 8-week "no questions asked" refunds. The platform should handle `charge.dispute.created` webhooks gracefully. This is already handled by existing dispute webhook logic.

3. **EUR-only SEPA:** SEPA Direct Debit only supports EUR. For non-EUR European currencies (GBP, CHF, etc.), cards or local bank methods (BACS, etc.) are used as fallback.

4. **`losses_collector: "application"` verification:** Confirm that combining `fees_collector: "stripe"` with `losses_collector: "application"` is a valid combination in the Accounts v2 API. If Stripe requires them to match, both should be set to `"stripe"` — the platform would still effectively bear losses through the destination charge model.

5. **Payout schedule:** With "Stripe handles pricing", Stripe manages the payout schedule for connected accounts. Instructors can still configure bank details via `ConnectPayouts`, but the payout timing is Stripe's default (typically 2 business days).

## Out of Scope

- Multi-currency support beyond EUR/GBP/ILS
- Bank redirect methods (iDEAL, Bancontact, Sofort) as primary — can be added later
- Stripe Billing / subscriptions
- Instant payouts
- Migration of existing connected accounts (needs separate investigation)
