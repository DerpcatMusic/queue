# Studio Business KYC — Unified Compliance Screen

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Studio (business user) compliance screen redesign for EU expansion

## Problem

Current studio compliance is fragmented across 4 sections with no progress indicator, Israeli-only VAT fields hardcoded in schema/frontend/translations, identity verification wired as always-approved (decorative), billing form duplicated across 3 files, and no country awareness. EU expansion is blocked.

## Design Decision

**Approach A: Checklist → Expand.** Single screen with horizontal 3-step progress bar, accordion cards (one expanded at a time), country-adaptive business form in a dedicated sheet, Stripe Connect replacing Didit for identity.

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

Three collapsible cards stacked vertically. One expanded at a time. Uses `react-native-reanimated` `useAnimatedStyle` + `measure` for smooth height transitions (consistent with existing animation patterns in the codebase).

**Collapsed state:** Icon | Title | Status badge (Done / In Progress / Action Required) | Chevron

**Expanded state:** Full section content (see below)

### Sticky CTA (optional)

If any section incomplete, floating bottom CTA: "Complete setup" → expands next incomplete section. If all complete, no CTA.

### Removed

- **Overview section** — studio details/branches already on profile screen
- **Duplicate payment row** — payment is one of the 3 cards, not a pointer elsewhere
- **Inline billing form** — moved to dedicated sheet

## Card 1: Identity Verification

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

Uses `ConnectAccountOnboarding` inside `StripeConnectEmbeddedModal`. Stripe Connect's onboarding is a single unified flow that handles identity verification AND business details AND bank account setup. **Card 1 triggers this full flow.** Once the user completes Stripe onboarding:

- Card 1 status derived from whether `individual.verification.status` in Stripe requirements is verified
- Card 2 status derived from whether `company`/`business` requirements are met
- Card 3 status derived from whether `external_account` requirements are met

**Key behavior:** Stripe Connect Onboarding is triggered ONCE from Card 1. It handles everything. Cards 2 and 3 then reflect the relevant slices of what was completed. If the user already completed onboarding, Card 1 shows verified and Cards 2/3 show their respective statuses. If only partial onboarding was completed (e.g., identity done but bank account skipped), Card 1 shows done, Card 3 shows "Action Required" with a CTA to resume onboarding for the missing piece.

**Card 3 payment dashboard** only appears when the Stripe account is fully active (charges enabled). Until then, Card 3 shows status + resume CTA.

**Drops Didit entirely** — one vendor, identity data feeds directly into Connect.

### Identity Status Mapping

```typescript
function deriveIdentityStatus(requirements: StripeRequirements): CardStatus {
  const due = requirements.currently_due ?? [];
  const pastDue = requirements.past_due ?? [];

  const identityFields = [
    "individual.verification.document",
    "individual.verification.additional_document",
    "individual.dob.day",
    "individual.first_name",
    "individual.last_name",
  ];

  const hasIdentityPending = due.some(f => identityFields.some(id => f.startsWith(id)));
  const hasIdentityPastDue = pastDue.some(f => identityFields.some(id => f.startsWith(id)));

  if (!hasIdentityPending && !hasIdentityPastDue) return "complete";
  if (hasIdentityPastDue) return "action_required";
  return "in_progress";
}
```

### Didit Deprecation

- **`studioProfiles.diditVerificationStatus`**: Deprecated. Remains in schema for audit trail but no longer read by studio compliance logic. New code reads from Stripe requirements only.
- **`diditEvents` table**: Preserved as-is for historical data. No new events written for studios.
- **Access snapshot**: Replace `diditVerification` field with `stripeVerification` derived from Stripe account requirements.
- **No data migration needed** — old Didit data stays, new status comes from Stripe.

## Card 2: Business Information (Country-Adaptive)

### Collapsed

```
[building.2.fill]  Business Information    [badge]  >
```

### Expanded

Tapping opens a dedicated bottom sheet (not inline form). Sheet contains:

1. **Country selector** — pre-filled from `getStripeMarketDefaults().country`. **Country is locked after initial save** — changing country requires a separate "Change country" confirmation flow that clears country-specific fields (tax ID, VAT classification, company reg, legal form) while preserving universal fields (legal name, email, address, phone). This prevents accidental data loss from mid-form country switches.

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
| Billing phone | Yes | Yes | Yes | Yes |
| Billing address | Stripe Address Sheet | Stripe Address Sheet | Stripe Address Sheet | Stripe Address Sheet |

4. **Address:** Always `StripeAddressSheet` component (native Stripe element). No manual text field. Returns structured address data stored as structured object, not concatenated string.

5. **Auto-save** on field blur with debounce (300ms). Inline "Saving..." indicator. Feedback banner on error. No explicit save button. **Auto-save writes field values only — does NOT change `status`.** Profile status transitions from `"incomplete"` to `"complete"` only when all required fields for the current country config are non-empty. This prevents partial saves from marking the profile complete.

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
- **Not set up:** Primary CTA "Set up payouts" → `StripeConnectEmbeddedModal` mode `"onboarding"` (resumes Stripe onboarding if already started, or starts fresh). This handles bank account + payout setup.
- **Active:** Inline mini-dashboard using `ConnectPayments` + `ConnectPayouts` components. Tabbed: Payments | Payouts
- **Restricted:** Reason text + "Fix issues" CTA → relaunch onboarding
- **Pending:** "Refresh status" + auto-refresh

### Implementation

- Reuses existing `StripeConnectEmbeddedModal` dashboard mode (lines 60-130 of `stripe-connect-embedded.native.tsx`)
- Replaces current separate `/studio/profile/payments` screen
- All payment activity visible inline — no navigation away

### Relationship to Card 1

Card 1 triggers the initial Stripe Connect onboarding (full flow). If the user completes identity but skips bank setup, Card 1 shows complete, Card 3 shows "Action Required" with a resume CTA. Card 3's resume CTA re-enters Stripe onboarding scoped to the missing requirements.

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

### Onboarding Step Migration

The onboarding step (`step-studio-compliance-body.tsx`) currently receives all state as props from the parent onboarding screen. Migration path:

1. **Onboarding parent** adopts `useStudioBillingForm` hook and passes the returned object down as props
2. **Onboarding step** renders the same `StudioBusinessInfoSheet` component used by the compliance screen (extracted as shared component)
3. This eliminates the third copy of the billing form logic

### Accordion State

```typescript
type ExpandedSection = "identity" | "business" | "payment" | null;
// One expanded at a time, or null (all collapsed)
```

### Status Derivation

```typescript
function getCardStatuses(stripeRequirements: StripeRequirements, billingProfile: BillingProfile | null) {
  return {
    identity: deriveIdentityStatus(stripeRequirements),
    business: deriveBusinessStatus(stripeRequirements, billingProfile),
    payment: derivePaymentStatus(stripeRequirements),
  };
}
```

All status derived from Stripe account requirements — single source of truth.

## Schema Changes

### `studioBillingProfiles` table

- **Add:** `country: string` (ISO 3166-1 alpha-2, required)
- **Change:** `vatReportingType` → `taxClassification: string` (plain value WITHOUT country prefix, validated against `COUNTRY_CONFIGS[country].vatClassifications` at write time. The country field provides context; no redundant prefix needed.)
- **Add:** `companyRegNumber?: string`
- **Add:** `legalForm?: string`
- **Add:** `billingAddressStructured?: { line1: string, line2?: string, city: string, state?: string, postalCode: string, country: string }` — new additive field. Old `billingAddress: string` retained for backward compatibility, deprecated. New writes go to `billingAddressStructured`. Read path prefers structured, falls back to string.
- **Remove:** Israeli-only union type for VAT classification (replaced by `taxClassification` validated per-country)

### Backend validators

- `studioVatReportingTypeValidator` → `studioTaxClassificationValidator` (string, validated against `COUNTRY_CONFIGS[country].vatClassifications` at write time)
- Add `country` validator (required, ISO alpha-2)
- Add optional `companyRegNumber`, `legalForm` validators

### Connected Accounts

- Expand `connectedAccountsV2.role` to include `"studio"` alongside existing `"instructor"`
- Studio connected accounts use the same Stripe Connect flow with `business_type` set to `company` or `individual`

### Compliance Block Reasons

- Add `"owner_identity_required"` to `StudioComplianceBlockReason` union
- Update `buildStudioComplianceSummary` to push this reason when Stripe identity requirements are unmet

### Migration

- Existing IL records: set `country: "IL"`, `taxClassification: <vatReportingType value>` (no prefix)
- Address strings: keep as `billingAddress` string. Next time user edits billing, `StripeAddressSheet` populates `billingAddressStructured`. No lossy parsing attempt.

## Components to Build/Modify

### New

1. **`StudioComplianceScreen`** — unified screen replacing current `compliance.tsx`
2. **`StudioBusinessInfoSheet`** — dedicated sheet for business form (shared between compliance screen and onboarding)
3. **`ComplianceProgress`** — horizontal 3-step progress bar component
4. **`ComplianceCard`** — reusable accordion card using `react-native-reanimated` for collapse animation
5. **`useStudioBillingForm`** — shared hook replacing 3 duplicated form states
6. **`country-field-config.ts`** — country config map
7. **`useComplianceCardStatus`** — derives card statuses from Stripe requirements

### Modified

1. **`StripeConnectEmbeddedModal`** — ensure onboarding mode works for studios (session creation needs studio account support)
2. **`stripe.ts`** — add country-specific helpers
3. **Translation files** — add DE/FR/ES/DA field labels, remove transliterated Hebrew terms
4. **Backend `complianceStudio.ts`** — update validators, add country field, status stays incomplete until all required fields filled
5. **Backend `studioCompliance.ts`** — replace `getOwnerIdentityStatus` with Stripe requirements check, add `"owner_identity_required"` block reason
6. **Onboarding parent** — adopt `useStudioBillingForm`, render `StudioBusinessInfoSheet`
7. **`connectedAccountsV2` schema** — expand `role` to include `"studio"`

### Removed

1. **`studio-compliance-sheet.tsx`** — replaced by unified screen
2. **`step-studio-compliance-body.tsx`** inline form — replaced by shared `StudioBusinessInfoSheet` component
3. **Didit integration** for studio identity verification (preserved for instructor flow)

## Stripe Native Components Used

| Component | Where | Purpose |
|-----------|-------|---------|
| `ConnectAccountOnboarding` | Card 1 (initial flow) | Full KYC + onboarding |
| `ConnectPayments` | Card 3 (expanded, active) | Payment history |
| `ConnectPayouts` | Card 3 (expanded, active) | Payout history |
| `StripeAddressSheet` | Card 2 (business info sheet) | Structured address input |
| `StripeConnectEmbeddedModal` | Cards 1 + 3 | Full-screen modal wrapper |

All from `@stripe/stripe-react-native` — no custom KYC forms where Stripe provides native ones.

## Web Platform

Studio compliance screen requires native mobile for this phase. On web:
- Compliance screen shows status cards (read-only)
- CTAs display "Open the mobile app to complete verification" with a deep link
- Business info form works on web (country-adaptive fields are standard React Native inputs)
- Stripe Address Sheet uses web fallback (hosted Stripe page)
- Identity + payment setup direct users to mobile

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
- Didit removal from instructor flow (instructor flow unchanged)
