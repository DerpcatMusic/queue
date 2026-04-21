# Convex Security Audit Framework
## Agent Configuration and Documentation References

---

## AGENT PROMPTS WITH SKILL INJECTION

Each agent should load these skills and fetch relevant documentation before auditing.

---

### AUDIT AGENT: auth-auditor

**SKILLS TO LOAD:**
- `convex-best-practices` - For function organization, validation, error handling patterns
- `convex-security-audit` - For authorization logic, data access, action isolation

**DOCUMENTATION TO FETCH:**
- https://docs.convex.dev/auth/functions-auth
- https://docs.convex.dev/functions/error-handling

**AUDIT TARGETS:**
- `/home/derpcat/projects/queue/convex/lib/auth.ts`
- `/home/derpcat/projects/queue/convex/lib/authDedupe*.ts`
- `/home/derpcat/projects/queue/convex/auth/magicLink.ts`
- `/home/derpcat/projects/queue/convex/auth/otp.ts`

**AUDIT CHECKLIST:**
1. Token identifier handling - verify tokenIdentifier never exposed
2. User lookup patterns - check timing attack vulnerabilities
3. Role validation - ensure roles checked before sensitive ops
4. Session termination - verify logout invalidates sessions
5. Deduplication logic - check race conditions in auth deduplication
6. Email normalization attacks - case sensitivity exploits

---

### AUDIT AGENT: payment-auditor

**SKILLS TO LOAD:**
- `convex-best-practices` - For function organization, validation
- `convex-security-audit` - For action isolation, sensitive operations

**DOCUMENTATION TO FETCH:**
- https://docs.convex.dev/production
- Stripe Connect documentation for platform payments

**AUDIT TARGETS:**
- `/home/derpcat/projects/queue/convex/integrations/stripe/config.ts`
- `/home/derpcat/projects/queue/convex/integrations/stripe/connect.ts`
- `/home/derpcat/projects/queue/convex/integrations/payment_provider.ts`
- `/home/derpcat/projects/queue/convex/lib/stripeIdentity.ts`
- `/home/derpcat/projects/queue/convex/jobs/settlement.ts`

**AUDIT CHECKLIST:**
1. API key exposure - are Stripe keys exposed in responses/logs?
2. Webhook verification - is webhook signature properly validated?
3. Connect account isolation - can funds be stolen between accounts?
4. Payment amount validation - can amounts be manipulated?
5. Idempotency - can payments be duplicated or lost?
6. Refund authorization - who can issue refunds?
7. Currency handling - are currencies properly validated?

---

### AUDIT AGENT: mutation-auditor

**SKILLS TO LOAD:**
- `convex-best-practices` - For query patterns, write conflicts, OCC
- `convex-security-audit` - For data access, action isolation

**DOCUMENTATION TO FETCH:**
- https://docs.convex.dev/error#1 - Write conflicts and OCC
- https://docs.convex.dev/functions/error-handling

**AUDIT TARGETS:**
All mutation files in:
- `/home/derpcat/projects/queue/convex/jobs/`
- `/home/derpcat/projects/queue/convex/compliance/`
- `/home/derpcat/projects/queue/convex/payments/`
- `/home/derpcat/projects/queue/convex/users/`

**AUDIT CHECKLIST:**
1. Non-idempotent mutations - can retries cause data corruption?
2. Race conditions - can concurrent calls bypass logic?
3. Read-then-write TOCTOU - can data change between read/write?
4. Ownership verification - are ownership checks done before patches?
5. Batch operation vulnerabilities - can batch ops be exploited?
6. Cascade deletion - can deletion affect others unexpectedly?
7. Patch without read safety - can patch target wrong records?
8. Transaction atomicity - are multi-step ops properly atomic?

---

### AUDIT AGENT: query-auditor

**SKILLS TO LOAD:**
- `convex-best-practices` - For query patterns, index usage
- `convex-security-audit` - For data access boundaries

**DOCUMENTATION TO FETCH:**
- https://docs.convex.dev/understanding/concepts - Data model concepts

**AUDIT TARGETS:**
All query files in:
- `/home/derpcat/projects/queue/convex/jobs/browse.ts`
- `/home/derpcat/projects/queue/convex/compliance/`
- `/home/derpcat/projects/queue/convex/instructors/`
- `/home/derpcat/projects/queue/convex/home/`

**AUDIT CHECKLIST:**
1. Missing ownership filters - can users see others' data?
2. Index-based enumeration - can data be scanned via index?
3. Pagination leaks - can pagination reveal total counts?
4. Filter bypass - can filters be circumvented?
5. Null handling - does null response leak existence?
6. Field exposure - are sensitive fields exposed in queries?
7. Cross-reference leaks - can related data be inferred?
8. Query timing attacks - can timing reveal data existence?

---

### AUDIT AGENT: rate-limit-auditor

**SKILLS TO LOAD:**
- `convex-best-practices`
- `convex-security-audit` - For rate limiting patterns

**DOCUMENTATION TO FETCH:**
- https://docs.convex.dev/production - Production security

**AUDIT TARGETS:**
- `/home/derpcat/projects/queue/convex/lib/rateLimitConfig.ts`
- `/home/derpcat/projects/queue/convex/lib/rateLimitFingerprint.ts`
- `/home/derpcat/projects/queue/convex/lib/rateLimitOperations.ts`

**AUDIT CHECKLIST:**
1. Rate limit bypass vectors - can users circumvent limits?
2. Fingerprint generation - is fingerprinting robust against spoofing?
3. Window management - are time windows properly enforced?
4. Storage race conditions - can limits be exceeded via parallel requests?
5. Config vulnerabilities - are limits configurable by untrusted sources?
6. Cost/weight of operations - do endpoints have appropriate limits?

---

## CRITICAL SECURITY PATTERNS TO FIND

### TOCTOU (Time-of-Check-Time-of-Use) Patterns
```typescript
// VULNERABLE: Check then use
const job = await ctx.db.get("jobs", jobId);
if (job.status !== "open") throw error;
await ctx.db.patch("jobs", jobId, { status: "filled" }); // TOCTOU!

// FIXED: Verify immediately before use
const freshJob = await ctx.db.get("jobs", jobId);
if (freshJob.status !== "open") throw error;
await ctx.db.patch("jobs", freshJob._id, { status: "filled" });
```

### Insecure Token Generation
```typescript
// VULNERABLE
const token = Math.random().toString(36);

// FIXED
import { randomUUID } from "crypto";
const token = randomUUID();
```

### Non-Idempotent Mutations
```typescript
// VULNERABLE: Insert without check
await ctx.db.insert("payments", { amount: args.amount });

// FIXED: Check existence first
const existing = await ctx.db.query("payments")
  .withIndex("by_job_id")
  .eq("jobId", args.jobId)
  .unique();
if (existing) return existing;
```

---

## VULNERABILITY OUTPUT FORMAT

For each vulnerability found:

```
FILE: [file path]
LINE: [line numbers]
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
CWE: [CWE identifier if applicable]
ISSUE: [one-line description]

DESCRIPTION:
[Detailed explanation of the vulnerability]

POC:
[Proof of concept - how to exploit]

FIX:
[Recommended fix with code example]
```

---

## HOLES OUTPUT FORMAT

For each missing security control:

```
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
CONTROL: [what's missing]
IMPACT: [what could happen]
RECOMMENDATION: [how to implement]
```

---

## TESTING COMMANDS

After fixes are applied, test with:

```bash
# Type check
npx convex functions --typescript

# Run tests
npx convex test

# Deploy to dev
npx convex dev
```