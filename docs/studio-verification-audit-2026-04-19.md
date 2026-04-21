# Studio verification audit — 2026-04-19

## 1) What this tab is actually for
This is **not** “publishing setup.” It is the **studio verification gate** that decides whether a studio may publish jobs.

Today, the product logic already treats it that way:
- `convex/lib/studioComplianceReads.ts`
- `convex/policy/compliance.ts`
- `src/components/jobs/studio/use-studio-feed-controller.ts`

Current publish blockers are:
1. `owner_identity_required`
2. `business_profile_required`
3. `payment_method_required`
4. `account_suspended`

So the tab’s real job is:
- verify the accountable human behind the studio
- collect the legal/business identity needed for invoicing/compliance
- confirm payment readiness
- explain why posting is blocked and how to unblock it

**Recommendation:** rename the tab/surface from **Publishing setup** to **Verification** or **Studio verification**.

---

## 2) Good / bad / ugly

### Good
- Backend already has a real policy gate for posting.
- Didit is already integrated for owner KYC (`convex/payments/studioActions.ts`, `convex/httpDidit.ts`).
- Access snapshot centralizes compliance + verification state (`convex/access/snapshots.ts`).
- There is already a 3-step mental model in the route UI: identity → business → payments.

### Bad
- Naming is wrong: “publishing setup” hides the real purpose.
- UI mixes three different concepts: verification, business onboarding, and payments setup.
- The profile sheet and full route duplicate logic/UI with inconsistent quality.
- Billing completion is too shallow: backend marks “complete” when legal name + tax ID + billing email exist, even if country-specific business proof is missing.
- The current system is mostly **owner KYC + self-declared business info**, not real **KYB**.
- Copy explains mechanics, not consequences: “why am I blocked?” is still fuzzy.

### Ugly
- Country handling is not production-ready for Europe:
  - billing country falls back to Stripe env default (`DE`) if absent
  - country field config supports only `IL`, `DE`, `FR`, `ES`
  - unsupported countries fall back to **IL** (`src/features/compliance/country-field-config.ts`)
- Address autocomplete is still hard-restricted to **Israel**:
  - `src/lib/google-places.ts` uses `countrycodes=il`
  - Google autocomplete uses `includedRegionCodes: ["il"]`
- `ResolvedLocation` does not carry country / ISO country code even though Expo reverse geocoding supports `isoCountryCode`.
- Onboarding still says studio verification happens later / can be skipped (`src/app/onboarding/verification.tsx`), which weakens the gate’s meaning.

---

## 3) What marketplaces usually do
Common pattern across Walmart Marketplace, Airbnb host/business KYC, Adyen/marketplace docs, Trulioo seller onboarding:
1. **Business verification first**
2. **Authorized representative identity verification**
3. **Business details / tax / registration collection**
4. **Payout or payment method setup**
5. **Conditional enhanced due diligence** for riskier accounts
6. Block listing/payouts until required steps are complete

Common UX pattern:
- call it **Verification**, **Business verification**, or **Identity & business verification**
- show exact blocking reasons
- progressive disclosure: collect minimum first, then extra docs only when needed
- auto-fill from known data, but force user confirmation
- save progress and allow return later

---

## 4) What you need in Europe

### Minimum viable studio verification gate
For a studio to publish jobs in Europe, Queue should treat the required bundle as:
1. **Owner / representative KYC**
   - legal name
   - DOB
   - government ID
   - selfie/liveness
   - sanctions/PEP screening recommended
2. **Business identity (KYB-lite at minimum)**
   - legal business name
   - country of incorporation / operation
   - registered address
   - business registration number
   - tax/VAT ID when applicable
   - legal form
   - proof the user is authorized to act for the business
3. **Payments readiness**
   - usable payment method to pay instructors
   - if payouts/merchant features are used later, full PSP-required business verification
4. **Operational trust**
   - studio location confirmed
   - primary branch confirmed
   - sport categories
   - contact phone/email

### Recommended next level for Europe
Add real **KYB / business verification**, not just self-declared fields:
- registry lookup / company register verification
- beneficial owner / UBO collection for company entities
- sanctions / PEP screening on owners + company when relevant
- proof of address / proof of registration fallback docs
- audit trail for who verified what and when

### Country differences that matter most
The exact identifiers differ by country, but the pattern is stable:
- **Germany:** Handelsregister, Transparency Register / UBO context, Steuernummer/VAT, legal form
- **France:** SIREN/SIRET, RCS/Kbis context, beneficial owner register access, VAT regime
- **Spain:** NIF/CIF, Registro Mercantil context, beneficial ownership context
- **Italy:** Partita IVA / Codice Fiscale + company registry context
- **Netherlands:** KvK extract + VAT/RSIN/UBO context
- **Portugal:** NIF/NIPC + commercial registry context
- **Ireland:** CRO number + tax/VAT context

Product implication: **country drives the required fields, labels, validation, and possibly document requests**.

---

## 5) Is Didit enough?
Didit clearly supports:
- ID verification
- liveness
- face match
- AML screening
- proof of address
- webhook-driven status sync
- country-conditional workflows

Evidence from Didit docs/search:
- workflow builder supports KYC + AML + PoA
- webhook/session statuses: Approved, Declined, In Review, In Progress, Abandoned, etc.
- backend-only AML / database validation nodes

But what you currently use is basically **owner KYC only**.

That means:
- good enough for “verify a human owns this account”
- **not enough** for robust European studio/business verification by itself
- you still need either:
  - a real KYB provider / business registry verification layer, or
  - a staged KYB-lite flow plus manual/risk-based review for higher-risk studios

---

## 6) Biggest product gaps right now
1. Wrong name and wrong mental model
2. No country auto-detection from saved studio location
3. Country system incomplete and dangerously wrong for unsupported countries
4. No real KYB / business proof
5. No explicit “authorized representative” concept
6. No beneficial owner / ownership path for company entities
7. No risk-based escalation model
8. Onboarding and profile verification flows are inconsistent
9. Israel-specific location/autocomplete assumptions remain in a Europe flow
10. “Business details complete” is too easy to satisfy

---

## 7) What to change first

### P0 — rename and clarify
- Rename tab to **Verification**
- Hero copy should say: **You can’t publish jobs until the studio owner is verified, business details are confirmed, and payments are ready.**
- Replace vague “publishing setup” language everywhere relevant.

### P0 — fix country foundation
- Persist studio country code from saved address/location
- extend structured location model to include ISO country code
- stop falling back to `IL` for unsupported countries
- stop restricting autocomplete/geocoding to Israel

### P1 — turn business details into real country-aware verification
- derive country from location, prefill billing country, require confirmation
- country-specific labels/validation for all supported EU markets
- support at least: DE, FR, ES, IT, NL, PT, IE, BE, AT

### P1 — model the accountable person properly
Add fields/state for:
- authorized representative
- owner vs company
- whether the verified Didit person matches the representative

### P1 — raise the bar for “business complete”
Do not mark complete from only name + tax ID + email.
Require at least:
- country
- legal business name
- legal entity type
- registration/tax number appropriate to country
- billing/registered address
- representative identity approved

### P2 — add KYB escalation
For company entities and/or higher-risk studios:
- registration proof
- UBO / ownership checks
- sanctions/PEP on rep + UBOs
- manual review fallback

---

## 8) Proposed product structure

### Rename
**Studio verification**

### Step 1 — Verify representative
- “Verify the studio owner or authorized representative”
- Didit KYC
- Show exact verified name and status

### Step 2 — Confirm business
- Auto-detect country from saved location
- Ask user to confirm or change
- Show country-specific fields
- Verify business registration data

### Step 3 — Set up payments
- Explain this is the payment method used to pay instructors
- show readiness and failure reasons clearly

### Optional Step 4 — Extra review
Only when needed:
- proof of registration
- proof of address
- ownership / UBO review

---

## 9) Suggested copy direction
Bad:
- “Publishing setup”
- “Business details” without explaining why

Better:
- **Verification**
- **Before you can publish jobs, we need to verify the person responsible for this studio, confirm the business details required in your country, and make sure payments are ready.**
- **Blocked from publishing:** owner verification / business verification / payments

---

## 10) Concrete code findings to act on
- `src/lib/google-places.ts` → hardcoded `il`
- `src/features/compliance/country-field-config.ts` → incomplete countries + `IL` fallback
- `src/lib/location-zone.ts` → structured location lacks country / isoCountryCode
- `src/app/onboarding/verification.tsx` → still positions studio verification as later/skippable
- `convex/compliance/studio.ts` → billing profile completion criteria too weak
- `convex/payments/studioActions.ts` → country defaults come from Stripe market default, not studio location
- `src/app/(app)/(studio-tabs)/studio/profile/index.tsx` + `src/components/sheets/profile/studio/studio-compliance-sheet.tsx` + `src/app/(app)/(studio-tabs)/studio/profile/compliance.tsx` → duplicated concepts and naming drift

---

## 11) Bottom line
The current tab is **supposed** to be the studio’s legal/trust gate for publishing jobs.

Right now it is:
- directionally correct in backend policy
- partially correct in UI structure
- weak in naming
- weak in European country handling
- weak in business verification depth

If Queue is serious about Europe, the next step is not polishing “publishing setup.”
It is building a proper **Studio Verification** system:
- representative KYC
- country-aware business verification
- payment readiness
- optional KYB escalation
- location-derived country detection
