# Instructor Compliance Scope: "Look Don't Touch"

## Goal

Unverified instructors should be able to:

- sign in
- complete onboarding
- browse the app
- view jobs
- view studios
- manage profile data

Unverified instructors should not be able to:

- apply to jobs
- auto-accept jobs
- be accepted by a studio into a job

This must be enforced server-side in Convex, not only in the UI.

## Current Repo Reality

- Identity verification already exists through Didit and is stored on `instructorProfiles`.
- Job eligibility currently means only sport/zone coverage.
- Job application and studio acceptance do not check Didit, insurance, certification, or any unified compliance state.
- There is no model yet for:
  - teaching certification documents (`תעודת הסמכה`)
  - third-party liability insurance (`ביטוח צד ג׳`)
  - AI review of uploaded documents
  - insurance expiry reminders
  - a real admin/compliance override flag on the user

Relevant current files:

- [convex/schema.ts](/home/derpcat/projects/queue/convex/schema.ts)
- [convex/didit.ts](/home/derpcat/projects/queue/convex/didit.ts)
- [convex/jobs.ts](/home/derpcat/projects/queue/convex/jobs.ts)
- [convex/lib/instructorEligibility.ts](/home/derpcat/projects/queue/convex/lib/instructorEligibility.ts)
- [convex/crons.ts](/home/derpcat/projects/queue/convex/crons.ts)
- [convex/resendMagicLink.ts](/home/derpcat/projects/queue/convex/resendMagicLink.ts)

## Recommended Architecture

Do not force everything into one physical table.

Use one unified decision layer, backed by separate domain records:

1. Didit identity state
2. Teaching certification state per sport
3. Insurance state per instructor
4. Optional admin override

The unification should happen in one new backend module:

- `convex/lib/instructorCompliance.ts`

That module should return one derived object:

```ts
type InstructorComplianceDecision = {
  canBrowse: boolean;
  canApplyToJobs: boolean;
  canBeAcceptedForJobs: boolean;
  isFullyVerified: boolean;
  blockingReasons: string[];
  diditStatus: "approved" | "pending" | "missing" | "failed";
  insuranceStatus: "approved" | "pending" | "missing" | "expired" | "failed";
  sportCertification: Record<string, "approved" | "pending" | "missing" | "failed">;
  overrideActive: boolean;
};
```

## Data Model

### Keep

- `instructorProfiles.diditVerificationStatus`

### Add

`users`

- `isPlatformAdmin?: boolean`
- `complianceOverride?: "none" | "allow_job_actions"`
- `complianceOverrideReason?: string`
- `complianceOverrideUpdatedAt?: number`

`instructorCertificates`

- `instructorId`
- `sport`
- `storageId`
- `fileName`
- `mimeType`
- `uploadedAt`
- `reviewStatus` = `uploaded | ai_pending | ai_reviewing | approved | rejected | needs_resubmission`
- `reviewProvider` = `gemini`
- `reviewSummary?`
- `reviewJson?`
- `reviewedAt?`
- `rejectionReasons?`

Public marketplace projection for approved certificates:

- `issuerName`
- `certificateTitle`
- `sport`

`instructorInsurancePolicies`

- `instructorId`
- `storageId`
- `fileName`
- `mimeType`
- `uploadedAt`
- `expiresOn` as `YYYY-MM-DD`
- `expiresAt` as normalized timestamp
- `reviewStatus` = `uploaded | ai_pending | ai_reviewing | approved | rejected | expired | needs_resubmission`
- `reviewProvider` = `gemini`
- `reviewSummary?`
- `reviewJson?`
- `reviewedAt?`
- `firstReminderSentAt?`
- `finalReminderSentAt?`
- `expiredNoticeSentAt?`

## Enforcement Rules

`canBrowse`

- always `true` for authenticated instructors with an active account

`canApplyToJobs`

- `diditVerificationStatus === "approved"`
- active insurance is `approved` and not expired
- certification for the job sport is `approved`
- or admin/compliance override is active

`canBeAcceptedForJobs`

- same rule as `canApplyToJobs`

This must be checked in both places:

- [convex/jobs.ts](/home/derpcat/projects/queue/convex/jobs.ts) `applyToJob`
- [convex/jobs.ts](/home/derpcat/projects/queue/convex/jobs.ts) `reviewApplication`

Reason: today `applyToJob` can auto-accept, and `reviewApplication` can accept a previously submitted application. Both paths must enforce the same decision.

## Upload + AI Review Flow

1. Instructor uploads a certificate or insurance document.
2. Convex stores the raw file in `_storage`.
3. Backend creates a document row with `ai_pending`.
4. Convex action sends normalized document content to Gemini.
5. Gemini returns:
   - document type match
   - readable/not readable
   - extracted expiry date for insurance
   - extracted sport or instructor name where possible
   - pass/fail/confidence/reasoning
6. Backend writes the structured result back to the row.
7. `instructorCompliance.ts` recomputes decision state from the latest approved records.

Important implementation note:

- Do not make job gating depend on parsing provider prose.
- Persist normalized review status and extracted fields in your own schema.
- For PDFs, normalize them into reviewable image/page inputs before AI review rather than treating the provider response as the source of truth.
- Keep raw certificate files internal; expose only approved issuer/title metadata publicly.

## Cron Jobs

Add daily compliance crons in [convex/crons.ts](/home/derpcat/projects/queue/convex/crons.ts):

- `send insurance 30 day reminders`
- `send insurance 7 day reminders`
- `mark expired insurance`
- `send expired insurance notices`

Each cron should query approved insurance rows and use sent-at fields so reminders are idempotent.

When insurance expires:

- mark the insurance row `expired`
- recompute compliance
- immediately block `canApplyToJobs`
- require a new upload and fresh AI review

## UI Scope

Phase 1 UI should stay small:

- keep jobs visible
- disable job action buttons when `canApplyToJobs === false`
- show one clear blocker banner with reasons
- expand the profile identity area into a broader "Compliance" surface later

Do not gate whole tabs or route access in phase 1.

## Admin Toggle Through CMD

Do not use fake users.

Use real users plus a platform-level override that can be toggled from the command line through a Convex mutation, for example:

- `admin.setInstructorComplianceOverride`

That mutation should:

- require `isPlatformAdmin`
- target a real user or instructor
- set override mode and reason
- never mutate Didit or document history

This should come after the unified compliance layer exists. Otherwise you will be bypassing a system that has not been defined yet.

## Recommended Rollout

### Phase 1: Groundwork

- add new schema tables
- add generic document upload flow
- add `instructorCompliance.ts`
- enforce compliance in `applyToJob` and `reviewApplication`
- expose one query for the app to read blocker reasons

### Phase 2: Insurance Automation

- add AI review action for insurance
- add expiry fields and reminder crons
- send reminder emails through existing Resend infrastructure

### Phase 3: Certification Automation

- add per-sport certificate upload + AI review
- require approved certificate for the sport attached to the job

### Phase 4: Admin CMD Override

- add platform admin flag
- add CLI-callable override mutation
- add audit logging around overrides

## Open Question

I could not find an actual TOS/legal file in this repo that defines the insurance requirement. For implementation, the current scope assumes your business rule is:

- instructors need valid third-party liability insurance
- expired insurance blocks job actions
- re-upload requires fresh AI approval

If the legal wording differs, the compliance statuses should stay the same and only the copy/rules around acceptable documents should change.
