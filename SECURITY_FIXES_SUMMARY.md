# Security Audit + Application Limit Fix + Token Generation Fix

**Date:** 2026-04-18  
**Changes Made:**

---

## ✅ FIXES APPLIED

### 1. CRITICAL: Insecure Token Generation (Math.random → nanoid)

**Files Fixed:**
- `convex/lib/secureToken.ts` - New secure token module using `nanoid` with `"use node"`
- `convex/users/profileImage.ts` - Updated to use `createSecureUploadToken`
- `convex/compliance/instructorShared.ts` - Updated to use secure token generator

**Before:**
```typescript
// VULNERABLE - Math.random() is predictable!
function createUploadSessionToken(userId, now) {
  const entropy = Math.random().toString(36).slice(2, 12);
  return `${userId}:${now}:${entropy}`;
}
```

**After:**
```typescript
// SECURE - Using nanoid for cryptographic randomness
import { customAlphabet } from "nanoid";
const generateSecureId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

export function createSecureUploadToken(userId: string, now: number): string {
  const entropy = generateSecureId();
  return `${userId}:${now}:${entropy}`;
}
```

---

### 2. CRITICAL: TOCTOU Race Conditions in Application Flow

**Files Fixed:**
- `convex/jobs/applicationMutations.ts`
- `convex/jobs/reviewMutations.ts`

**Changes:**
1. Added `MAX_CONCURRENT_APPLICATIONS = 3` constant
2. Added helper functions for atomic operations:
   - `getActiveApplicationCountAtomic()` - Gets count atomically
   - `verifyJobStatusForApplication()` - Re-verifies job status before mutations
   - `verifyCancellationDeadline()` - Re-checks deadline before patch
3. Added final re-check before status changes (TOCTOU prevention)
4. Auto-accept mode: Job immediately closes when instructor applies
5. Studio-chooses mode: Max 3 concurrent applicants, studio selects

**Logic:**
```
AUTO-ACCEPT MODE (studio.autoAcceptEnabled = true):
- Instructor applies → immediately accepted
- Job immediately closed (status = "filled")
- Other pending applications rejected

STUDIO-CHOOSES MODE (default):
- Max 3 concurrent applicants allowed
- Studio reviews and accepts one
- Other applicants rejected when job filled
- If max reached, new applications rejected with message
```

---

### 3. CRITICAL: Bootstrap Token Security + Test Admin Management

**File Fixed:** `convex/internal/access.ts`

**Changes:**
1. Added `TEST_ADMIN_EMAILS` environment variable support
2. Added `MAX_TEST_ADMIN_COUNT = 5` limit
3. Added audit logging for all bootstrap operations
4. Added new query/mutation for test admin management:
   - `listTestAdminEmails` - View configured test admins
   - `addTestAdminEmail` - Add test admin (with token validation)
   - `removeTestAdminEmail` - Remove test admin

**Environment Variables:**
```
# Bootstrap token (required for all bootstrap operations)
INTERNAL_ACCESS_BOOTSTRAP_TOKEN=your-secure-token

# Optional: comma-separated list of test admin emails
TEST_ADMIN_EMAILS=admin@test.com,dev@test.com
```

---

## 📁 FILES MODIFIED

| File | Change |
|------|--------|
| `convex/lib/secureToken.ts` | NEW - Secure token generation module |
| `convex/users/profileImage.ts` | Fixed Math.random → nanoid |
| `convex/compliance/instructorShared.ts` | Fixed Math.random → nanoid |
| `convex/jobs/applicationMutations.ts` | Max 3 limit, TOCTOU fixes, auto-accept logic |
| `convex/jobs/reviewMutations.ts` | TOCTOU prevention before job patch |
| `convex/internal/access.ts` | Test admin management, audit logging |

---

## 🔒 AUDIT FRAMEWORK CREATED

Created `/home/derpcat/projects/queue/.agents/audit-framework/AGENT_CONFIGS.md` with:

- 20 pre-configured audit agents with skills and documentation references
- Audit checklists for each security area
- Vulnerability output format
- TOCTOU patterns and fixes
- Testing commands

---

## 📊 SECURITY IMPROVEMENTS

| Vulnerability | Severity | Status |
|---------------|----------|--------|
| Math.random() token generation | CRITICAL | ✅ FIXED |
| TOCTOU in application limit | CRITICAL | ✅ FIXED |
| TOCTOU in job acceptance | CRITICAL | ✅ FIXED |
| TOCTOU in auto-accept | CRITICAL | ✅ FIXED |
| Bootstrap token single point | CRITICAL | ✅ FIXED |
| Missing test admin controls | HIGH | ✅ FIXED |

---

## 📈 NEW BUSINESS LOGIC

### Application Flow

```
MAX 3 CONCURRENT APPLICANTS (unless auto-accept)

┌─────────────────────────────────────────────────────┐
│ INSTRUCTOR APPLIES                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Check job status (re-verify)                       │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────────────────────────────┐   │
│  │ IS AUTO-ACCEPT ENABLED?                      │   │
│  └──────────────────────────────────────────────┘   │
│         │                    │                      │
│        YES                   NO                     │
│         │                    │                      │
│         ▼                    ▼                      │
│  ┌─────────────┐    ┌─────────────────────┐        │
│  │ ACCEPT      │    │ CHECK COUNT < 3      │        │
│  │ IMMEDIATELY │    └─────────────────────┘        │
│  │             │           │                       │
│  │ CLOSE JOB   │           ▼                       │
│  │ REJECT      │    ┌─────────────────────┐        │
│  │ OTHERS      │    │ COUNT >= 3?         │        │
│  └─────────────┘    └─────────────────────┘        │
│                          │                          │
│                         YES                         │
│                          │                          │
│                          ▼                          │
│                   ┌─────────────┐                  │
│                   │ REJECT WITH │                  │
│                   │ "MAX REACHED"│                  │
│                   └─────────────┘                  │
└─────────────────────────────────────────────────────┘

STUDIO CHOOSES:
┌─────────────────────────────────────────────────────┐
│ STUDIO RECEIVES UP TO 3 APPLICATIONS                 │
│                                                     │
│ Studio reviews applications                         │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────────────────────────┐       │
│  │ STUDIO ACCEPTS ONE APPLICATION           │       │
│  └──────────────────────────────────────────┘       │
│         │                                           │
│         ▼                                           │
│  Job status → "filled"                              │
│  Other applications → "rejected"                    │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 TESTING

```bash
# Type check
npx convex codegen

# Deploy to dev
npx convex dev

# Test application flow:
# 1. Create job (autoAcceptEnabled: false)
# 2. Apply with 3 instructors (should all succeed)
# 3. 4th instructor should get "MAX REACHED" error
# 4. Studio accepts one → job filled, others rejected
```

---

## 📝 REMAINING SECURITY ITEMS (from audit)

See full report: `/home/derpcat/projects/queue/SECURITY_AUDIT_REPORT.md`

### P0 - Immediate (next 24hrs)
- [x] Replace Math.random() with crypto (DONE)
- [x] Add TOCTOU re-checks before patches (DONE)
- [ ] Add idempotency keys to payment mutations

### P1 - This Week
- [ ] Add unique indexes for business rules
- [ ] Implement mutation audit logging
- [ ] Add device/IP rate limiting

### P2 - This Month
- [ ] Implement optimistic locking for business rules
- [ ] Add production guard to migrations
- [ ] Standardize error code format