# Marketplace MVP Groundwork Plan

## 1) Product Scope (MVP)
Two-sided marketplace for Israel:
- `Studio` onboarding
- `Instructor` onboarding
- Studio posts one-time emergency shift
- Instructors in matching zone are notified
- First valid claim wins

Out of scope for MVP:
- Recurring schedules
- Ranking/reputation marketplace
- Full payroll ERP

## 2) Core Technical Direction
- Frontend: Expo Router (single mobile codebase)
- Backend: Convex (realtime matching + atomic claim mutation)
- Geo (simplified): Mapbox for maps + local zone IDs in app/backend
- Payments/KYC: integrate after matching loop is stable

Why this order: claim-race correctness and notification reliability are the highest-risk primitives.

## 3) Domain Model (initialized)
Tables added:
- `users`
- `instructorProfiles`
- `studioProfiles`
- `instructorZones`
- `jobs`
- `jobClaimEvents`
- `pushDevices`
- `notificationQueue`

Key behavior:
- `jobs.status` lifecycle: `open -> claimed|expired|cancelled|completed`
- Claim is atomic in Convex mutation
- Zone eligibility is validated at claim time
- Job `zoneId` is derived from `studioProfiles.zoneId` (not passed by job form)
- `createEmergencyJob` default `startsAt` is now + 30 minutes
- Numeric runtime guards enforce positive finite values for duration/payment/limits
- Notification queue is persisted (no fire-and-forget)

## 4) Delivery Phases
### Phase A: Foundation (now)
- Schema + core functions
- Onboarding mutations
- Create/list/claim job API
- Notification queue hooks

### Phase B: App Flows
- Role gate + onboarding screens
- Studio “post emergency job” form
- Instructor “open jobs in my zones” feed
- Claim button + optimistic UX

### Phase C: Push + Reliability
- Register Expo push tokens
- Worker/action to send queued notifications
- Retry policy + dead-letter handling
- Expiration sweep job

### Phase D: Payments/KYC (post-core)
- Provider sandbox integration
- KYC states in instructor profile
- Payout gating by verification status

## 5) Acceptance Criteria
- Two instructors claim same job within seconds: exactly one success
- Instructor outside zone cannot claim
- Expired job cannot be claimed
- Studio sees job status change live
- Instructor sees new open jobs live

## 6) Immediate Next Build Order
1. Connect app to Convex client and auth identity strategy.
2. Build onboarding screens calling `completeInstructorOnboarding` and `completeStudioOnboarding`.
3. Build studio job posting screen -> `createEmergencyJob`.
4. Build instructor jobs feed + claim CTA.
5. Add push dispatch worker from `notificationQueue`.

## 7) Risks to Watch Early
- Zone taxonomy drift between frontend polygons and backend `zoneId`
- Push timing race (job claimed before delivery)
- Duplicate zone links causing noisy notifications
- Compliance coupling for payments/invoices (Israel allocation-number workflow)
