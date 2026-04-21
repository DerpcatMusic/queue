# Mutation Audit Logging Implementation

## Overview

This document describes the audit logging system implemented for critical operations in the Convex application. The system provides comprehensive tracking of sensitive mutations for security and compliance purposes.

## Components

### 1. Schema (`schemaAudit.ts`)

Defines the `internalAuditLogs` table with the following structure:

```typescript
internalAuditLogs: {
  // Action type
  action: "role_switch" | "role_set" | "application_accepted" | 
          "application_rejected" | "job_cancelled_by_studio" | 
          "job_cancelled_by_instructor" | "payment_offer_created" | 
          "payment_order_created" | "internal_access_grant" | 
          "internal_access_revoke"
  
  // Actor (who performed the action)
  actorId?: Id<"users">
  actorEmail?: string
  actorRole?: "pending" | "instructor" | "studio"
  
  // Target (what was affected)
  targetType?: "user" | "job" | "application" | "payment_offer" | 
               "payment_order" | "internal_access"
  targetId?: string
  
  // Contextual metadata
  metadata?: {
    previousRole?: string
    newRole?: string
    jobId?: Id<"jobs">
    instructorId?: Id<"instructorProfiles">
    studioId?: Id<"studioProfiles">
    applicationId?: Id<"jobApplications">
    offerId?: Id<"paymentOffers">
    orderId?: Id<"paymentOrders">
    amountAgorot?: number
    grantedRole?: string
    targetUserId?: Id<"users">
    targetEmail?: string
    cancellationReason?: string
    description?: string
  }
  
  // Result
  result: "success" | "failure"
  errorMessage?: string
  
  // Request context
  ipAddress?: string
  userAgent?: string
  
  // Timestamps
  timestamp: number
  createdAt: number
}
```

**Indexes:**
- `by_action` - Query by action type
- `by_actor` - Query by actor (user)
- `by_target` - Query by target type and ID
- `by_timestamp` - Query by time
- `by_result` - Query by result (success/failure)
- `by_action_timestamp` - Query by action and time

### 2. Audit Library (`lib/audit.ts`)

Provides:

#### Internal Mutation
- `logAuditEvent` - Core internal mutation for logging audit events

#### Helper Functions
- `auditRoleSwitch(ctx, args)` - Log role switches
- `auditApplicationReview(ctx, args)` - Log application acceptances/rejections
- `auditJobCancellation(ctx, args)` - Log job cancellations
- `auditPaymentOfferCreated(ctx, args)` - Log payment offer creation
- `auditPaymentOrderCreated(ctx, args)` - Log payment order creation
- `auditInternalAccessChange(ctx, args)` - Log internal access grants/revokes

#### Query (Admin Only)
- `listAuditLogs(ctx, args)` - Query audit logs with filters

## Operations Now Audited

### 1. Role Management (`users/roleManagement.ts`)

**Mutations:**
- `setMyRole` - Sets user's role
- `switchActiveRole` - Switches between owned roles

**Audit Events:**
- `role_set` / `role_switch`
- Captures: previous role, new role, actor details

### 2. Job Review (`jobs/reviewMutations.ts`)

**Mutations:**
- `reviewApplication` - Accepts or rejects job applications

**Audit Events:**
- `application_accepted`
- `application_rejected`
- Captures: job, application, studio, instructor details

### 3. Job Cancellation (`jobs/cancellationStudio.ts`, `jobs/cancellationInstructor.ts`)

**Mutations:**
- `cancelFilledJob` - Studio cancels a job
- `cancelMyBooking` - Instructor cancels their booking

**Audit Events:**
- `job_cancelled_by_studio`
- `job_cancelled_by_instructor`
- Captures: job, studio, instructor, cancellation reason

### 4. Payment Operations (`payments/paymentOrderMutations.ts`)

**Mutations:**
- `createPaymentOffer` - Creates a payment offer
- `createPaymentOrder` - Creates a payment order

**Audit Events:**
- `payment_offer_created`
- `payment_order_created`
- Captures: offer/order details, amount, instructor, studio

### 5. Internal Access (`internal/access.ts`)

**Mutations:**
- `setInternalAccessGrant` - Admin grants/revokes internal access
- `setInternalAccessGrantWithAccessToken` - Bootstrap token grants
- `setVerificationBypassForUser` - Enables/disables verification bypass

**Audit Events:**
- `internal_access_grant`
- `internal_access_revoke`
- Captures: granted role, target user/email, actor details

## Usage in Mutations

### Basic Pattern

```typescript
import { auditRoleSwitch } from "../lib/audit";

// In your mutation handler:
export const myMutation = mutation({
  args: { /* ... */ },
  returns: /* ... */,
  handler: async (ctx, args) => {
    // ... your logic ...
    
    // On success:
    await auditRoleSwitch(ctx, {
      user: { _id: user._id, email: user.email, role: user.role },
      previousRole: previousRole,
      newRole: newRole,
    });
    
    return result;
  },
});
```

### Adding to New Mutations

To add audit logging to a new mutation:

1. Import the appropriate helper:
   ```typescript
   import { auditRoleSwitch } from "../lib/audit";
   ```

2. Call the helper after successful operations:
   ```typescript
   await auditRoleSwitch(ctx, {
     user: { _id: user._id, email: user.email, role: user.role },
     previousRole: "old_role",
     newRole: "new_role",
   });
   ```

3. Call the helper on failures (optional but recommended):
   ```typescript
   await auditRoleSwitch(ctx, {
     user: { _id: user._id, email: user.email, role: user.role },
     previousRole: previousRole,
     newRole: newRole,
     errorMessage: "Reason for failure",
   });
   ```

## Internal Tester Query

Internal testers can query audit logs using:

```typescript
import { listAuditLogs } from "../lib/audit";

// In an internal tester query:
const logs = await listAuditLogs(ctx, {
  action: "role_switch",  // optional filter
  actorId: userId,         // optional filter
  limit: 100,              // optional, default 100
});
```

## Security Considerations

1. **Non-blocking**: Audit logging failures don't break the main operation
2. **Fallback**: Console logging if database insert fails
3. **Sensitive Data**: Only logs IDs and role changes, not full documents
4. **Access Control**: Audit log query requires internal tester access

## Files Modified

- `schema.ts` - Added audit table to schema
- `schemaAudit.ts` - New file with audit table definition
- `lib/audit.ts` - New file with audit helper functions
- `users/roleManagement.ts` - Added audit logging
- `jobs/reviewMutations.ts` - Added audit logging
- `jobs/cancellationStudio.ts` - Added audit logging
- `jobs/cancellationInstructor.ts` - Added audit logging
- `payments/paymentOrderMutations.ts` - Added audit logging
- `internal/access.ts` - Added audit logging, replaced old logging function
