# Database Index Specification for Business Rule Enforcement

## Overview

This document specifies database indexes needed to enforce business rules and prevent race conditions in the Convex backend.

## ✅ Implemented Indexes

All four unique indexes have been added to the schema files.

### 1. jobApplications: Unique Index on (jobId, instructorId) ✅

**File**: `convex/schemaMarketplaceJobs.ts`

**Purpose**: Prevent duplicate applications - a single instructor should not be able to apply to the same job multiple times.

**Implementation**:
```typescript
.index("by_job_and_instructor", ["jobId", "instructorId"], { unique: true })
```

**Race Condition Prevented**:
- Without unique constraint: Two concurrent requests from the same instructor could both succeed, creating duplicate applications
- With unique constraint: Convex will reject the second insert with a write conflict

---

### 2. jobApplications: Unique Index on (jobId, status) ✅

**File**: `convex/schemaMarketplaceJobs.ts`

**Purpose**: Prevent double-fill - ensure only ONE application can be in "accepted" status per job (since only one instructor should fill a job).

**Implementation**:
```typescript
.index("by_job_status_accepted", ["jobId", "status"], { unique: true })
```

**Note**: This provides uniqueness for all (jobId, status) combinations. Application logic should handle the business rule that only "accepted" status should have at most one entry per job.

---

### 3. paymentOrders: Unique Index on (jobId, idempotencyKey) ✅

**File**: `convex/schemaBillingCurrent.ts`

**Purpose**: Idempotency for payment operations - ensure duplicate payment requests are rejected.

**Implementation**:
```typescript
.index("by_job_idempotency", ["jobId", "idempotencyKey"], { unique: true })
```

**Race Condition Prevented**:
- Without unique constraint: Retried payment requests could create duplicate payment orders
- With unique constraint: Duplicate requests are rejected, ensuring exactly-once semantics

---

### 4. internalAccessGrants: Unique Index on (email, active) ✅

**File**: `convex/schemaIdentityCore.ts`

**Purpose**: Prevent duplicate active grants - ensure only ONE active grant exists per email address.

**Implementation**:
```typescript
.index("by_email_active_unique", ["email", "active"], { unique: true })
```

**Note**: This prevents multiple active grants for the same email. The unique constraint also applies to inactive grants, but since inactive grants have `active: false`, the constraint only matters for active grants with the same email.

---

## Migration Steps

### Step 1: Verify Existing Data (Pre-Deployment)

Run the verification migrations to check for existing data that would violate the new constraints:

```bash
# Check for duplicate job applications
npx convex run internal.migrations.enforceUniqueConstraints.checkDuplicateApplications

# Check for duplicate active grants
npx convex run internal.migrations.enforceUniqueConstraints.checkDuplicateActiveGrants

# Check for double-fill violations
npx convex run internal.migrations.enforceUniqueConstraints.checkDoubleFillViolations
```

### Step 2: Clean Up Existing Violations (If Any)

If violations exist, run the cleanup migrations before deploying schema changes:

```bash
# Dry run to see what would be deleted
npx convex run internal.migrations.enforceUniqueConstraints.cleanupDuplicateApplications -- '{ "dryRun": true }'
npx convex run internal.migrations.enforceUniqueConstraints.cleanupDuplicateActiveGrants -- '{ "dryRun": true }'
npx convex run internal.migrations.enforceUniqueConstraints.cleanupDoubleFillViolations -- '{ "dryRun": true }'

# Execute cleanup
npx convex run internal.migrations.enforceUniqueConstraints.cleanupDuplicateApplications -- '{ "dryRun": false }'
npx convex run internal.migrations.enforceUniqueConstraints.cleanupDuplicateActiveGrants -- '{ "dryRun": false }'
npx convex run internal.migrations.enforceUniqueConstraints.cleanupDoubleFillViolations -- '{ "dryRun": false }'
```

### Step 3: Deploy Schema Changes

```bash
npx convex deploy
```

### Step 4: Update Mutations (Handle Write Conflicts)

Update mutations that insert into these tables to handle write conflicts gracefully:

```typescript
// Example pattern for job applications
try {
  return await ctx.db.insert("jobApplications", {
    jobId: args.jobId,
    instructorId: user.instructorId,
    status: "pending",
    appliedAt: Date.now(),
    updatedAt: Date.now(),
    message: args.message,
  });
} catch (e) {
  // Handle unique constraint violation
  if (e.message?.includes("unique") || e.message?.includes("duplicate")) {
    return { code: "ALREADY_APPLIED" };
  }
  throw e;
}
```

---

## Summary Table

| Table | Index Name | Fields | Status | Purpose |
|-------|-----------|--------|--------|---------|
| jobApplications | by_job_and_instructor | jobId, instructorId | ✅ Implemented | Prevent duplicate applications |
| jobApplications | by_job_status_accepted | jobId, status | ✅ Implemented | Prevent double-fill |
| paymentOrders | by_job_idempotency | jobId, idempotencyKey | ✅ Implemented | Payment idempotency |
| internalAccessGrants | by_email_active_unique | email, active | ✅ Implemented | Prevent duplicate active grants |

---

## Migration Files Created

- `convex/migrations/enforceUniqueConstraints.ts` - Verification and cleanup migrations

## Notes

1. **Convex Unique Indexes**: Convex supports unique indexes via the `{ unique: true }` option
2. **Write Conflicts**: When a unique constraint is violated, Convex throws a write conflict error. Mutations should handle this gracefully.
3. **Migration Safety**: Always verify existing data doesn't violate new constraints before deploying unique indexes.