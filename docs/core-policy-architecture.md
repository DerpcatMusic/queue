# Core Policy Architecture

## Why

The product has three different kinds of rules:

1. Marketplace flow rules
2. Compliance rules
3. Billing and settlement rules

When these are mixed inside job, payment, onboarding, and profile files, the system becomes hard
to change safely.

## Who Owns What

### `convex/policy/marketplace.ts`

Owns:

- who can post jobs
- who can apply / accept / check in / complete
- offer capacity rules
- lesson state transitions that depend on marketplace behavior

This module should be the first stop for all job lifecycle entry points.

### `convex/policy/compliance.ts`

Owns:

- studio publishing eligibility
- instructor job-access eligibility
- instructor trust snapshots for studio review surfaces

This module translates verification state into marketplace decisions.

### `convex/policy/billing.ts`

Owns:

- whether a studio actually has a usable payment method
- whether a studio is financially blocked
- job billing defaults
- settlement state creation and transitions
- overdue suspension and release

This module translates Stripe/payment state into business state.

## Extension Rule

New business requirements should plug in by policy layer:

- compliance change -> `policy/compliance.ts`
- payment timing / overdue / suspension change -> `policy/billing.ts`
- posting/apply/accept/check-in/complete behavior change -> `policy/marketplace.ts`

Do not put new business law directly into:

- `jobs/*.ts`
- `payments/*.ts`
- profile UI files
- onboarding files

Those files should call policy modules, not define policy.

## Current Entry Points Using Policy

- `jobs/postJob.ts`
- `jobs/applications.ts`
- `jobs/review.ts`
- `jobs/checkIn.ts`
- `jobs/lessonCompletion.ts`
- `payments/mutations.ts`

## Remaining Refactor Targets

- move more browse/filter eligibility shaping onto `policy/compliance.ts`
- move studio-facing payment readiness projection onto `policy/billing.ts`
- reduce direct reads of settlement tables outside `policy/billing.ts`
- split remaining large payment mutation branches into provider-sync vs business-state modules
