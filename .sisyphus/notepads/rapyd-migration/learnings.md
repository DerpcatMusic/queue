# Rapyd Migration Feasibility Research

## Date: 2026-03-21

## Research Classification
- **Type**: TYPE A - Conceptual/Documentation Discovery
- **Focus**: Future migration from Flow A (card->payout-to-bank) toward split checkout and A2A
- **Sources**: Official Rapyd documentation (docs.rapyd.net)

---

## Executive Summary

The app's current Flow A (hosted checkout → card payment → separate payout disbursement to instructor bank) is well-supported. However, true split-at-checkout and A2A capabilities exist but require careful distinction between **Rapyd Collect** (pay-in) and **Rapyd Disburse** (payout) products.

---

## 1. CRITICAL DISTINCTION: Pay-In vs Payout vs Wallets

### Rapyd Collect (Pay-In) - `POST /v1/payments`, `POST /v1/checkout`
- **Purpose**: Collect money FROM customers INTO Rapyd Wallets
- **Flow**: Customer pays merchant → funds land in merchant's Rapyd wallet(s)
- **Split capability**: YES - `ewallets` array in Create Payment splits incoming funds to multiple wallets atomically
- **Key docs**: 
  - https://docs.rapyd.net/en/creating-a-split-payment.html
  - https://docs.rapyd.net/en/split-payment-by-amount.html
  - https://docs.rapyd.net/en/create-payment.html (see `ewallets` parameter)

### Rapyd Disburse (Payout) - `POST /v1/payouts`
- **Purpose**: Send money FROM Rapyd Wallets TO external beneficiaries
- **Flow**: Merchant's Rapyd wallet → bank account, card, cash, eWallet
- **Use case**: Instructor payouts (current Flow A step 2)
- **Key docs**: 
  - https://docs.rapyd.net/en/rapyd-disburse-368669.html
  - https://docs.rapyd.net/en/create-payout.html
  - https://docs.rapyd.net/en/payout-method-type.html

### eWallets
- **Purpose**: Digital containers that hold funds within Rapyd ecosystem
- **Types**: `person`, `company`, `client`
- **Key docs**: https://docs.rapyd.net/en/create-wallet.html

**WARNING**: Do NOT blur Collect split (dividing incoming payments) with Disburse (paying out). They are separate API families.

---

## 2. SPLIT PAYMENT AT CHECKOUT - What Rapyd Actually Supports

### Confirmed Supported: Split via `ewallets` Array in Create Payment

**Documentation**: https://docs.rapyd.net/en/creating-a-split-payment.html

The `POST /v1/payments` or `POST /v1/checkout` request accepts an `ewallets` array:

```json
{
  "amount": 300.00,
  "currency": "USD",
  "payment_method": { "type": "us_visa_card", "fields": {...} },
  "ewallets": [
    { "ewallet": "ewallet_xxx", "amount": 200 },
    { "ewallet": "ewallet_yyy", "amount": 100 }
  ]
}
```

**Constraints** (from official docs):
- 2-10 wallets per split
- All wallets must use `amount` OR all must use `percentage` (no mixing)
- Unallocated remainder goes to client wallet
- PCI-DSS certification required if handling card PII directly
- For non-PCI merchants: use Hosted Checkout instead

### Confirmed Supported: Split via Create Checkout Page

**Documentation**: https://docs.rapyd.net/en/create-checkout-page.html

The `ewallets` parameter also works with hosted checkout:

```
POST /v1/checkout
{
  "amount": 100.00,
  "currency": "USD",
  "country": "US",
  "ewallets": [
    { "ewallet": "ewallet_platform", "amount": 80 },
    { "ewallet": "ewallet_instructor", "amount": 20 }
  ]
}
```

### NOT the Same: Escrow vs Split

**Escrow** (`escrow` + `escrow_release_days` params) holds funds temporarily before release. This is different from split which atomically divides funds at payment time.

---

## 3. HOSTED CHECKOUT with Split - Architecture Implications

### For Marketplace Model (Instructor Payouts)

To implement split-at-checkout:
1. Customer pays $100 via hosted checkout
2. Platform wallet receives $100
3. Split immediately distributes: $80 to instructor wallet, $20 to platform wallet
4. Later: Platform triggers payout from ITS wallet to instructor's external bank

**Current Flow A**: 
- Step 1: Customer pays $100 → platform wallet
- Step 2: Platform pays out $80 to instructor bank via Disburse

**Split-at-Checkout Future**:
- Step 1: Customer pays $100 → split: $80 instructor wallet, $20 platform wallet
- Step 2: Instructor wallet balance reflects earnings immediately
- Step 3: (Optional) Instructor requests payout or balance remains for future use

**Benefit**: Real-time ledger, reduced platform float, faster instructor access to funds

---

## 4. ISRAEL A2A (Account-to-Account) RAILS - Findings

### Key Discovery: Sandbox vs Production Gap for Israel

**Evidence**: 
- Sandbox query for IL/ILS showed card payment methods but NO bank pay-in methods
- `il_general_bank` exists as a **payout** method type (documented in Create Payout)
- No documented `il_*` bank pay-in method types in Rapyd Collect

**Israel Country Page** (https://www.rapyd.net/network/country/israel/):
- Mentions "Bank Transfers" only under **Disburse Funds to Israel**
- No equivalent "Accept Bank Transfers" section for pay-in
- States: "To explore the specific payment types available in Israel, create a free account and visit the client portal"

**Conclusion**: Bank pay-in (A2A) for Israel appears to be:
1. NOT globally documented as available
2. Likely requires production enablement or account-specific configuration
3. May require Rapyd Israel license (which they obtained July 2025 per news)

### Unknowns (Requires Production/Account Validation)
- Whether `il_*` bank pay-in methods exist but aren't sandbox-enabled
- Whether Israeli A2A requires Rapyd account in specific region/category
- Whether `il_general_bank` pay-in variant exists for Collect

**Action Required**: Must be validated in:
1. Production dashboard → Payment Methods configuration
2. Direct Rapyd account manager inquiry
3. Rapyd Client Support

---

## 5. STORED PAYMENT METHODS / CUSTOMER PROFILES

**Documentation**: https://docs.rapyd.net/en/rapyd-collect-363484.html

### Customer Object (`cus_*`)
- Stores customer payment methods for reuse
- Card on file capability
- Create Customer: `POST /v1/customers`

### Saved Cards
- `POST /v1/checkout` with `customer` field enables "save card" checkbox
- `save_card_default` in custom_elements controls default state
- `require_card_cvv` for subsequent payments

### Related Endpoints
- `POST /v1/customers/{id}/paymentmethods` - Add payment method to customer
- `POST /v1/card tokens` - Tokenize cards without PII handling

**PCI Implication**: Non-PCI merchants must use hosted checkout with customer tokens rather than direct Create Payment with card details.

---

## 6. PHASED MIGRATION PATH

### Phase 1: Current Flow A (Baseline)
```
Customer → [Hosted Checkout] → Platform Wallet → [Payout/Disburse] → Instructor Bank
```
- Rapyd Collect: `POST /v1/checkout`
- Rapyd Disburse: `POST /v1/payouts` with `il_general_bank`
- **Status**: Production-ready, well-documented

### Phase 2: Split-at-Checkout (Near-term)
```
Customer → [Hosted Checkout + ewallets split] → Instructor Wallet + Platform Wallet
```
- Modify checkout to include `ewallets` array
- Instructor funds land in their Rapyd wallet immediately
- Platform can still do manual payout or let instructor self-serve
- **Status**: API feature exists, requires:
  - PCI compliance check (or use hosted checkout)
  - Instructor wallet provisioning
  - Wallet ID management in app DB

### Phase 3: True A2A (Future, Israel-specific)
```
Customer → [Bank Pay-In] → Split → Wallets
```
- Requires confirming `il_*` bank pay-in methods are enabled
- May require Rapyd Israel license activation
- Bank account as payment method instead of card
- **Status**: UNKNOWN - requires account-level validation

### Phase 4: Instructor Self-Service Payouts
```
Instructor Wallet → [Self-Service Request] → Payout to Bank
```
- Expose instructor payout balance
- Let instructors trigger `POST /v1/payouts` to their `il_general_bank`
- **Status**: API feature exists, UI required

---

## 7. ENDPOINTS CITED (Official Rapyd Docs)

### Collect (Pay-In)
| Endpoint | Doc Link | Purpose |
|----------|----------|---------|
| `POST /v1/checkout` | https://docs.rapyd.net/en/create-checkout-page.html | Hosted checkout (PCI-safe) |
| `POST /v1/payments` | https://docs.rapyd.net/en/create-payment.html | Direct payment with split |
| Split Payment | https://docs.rapyd.net/en/creating-a-split-payment.html | Split to wallets |
| Split by Amount | https://docs.rapyd.net/en/split-payment-by-amount.html | Amount-based split |
| Create Wallet | https://docs.rapyd.net/en/create-wallet.html | ewallet creation |
| Customer | https://docs.rapyd.net/en/rapyd-collect-363484.html | Customer profiles |

### Disburse (Payout)
| Endpoint | Doc Link | Purpose |
|----------|----------|---------|
| `POST /v1/payouts` | https://docs.rapyd.net/en/create-payout.html | Payout to bank/card |
| Payout Methods | https://docs.rapyd.net/en/payout-method-type.html | Method type catalog |
| List Payout Methods | `GET /v1/payout_methods` | Available in country |

---

## 8. PRODUCTION ENABLEMENT REQUIREMENTS

### For Split-at-Checkout
- [ ] PCI-DSS certification (if handling card data directly) OR use hosted checkout
- [ ] Instructor wallet provisioning (one per instructor)
- [ ] Wallet ID storage and management in app database
- [ ] Balance tracking per instructor wallet
- [ ] Webhook handling for payment confirmations

### For Israel A2A Bank Pay-In
- [ ] Confirmed `il_*` bank pay-in method availability (requires Rapyd account validation)
- [ ] Rapyd Israel license activation (obtained July 2025 per news)
- [ ] Possibly Rapyd Client Support enablement
- [ ] Business agreement amendment for new payment types

---

## 9. UNKNOWNS & VALIDATION REQUIREMENTS

| Unknown | How to Validate |
|---------|-----------------|
| Israel bank pay-in methods in production | Check production dashboard or contact Rapyd Support |
| Whether `il_general_bank` exists for Collect | List Payment Methods by Country API (`GET /v1/payment_methods/countries/IL`) in production |
| Instructor self-service payout UI | App development required |
| Split-with-escrow combination | Test in sandbox with actual flow |
| Webhook reliability for split confirmations | Sandbox testing required |

---

## 10. KEY TAKEAWAYS

1. **Split-at-checkout IS supported** via `ewallets` array in Create Payment/Checkout - this is the primary migration path

2. **Pay-in vs Payout are SEPARATE systems** - don't confuse Collect split with Disburse payout

3. **Israel A2A bank pay-in is UNCONFIRMED** - no global docs show `il_*` bank pay-in methods; likely account-specific

4. **Hosted checkout is PCI-safe** - use `POST /v1/checkout` rather than direct card handling

5. **Instructor wallets require provisioning** - each instructor needs a `ewallet_*` ID stored in your DB

6. **Production validation is essential** - sandbox may not reflect Israel's bank pay-in availability

---

## Sources
- https://docs.rapyd.net/en/creating-a-split-payment.html
- https://docs.rapyd.net/en/split-payment-by-amount.html
- https://docs.rapyd.net/en/create-checkout-page.html
- https://docs.rapyd.net/en/create-payment.html
- https://docs.rapyd.net/en/create-payout.html
- https://docs.rapyd.net/en/rapyd-disburse-368669.html
- https://docs.rapyd.net/en/rapyd-collect-363484.html
- https://docs.rapyd.net/en/create-wallet.html
- https://docs.rapyd.net/en/payout-method-type.html
- https://www.rapyd.net/network/country/israel/
- https://docs.rapyd.net/en/list-payment-methods-by-country.html

---

## 11. SANDBOX DEFAULT CHECKOUT MODE FIX (2026-03-21)

### Problem
`resolveRapydCheckoutMode()` in `convex/rapyd.ts` hardcoded default to `"a2a"` when `RAPYD_CHECKOUT_MODE` env was unset. This caused Flow A checkout to fail in IL sandbox because bank pay-in rails do not exist there (only card methods).

### Solution
Made checkout mode default environment-sensitive in `convex/integrations/rapyd/config.ts`:
- **sandbox**: defaults to `"flexible"` (card-capable) so current Flow A can reach card-hosted checkout
- **production**: defaults to `"a2a"` (fail-closed bank-only) preserving strict A2A behavior

Explicit `RAPYD_CHECKOUT_MODE` env override is always respected regardless of environment.

### Files Changed
- `convex/integrations/rapyd/config.ts`: Added `resolveRapydCheckoutMode()` with env-sensitive default
- `convex/rapyd.ts`: Removed local `resolveRapydCheckoutMode`, now imports from config
- `tests/contracts/rapyd-integration.contract.test.ts`: Added 4 tests for checkout mode resolution
- `docs/rapyd-sandbox-testing-checklist.md`: Removed `RAPYD_CHECKOUT_MODE=a2a` from required env vars, updated notes

### Rationale
IL sandbox lacks A2A/bank pay-in rails (confirmed in research above). Card pay-in methods DO exist. Making sandbox default to flexible enables Flow A card-based sandbox testing without requiring hidden knowledge of this gap.

---

## 12. SANDBOX DEFAULT PAYOUT METHOD TYPE FIX (2026-03-21)

### Problem
`processRapydBeneficiaryWebhookEvent()` in `convex/payments.ts` used `"il_bank"` as the fallback payout method type when webhook data omitted `payoutMethodType`. However, `"il_bank"` is not a valid Rapyd sandbox Israel payout rail - sandbox bank payouts use `"il_general_bank"`.

### Solution
Changed the fallback default in `processRapydBeneficiaryWebhookEvent` from `"il_bank"` to `"il_general_bank"`:
- **Before**: `args.payoutMethodType ?? process.env.RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE ?? "il_bank"`
- **After**: `args.payoutMethodType ?? process.env.RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE ?? "il_general_bank"`

### Precedence Preserved
1. Explicit `args.payoutMethodType` from webhook → highest priority
2. `RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE` env var → override for testing/production
3. `"il_general_bank"` → correct sandbox default for Israel bank payouts

### Files Changed
- `convex/payments.ts` (line 1550): Changed fallback from `"il_bank"` to `"il_general_bank"`
- `tests/contracts/finance-rapyd.contract.test.ts`: Added 2 new tests:
  - `"defaults to il_general_bank when webhook omits payoutMethodType"` - verifies correct default
  - `"respects explicit payoutMethodType from webhook over default"` - verifies explicit override wins

### Verification
`bun test tests/contracts/finance-rapyd.contract.test.ts` passes all 7 tests.

---

## Date: 2026-03-21 (Follow-up)

### .env.example Alignment Fix

**Problem**: `.env.example` hardcoded `RAPYD_CHECKOUT_MODE=a2a` which overrides sandbox's correct `flexible` default, pushing sandbox users into broken IL A2A checkout behavior.

**Fix**: 
- Removed hardcoded `a2a` value from `.env.example` (commented out as opt-in override)
- Updated comment to explain environment-sensitive defaults: sandbox→flexible, production→a2a
- Added optional `RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE` commented out with note about Israel sandbox default of `il_general_bank`

**Files Changed**:
- `.env.example` (lines 66-76): Updated checkout mode comments, commented out `a2a` override, added `RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE` note

**Note**: `docs/rapyd-sandbox-testing-checklist.md` was already correct (line 34) and remains consistent with the updated `.env.example`.

---

## Date: 2026-03-21 (Flow A Sandbox Env Setup)

### .env.local Rapyd Sandbox Config Added

**Action**: Added missing Rapyd sandbox env vars to `.env.local` for Flow A testing.

**Vars Added**:
- `RAPYD_MODE=sandbox`
- `RAPYD_SANDBOX_BASE_URL=https://sandboxapi.rapyd.net`
- `RAPYD_COUNTRY=IL`
- `PAYMENTS_CURRENCY=ILS`
- `RAPYD_COMPLETE_CHECKOUT_URL` / `RAPYD_CANCEL_CHECKOUT_URL` (convex.site bridge URLs)
- `RAPYD_BENEFICIARY_COMPLETE_URL` / `RAPYD_BENEFICIARY_CANCEL_URL` (convex.site bridge URLs)
- `ALLOW_SANDBOX_DESTINATION_SELF_VERIFY=1`
- `RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE=il_general_bank`
- `RAPYD_WEBHOOK_SECRET` (set to same value as `RAPYD_SECRET_KEY`)

**Placeholder Left Blank**:
- `RAPYD_EWALLET=` - user has not yet created the platform wallet; value cannot be safely invented

**Not Added**:
- `RAPYD_CHECKOUT_MODE` - sandbox now correctly defaults to `flexible` per the earlier fix in this document

**Remaining Missing Piece**: Creating/finding the platform wallet ID to fill into `RAPYD_EWALLET`

**2026-03-21 - Platform Wallet Discovered & Filled**:
- Discovered sandbox primary wallet ID: `ewallet_4b1317dd5f7b8881b1a8a6f3f20f7b9c`
- Filled `RAPYD_EWALLET` in `.env.local` with this wallet ID
- Flow A platform wallet is separate from instructor bank onboarding (per user guidance)
