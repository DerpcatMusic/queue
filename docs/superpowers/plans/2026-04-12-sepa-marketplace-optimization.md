# European SEPA Marketplace Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch payment method ordering to SEPA-first for EUR transactions, update account creation to "Stripe handles pricing" model, and add `payment_intent.processing` webhook support.

**Architecture:** The app already uses destination charges with `transfer_data` + `application_fee_amount`. We extract a currency-aware `getPaymentMethodOrder()` function into a shared platform-independent module, use it across two payment UI entry points, update the Stripe v2 account creation to use `fees_collector: "stripe"`, and register the `payment_intent.processing` webhook event.

**Tech Stack:** React Native, Stripe Connect Accounts v2, Convex, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-11-sepa-marketplace-optimization-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/features/payments/lib/get-payment-method-order.ts` | Pure function — currency-to-payment-method mapping, no platform imports |
| Create | `src/features/payments/lib/__tests__/get-payment-method-order.test.ts` | Unit tests for `getPaymentMethodOrder` |
| Modify | `src/features/payments/lib/stripe-native.ts` | Import and re-export `getPaymentMethodOrder`, remove `DEFAULT_PAYMENT_METHOD_ORDER`, use currency-based ordering in `presentStripeNativePaymentSheet` |
| Modify | `src/features/payments/lib/stripe-native.web.ts` | Re-export `getPaymentMethodOrder` from shared module |
| Modify | `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx` | Import and use `getPaymentMethodOrder(checkout.currency)` instead of hardcoded array |
| Modify | `convex/integrations/stripe/connectV2.ts` | Change `fees_collector` from `"application"` to `"stripe"` |
| Modify | `convex/http.ts` | Add `payment_intent.processing` webhook handler |

---

### Task 1: Create shared `getPaymentMethodOrder` function with tests

**Files:**
- Create: `src/features/payments/lib/get-payment-method-order.ts`
- Create: `src/features/payments/lib/__tests__/get-payment-method-order.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/payments/lib/__tests__/get-payment-method-order.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getPaymentMethodOrder } from "../get-payment-method-order";

describe("getPaymentMethodOrder", () => {
  it("returns SEPA debit first for EUR", () => {
    expect(getPaymentMethodOrder("EUR")).toEqual(["sepa_debit", "card"]);
  });

  it("returns SEPA debit first for lowercase eur", () => {
    expect(getPaymentMethodOrder("eur")).toEqual(["sepa_debit", "card"]);
  });

  it("returns BACS first for GBP", () => {
    expect(getPaymentMethodOrder("GBP")).toEqual(["bacs_debit", "card"]);
  });

  it("returns card only for ILS", () => {
    expect(getPaymentMethodOrder("ILS")).toEqual(["card"]);
  });

  it("returns card only for USD", () => {
    expect(getPaymentMethodOrder("USD")).toEqual(["card"]);
  });

  it("returns card only for unknown currency", () => {
    expect(getPaymentMethodOrder("XYZ")).toEqual(["card"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/payments/lib/__tests__/get-payment-method-order.test.ts`
Expected: FAIL — module `../get-payment-method-order` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/features/payments/lib/get-payment-method-order.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/payments/lib/__tests__/get-payment-method-order.test.ts`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/payments/lib/get-payment-method-order.ts src/features/payments/lib/__tests__/get-payment-method-order.test.ts
git commit -m "feat: add currency-aware payment method ordering function"
```

---

### Task 2: Wire `getPaymentMethodOrder` into payment flows

**Files:**
- Modify: `src/features/payments/lib/stripe-native.ts`
- Modify: `src/features/payments/lib/stripe-native.web.ts`

- [ ] **Step 1: Update `stripe-native.ts`**

In `src/features/payments/lib/stripe-native.ts`:

Add import at the top:
```typescript
import { getPaymentMethodOrder } from "./get-payment-method-order";
```

Remove the `DEFAULT_PAYMENT_METHOD_ORDER` constant (lines 16-27).

Change line 78:
```typescript
// Before:
paymentMethodOrder: input.paymentMethodOrder ?? DEFAULT_PAYMENT_METHOD_ORDER,
// After:
paymentMethodOrder: input.paymentMethodOrder ?? getPaymentMethodOrder(input.currencyCode ?? "EUR"),
```

- [ ] **Step 2: Update `stripe-native.web.ts`**

In `src/features/payments/lib/stripe-native.web.ts`, add at the end:

```typescript
export { getPaymentMethodOrder } from "./get-payment-method-order";
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/payments/lib/stripe-native.ts src/features/payments/lib/stripe-native.web.ts
git commit -m "feat: use currency-aware payment method ordering in native payment sheet"
```

---

### Task 3: Update embedded checkout to use `getPaymentMethodOrder`

**Files:**
- Modify: `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx`

- [ ] **Step 1: Import `getPaymentMethodOrder` and replace hardcoded array**

In `src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx`:

Add to imports:
```typescript
import { getPaymentMethodOrder } from "@/features/payments/lib/get-payment-method-order";
```

Change line 72:
```typescript
// Before:
paymentMethodOrder: ["us_bank_account", "sepa_debit", "card"],
// After:
paymentMethodOrder: getPaymentMethodOrder(checkout.currency),
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx
git commit -m "feat: use currency-aware payment method ordering in embedded checkout"
```

---

### Task 4: Switch `fees_collector` to `"stripe"` in account creation

**Files:**
- Modify: `convex/integrations/stripe/connectV2.ts`

**Prerequisite:** Verify P1 (destination charge fee behavior) and P2 (API combination validity) per the spec. If P1 fails, skip this task entirely.

- [ ] **Step 1: Update `fees_collector` value**

In `convex/integrations/stripe/connectV2.ts`, change line 215:

```typescript
// Before:
fees_collector: "application",
// After:
fees_collector: "stripe",
```

Keep `losses_collector: "application"` unchanged (unless P2 failed, in which case change both to `"stripe"`).

- [ ] **Step 2: Verify no downstream breakage**

Check that `createStripeAccountSessionV2` (lines 301-303) still works. The condition checks `requirements_collector`, not `fees_collector`, so this change is independent. No code change needed here.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/integrations/stripe/connectV2.ts
git commit -m "feat: switch to Stripe handles pricing model (fees_collector: stripe)"
```

---

### Task 5: Add `payment_intent.processing` webhook handler

**Files:**
- Modify: `convex/http.ts`

- [ ] **Step 1: Add the webhook event handler**

In `convex/http.ts`, after the closing `},` of the `"payment_intent.payment_failed"` handler (line 174), add a comma and the new handler:

```typescript
"payment_intent.processing": async (ctx, event: Stripe.PaymentIntentProcessingEvent) => {
  const paymentIntent = event.data.object;
  await ctx.runMutation(internal.paymentsV2.applyStripePaymentIntentWebhookV2, {
    providerPaymentIntentId: paymentIntent.id,
    status: "processing",
    statusRaw: paymentIntent.status,
  });
},
```

- [ ] **Step 2: Verify `processing` is a valid status**

The `paymentOrderStatusValidator` at `convex/paymentsV2.ts:22-27` already includes `v.literal("processing")`. No additional changes needed.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/http.ts
git commit -m "feat: add payment_intent.processing webhook for SEPA DD delayed confirmation"
```

---

### Task 6: Existing account migration (conditional on P3)

**Prerequisite:** This task only runs if P3 (testing `PATCH /v2/core/accounts/{id}` to update `fees_collector`) succeeds. If P3 fails, skip this task and note the bifurcation.

**Files:**
- Modify: `convex/integrations/stripe/connectV2.ts`

- [ ] **Step 1: Add `updateStripeAccountV2` function**

In `convex/integrations/stripe/connectV2.ts`, add a new function after `retrieveStripeAccountV2`:

```typescript
export async function updateStripeAccountV2(
  accountId: string,
  updates: {
    feesCollector?: "stripe" | "application";
  },
) {
  return await stripeV2Fetch<StripeAccountV2>({
    method: "POST",
    path: `/v2/core/accounts/${accountId}`,
    include: ["configuration.merchant", "configuration.recipient", "identity", "requirements"],
    body: {
      defaults: {
        responsibilities: {
          ...(updates.feesCollector ? { fees_collector: updates.feesCollector } : {}),
        },
      },
    },
  });
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/integrations/stripe/connectV2.ts
git commit -m "feat: add updateStripeAccountV2 for account migration"
```

- [ ] **Step 4: Run migration manually via Convex action or script**

Create a one-time Convex action to call `updateStripeAccountV2` for each existing connected account. This should be run manually in the Convex dashboard or via `npx convex run`. The specific migration action depends on the number of existing accounts and is not part of the automated plan — execute as a manual step after deployment.

---

### Task 7: Full verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run linter on changed files**

Run: `npx eslint src/features/payments/lib/get-payment-method-order.ts src/features/payments/lib/__tests__/get-payment-method-order.test.ts src/features/payments/lib/stripe-native.ts src/features/payments/lib/stripe-native.web.ts src/components/sheets/profile/studio/stripe-embedded-checkout-sheet.tsx convex/integrations/stripe/connectV2.ts convex/http.ts`
Expected: No errors.

- [ ] **Step 4: Verify changes are complete**

Check that:
1. `DEFAULT_PAYMENT_METHOD_ORDER` constant no longer exists in `stripe-native.ts`
2. `getPaymentMethodOrder` lives in `get-payment-method-order.ts` and is re-exported from both `stripe-native.ts` and `stripe-native.web.ts`
3. Embedded checkout uses `getPaymentMethodOrder(checkout.currency)` not a hardcoded array
4. `fees_collector: "stripe"` in `createStripeRecipientAccountV2`
5. `payment_intent.processing` webhook handler registered in `http.ts`
6. `updateStripeAccountV2` function exists in `connectV2.ts`

- [ ] **Step 5: Manual verification in Stripe test mode**

- Create a new instructor account via the app — verify the account appears in Stripe Dashboard with "Stripe handles pricing"
- Complete SEPA DD payment in test mode — verify the webhook fires and payment status updates
- Verify instructor receives the full amount (no fee deduction) in the Stripe Dashboard balance

- [ ] **Step 6: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: lint fixes for SEPA marketplace optimization"
```
