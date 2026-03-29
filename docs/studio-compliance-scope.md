# Studio Compliance Scope: Legal Identity, Billing, and Job Posting Gate

## Goal

Studios should be able to:

- sign in
- complete basic onboarding
- edit profile and branch details
- browse the app
- prepare job drafts

Studios should not be able to:

- publish jobs
- create chargeable payment flows
- receive instructor contact details beyond the normal marketplace flow

until the studio account is compliant.

This must be enforced server-side in Convex, not only in the UI.

## Core Product Decision

Keep the MVP small.

Studio compliance in v1 should answer one question:

- can this studio legally and operationally post jobs on Queue?

Do not turn this into a full bookkeeping, invoicing, or tax-ops system in phase 1.

## Current Repo Reality

- [studioProfiles](/home/derpcat/projects/queue/convex/schema.ts#L308) currently store marketplace/profile data only:
  - studio name
  - address
  - contact phone
  - location
  - push settings
  - logo
- [completeStudioOnboarding](/home/derpcat/projects/queue/convex/onboarding.ts) currently collects only basic studio identity and address.
- [postJob](/home/derpcat/projects/queue/convex/jobs.ts#L521) currently checks only studio ownership and branch access.
- There is no unified studio compliance layer for:
  - owner identity verification
  - legal billing identity
  - tax/business ID
  - payment readiness
  - compliance-based job posting blockers

## Recommended Architecture

Use one unified decision layer backed by separate domain records.

Recommended module:

- `convex/lib/studioCompliance.ts`

That module should derive one decision object:

```ts
type StudioComplianceDecision = {
  canBrowse: boolean;
  canCreateDraftJobs: boolean;
  canPublishJobs: boolean;
  canRunPayments: boolean;
  blockingReasons: string[];
  ownerIdentityStatus: "approved" | "pending" | "missing" | "failed";
  businessProfileStatus: "complete" | "incomplete";
  paymentStatus: "ready" | "pending" | "missing" | "failed";
};
```

## MVP Scope

### In Scope (v1)

- one hard server-side gate for `postJob`
- one internal business/billing profile for each studio
- one owner identity requirement
- one payment-readiness requirement
- one client-safe summary query for blocker reasons
- teaser UI that lets studios fill details and save drafts before they are compliant

### Explicitly Out of Scope (v1)

- uploading tax certificates or accountant paperwork
- AI verification of studio tax documents
- automatic validation against Israeli tax authority registries
- multi-owner KYC workflows
- branch-level legal entities
- invoice-generation logic redesign
- a full finance back office

## What Should Block Posting Jobs

`canPublishJobs === true` only when all of these are true:

1. Owner identity is approved
2. Studio legal billing profile is complete
3. Payment method is ready for checkout/charging

Recommended hard blockers:

- `owner_identity_required`
- `business_profile_required`
- `payment_method_required`

## Identity Requirement

For studios, the identity requirement should apply to the account owner, not to the studio branch.

Recommendation:

- reuse Didit as the identity provider
- attach the identity decision to the owner user account or a generic user identity record
- do not create a separate “studio Didit” system if the actual regulated subject is the human owner

Why:

- Didit is a person-level KYC flow
- the studio legal entity still needs a real accountable human behind it
- this keeps your identity model coherent across instructor and studio roles

## Business / Tax Data Model

Add one internal-only studio billing profile table instead of polluting `studioProfiles`.

Recommended table:

- `studioBillingProfiles`

Fields:

- `studioId`
- `ownerUserId`
- `legalEntityType`: `"individual"` | `"company"`
- `legalBusinessName`
- `taxId`
- `vatReportingType?`: `"osek_patur"` | `"osek_murshe"` | `"company"` | `"other"`
- `billingEmail`
- `billingPhone?`
- `billingAddress?`
- `status`: `"incomplete"` | `"complete"`
- `completedAt?`
- `createdAt`
- `updatedAt`

Important product decision:

- `taxId` means the identifier needed for billing and legal records:
  - company / business number when applicable
  - owner ID only when operating as an individual

This data is internal only.

## Payment Readiness

Use your existing payment stack as the source of truth for whether a studio can actually fund jobs.

Do not invent a second payment-verification state.

Recommended payment gate:

- `canRunPayments === true` only when a studio has a valid usable payment instrument or checkout setup according to the Rapyd flow you already have

For the derived compliance layer, treat payment readiness as:

- `missing`
- `pending`
- `ready`
- `failed`

## Internal vs External Data Boundary

### Internal Only

- legal business name
- tax ID / business number
- VAT classification
- billing email and billing phone
- payment provider state
- raw compliance notes
- any future tax or incorporation documents

### External / Marketplace Safe

- studio display name
- logo
- studio bio
- branch address after normal marketplace rules
- sports offered
- payment/compliance is represented only as an internal gate, not as raw business data

Studios do not need to expose tax or legal records to instructors.

## Enforcement Rules

### `canBrowse`

- always `true` for authenticated studio accounts

### `canCreateDraftJobs`

- `true`

Reason:

- the teaser model is useful here too
- studios can prepare the job and see the value before hitting the publish gate

### `canPublishJobs`

- owner identity approved
- billing profile complete
- payment status ready

This must be checked in:

- [postJob](/home/derpcat/projects/queue/convex/jobs.ts#L521)

If later you add draft/publish separation, the gate should apply to `publish`, not `saveDraft`.

## Recommended Queries and Helpers

Add:

- `convex/lib/studioCompliance.ts`
- `convex/complianceStudio.ts`

Recommended public query:

- `complianceStudio.getMyStudioComplianceSummary`

Recommended internal helper:

- `assertStudioCanPublishJobs(ctx, studioId)`

## UI Scope

Phase 1 UI should stay tight:

- let the studio finish basic onboarding
- if they try to publish a job while blocked, show a modal with blocker reasons
- route them to one “Studio Compliance” screen
- that screen should have three cards:
  - owner identity
  - legal billing profile
  - payment method

Do not add:

- tax-document upload UI
- accountant workflow UI
- branch-by-branch compliance UI

## Recommended Rollout

### Phase 1: Groundwork

- add `studioBillingProfiles`
- add `studioCompliance.ts`
- add summary query
- enforce compliance in `postJob`
- show blocker modal in studio job creation flow

### Phase 2: Identity Unification

- move or generalize Didit so owner identity can be reused across both instructor and studio roles
- expose owner identity status on the studio compliance summary

### Phase 3: Payment Gate

- wire payment-readiness from the existing Rapyd onboarding/checkouts into `studioCompliance.ts`
- do not allow job posting if the studio cannot actually pay

### Phase 4: Optional Finance Expansion

Only if real business operations require it:

- add `studioTaxDocuments`
- store accountant letters / company registration / VAT exemption proofs
- add manual review or provider-based validation

This should not happen until you know exactly which document is legally required.

## Recommended MVP Interpretation of the AI Advice

The AI advice about “tax certificate / business certificate” is directionally right, but too broad for v1.

The smallest correct interpretation is:

- you need a verified human owner
- you need the studio’s legal billing identity
- you need a way to charge the studio

You do not yet need:

- scanned tax certificates
- AI review of business paperwork
- a generalized compliance-doc pipeline for studios

## Open Questions

These need product/legal clarification before phase 4, not before phase 1:

- Is Queue itself issuing invoices, or is it delegating invoice issuance to a provider?
- Do you legally need to collect formal tax documents from studios, or only billing identity data?
- Is owner Didit enough for studio onboarding, or do you need a separate company verification provider later?
