# Studio Business KYC — Unified Compliance Screen

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Studio (business user) compliance screen redesign for EU expansion

## Problem

Current studio compliance is fragmented across 4 sections with no progress indicator, Israeli-only VAT fields hardcoded in schema/frontend/translations, identity verification wired as always-approved (decorative), billing form duplicated across 3 files, and no country awareness. EU expansion is blocked.

## Design Decision

**Approach A: Checklist → Expand.** Single screen with horizontal 3-step progress bar, accordion cards (one expanded at a time), country-adaptive business form in a dedicated sheet, Stripe Identity replacing Didit.

### Why this approach

- At-a-glance status in 2 seconds (current system requires scrolling 4 sections)
- Country-adaptive form isolated — easy to extend per market
- Reuses existing `StripeConnectEmbeddedModal` and Stripe native components
- Single source of truth replaces 3 duplicated files
- Stripe requirements drive UI state — no guessing

## Screen Structure

### Hero

Compact top banner:
- All complete: green text "Ready to publish"
- Incomplete: amber text "Complete X steps to publish"
- No paragraph body — just the signal

### Progress Bar

Horizontal 3-segment progress bar below hero:

```
[● Identity]  [○ Business Info]  [○ Payment]
```

- Filled = complete, half-filled = in-progress, empty = not started
- Each segment tappable — scrolls/highlights corresponding card
- Status derived from Stripe `account.requirements.currently_due`

### Accordion Cards

Three collapsible cards stacked vertically. One expanded at a time.

**Collapsed state:** Icon | Title | Status badge (Done / In Progress / Action Required) | Chevron

**Expanded state:** Full section content (see below)

### Sticky CTA (optional)

If any section incomplete, floating bottom CTA: "Complete setup" → expands next incomplete section. If all complete, no CTA.

### Removed

- **Overview section** — studio details/branches already on profile screen
- **Duplicate payment row** — payment is one of the 3 cards, not a pointer elsewhere
- **Inline billing form** — moved to dedicated sheet

## Card 1: Identity Verification (Stripe Identity)

### Collapsed

```
[person.text.rectangle.fill]  Identity Verification    [badge]  >
```

### Expanded

- Status text: "Verify your identity to enable payouts" or "Verified as [Legal Name]"
- **Not started:** Primary CTA "Start verification" → `StripeConnectEmbeddedModal` mode `"onboarding"`
- **Pending:** "Refresh status" button + auto-refresh on app focus
- **Failed:** "Retry verification" → same modal
- **Verified:** Green checkmark, legal name, no CTA

### Implementation

- Uses `@stripe/stripe-react-native` `ConnectAccountOnboarding` (already in `stripe-connect-embedded.native.tsx`)
- Status read from Stripe account `requirements.currently_due` — if `individual.verification` fields present, identity incomplete
- **Drops Didit entirely** — one vendor, identity data feeds directly into Connect

## Card 2: Business Information (Country-Adaptive)

### Collapsed

```
[building.2.fill]  Business Information    [badge]  >
```

### Expanded

Tapping opens a dedicated bottom sheet (not inline form). Sheet contains:

1. **Country selector** — pre-filled from `getStripeMarketDefaults().country`. Changing country reloads form fields.

2. **Entity type** — `ChoicePill` row: Individual / Company. Selecting "Company" reveals additional fields (company reg, legal form, beneficial owners).

3. **Country-adaptive fields** — driven by config map:

| Field | IL | DE | FR | ES |
|-------|----|----|----|-----|
| Legal name | Yes | Yes | Yes | Yes |
| Tax ID label | ח.פ/ע.מ | Steuernummer | SIREN | NIF |
| VAT ID label | — | USt-IdNr | TVA | IVA |
| VAT classification | osek_patur/murshe | Kleinunternehmer/Regelbesteuerung | Franchise/Assujetti | Régimen simplificado |
| Company reg number | No | Handelsregister | RCS | Registro Mercantil |
| Legal form | No | GmbH, UG, etc. | SARL, SA, etc. | SL, SA, etc. |
| Billing email | Yes | Yes | Yes | Yes |
| Billing address | Stripe Address Sheet | Stripe Address Sheet | Stripe Address Sheet | Stripe Address Sheet |

4. **Address:** Always `StripeAddressSheet` component (native Stripe element). No manual text field. Returns structured address data stored as object, not concatenated string.

5. **Auto-save** on field blur with debounce. Inline "Saving..." indicator. Feedback banner on error. No explicit save button.

6. **Beneficial owners** (Company + EU only): CTA "Add beneficial owners" → `StripeConnectEmbeddedModal` mode `"onboarding"` handles UBO declarations natively.

### Country Config Map

Single source of truth:

```typescript
interface CountryFieldConfig {
  countryCode: string;
  taxIdLabel: string;
  taxIdPlaceholder?: string;
  vatClassifications: Array<{ value: string; label: string }>;
  showCompanyRegNumber: boolean;
  companyRegLabel?: string;
  showLegalForm: boolean;
  legalFormOptions?: Array<{ value: string; label: string }>;
  showBeneficialOwners: boolean;
}

const COUNTRY_CONFIGS: Record<string, CountryFieldConfig> = {
  IL: {
    countryCode: "IL",
    taxIdLabel: "profile.studioCompliance.billing.taxId",
    vatClassifications: [
      { value: "osek_patur", label: "profile.studioCompliance.billing.vatOptions.osek_patur" },
      { value: "osek_murshe", label: "profile.studioCompliance.billing.vatOptions.osek_murshe" },
    ],
    showCompanyRegNumber: false,
    showLegalForm: false,
    showBeneficialOwners: false,
  },
  DE: {
    countryCode: "DE",
    taxIdLabel: "profile.studioCompliance.billing.taxIdDE",
    vatClassifications: [
      { value: "kleinunternehmer", label: "..." },
      { value: "regelbesteuerung", label: "..." },
    ],
    showCompanyRegNumber: true,
    companyRegLabel: "profile.studioCompliance.billing.companyRegDE",
    showLegalForm: true,
    legalFormOptions: [...],
    showBeneficialOwners: true,
  },
  // ... FR, ES, etc.
};
```

## Card 3: Payment Setup

### Collapsed

```
[creditcard.fill]  Payment Setup    [badge]  >
```

### Expanded

- Status text describing current state
- **Not set up:** Primary CTA "Set up payouts" → `StripeConnectEmbeddedModal` mode `"auto"`
- **Active:** Inline mini-dashboard using `ConnectPayments` + `ConnectPayouts` components. Tabbed: Payments | Payouts
- **Restricted:** Reason text + "Fix issues" CTA → relaunch onboarding
- **Pending:** "Refresh status" + auto-refresh

### Implementation

- Reuses existing `StripeConnectEmbeddedModal` dashboard mode (lines 60-130 of `stripe-connect-embedded.native.tsx`)
- Replaces current separate `/studio/profile/payments` screen
- All payment activity visible inline — no navigation away

## State Management

### `useStudioBillingForm` Hook

Consolidates the 3-file duplication into one hook:

```typescript
function useStudioBillingForm(billingProfile: BillingProfile | null, currentUser: User) {
  // Fields hydrated from billingProfile
  // Country-aware field config via COUNTRY_CONFIGS
  // Auto-save with debounce (300ms after last keystroke)
  // Dirty-state tracking (compare current values vs original)
  // Unsaved-changes warning on dismiss
  // Returns: { fields, updateField, save, isSaving, feedback, isDirty, countryConfig, country }
}
```

### Accordion State

```typescript
type ExpandedSection = "identity" | "business" | "payment" | null;
// One expanded at a time, or null (all collapsed)
```

### Status Derivation

```typescript
function getCardStatuses(stripeRequirements: StripeRequirements) {
  return {
    identity: deriveIdentityStatus(stripeRequirements),
    business: deriveBusinessStatus(stripeRequirements, billingProfile),
    payment: derivePaymentStatus(stripeAccount, paymentsPreflight),
  };
}
```

All status derived from Stripe account requirements — single source of truth.

## Schema Changes

### `studioBillingProfiles` table

- **Add:** `country: string` (ISO 3166-1 alpha-2)
- **Change:** `vatReportingType` → `taxClassification: string` (country-prefixed value, e.g., `"IL:osek_patur"`, `"DE:kleinunternehmer"`)
- **Add:** `companyRegNumber?: string`
- **Add:** `legalForm?: string`
- **Change:** `billingAddress` from `string` to structured object:
  ```
  { line1, line2, city, state, postalCode, country }
  ```
- **Remove:** Israeli-only union type for VAT classification

### Backend validators

- `studioVatReportingTypeValidator` → `studioTaxClassificationValidator` (string, validated against `COUNTRY_CONFIGS[country].vatClassifications`)
- Add `country` validator (required, ISO alpha-2)
- Add optional `companyRegNumber`, `legalForm` validators

### Migration

- Existing IL records: set `country: "IL"`, `taxClassification: "IL:" + vatReportingType`
- Address strings: parse comma-separated into structured object where possible, flag for manual review where not

## Components to Build/Modify

### New

1. **`StudioComplianceScreen`** — unified screen replacing current `compliance.tsx`
2. **`StudioBusinessInfoSheet`** — dedicated sheet for business form
3. **`ComplianceProgress`** — horizontal 3-step progress bar component
4. **`ComplianceCard`** — reusable accordion card (icon, title, badge, expandable content)
5. **`useStudioBillingForm`** — shared hook replacing 3 duplicated form states
6. **`country-field-config.ts`** — country config map
7. **`useComplianceCardStatus`** — derives card statuses from Stripe requirements

### Modified

1. **`StripeConnectEmbeddedModal`** — ensure identity onboarding mode works for studios
2. **`stripe.ts`** — add country-specific helpers
3. **Translation files** — add DE/FR/ES/DA field labels, remove transliterated Hebrew terms
4. **Backend `complianceStudio.ts`** — update validators, add country field
5. **Backend `studioCompliance.ts`** — fix `getOwnerIdentityStatus` to use Stripe requirements

### Removed

1. **`studio-compliance-sheet.tsx`** — replaced by unified screen
2. **Duplicate billing form** in onboarding step (uses shared hook instead)
3. **Didit integration** for studio identity verification

## Stripe Native Components Used

| Component | Where | Purpose |
|-----------|-------|---------|
| `ConnectAccountOnboarding` | Identity card | KYC verification flow |
| `ConnectPayments` | Payment card (expanded) | Payment history |
| `ConnectPayouts` | Payment card (expanded) | Payout history |
| `StripeAddressSheet` | Business info sheet | Structured address input |
| `StripeConnectEmbeddedModal` | Identity + Payment cards | Full-screen modal wrapper |

All from `@stripe/stripe-react-native` — no custom KYC forms where Stripe provides native ones.

## Performance

- **Lazy load:** Business info sheet mounts only when expanded
- **Debounced save:** 300ms after last field change
- **Stripe requirements cached:** fetched on screen mount, refreshed on app focus
- **Accordion:** only expanded card's content in render tree
- **Country config:** static import, no runtime lookup overhead

## Error Handling

- **Stripe session fails:** Show error banner in card, retry CTA
- **Save fails:** Inline error on field, preserve user input, retry on next blur
- **Network offline:** Queue saves, show offline indicator
- **Unsaved changes:** Warn on sheet dismiss/back navigation if dirty

## Accessibility

- Progress bar: accessible label with step X of 3, status per step
- Accordion cards: proper `accessibilityState.expanded`
- Status badges: text labels, not color-only
- Form fields: labels associated, required indicators
- CTAs: clear action labels

## Out of Scope

- Instructor compliance (separate system, different requirements)
- Branch management (stays on profile screen)
- Job posting flow (consumes compliance status, not changed)
- Web-specific fallbacks (address current web stub behavior)
