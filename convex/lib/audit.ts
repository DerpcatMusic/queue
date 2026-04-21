/**
 * Audit logging utilities for critical operations.
 * 
 * This module provides:
 * - Internal mutation for logging audit events
 * - Helper functions for common audit scenarios
 * - Type-safe audit event creation
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// ============================================
// Types
// ============================================

export type AuditAction = 
  | "role_switch"
  | "role_set"
  | "application_accepted"
  | "application_rejected"
  | "job_cancelled_by_studio"
  | "job_cancelled_by_instructor"
  | "payment_offer_created"
  | "payment_order_created"
  | "internal_access_grant"
  | "internal_access_revoke";

export type AuditTargetType = 
  | "user"
  | "job"
  | "application"
  | "payment_offer"
  | "payment_order"
  | "internal_access";

export type AuditResult = "success" | "failure";

export interface AuditLogEntry {
  action: AuditAction;
  actorId?: Id<"users">;
  actorEmail?: string;
  actorRole?: "pending" | "instructor" | "studio";
  targetType?: AuditTargetType;
  targetId?: string;
  metadata?: {
    previousRole?: string;
    newRole?: string;
    jobId?: Id<"jobs">;
    instructorId?: Id<"instructorProfiles">;
    studioId?: Id<"studioProfiles">;
    applicationId?: Id<"jobApplications">;
    offerId?: Id<"paymentOffers">;
    orderId?: Id<"paymentOrders">;
    amountAgorot?: number;
    grantedRole?: string;
    targetUserId?: Id<"users">;
    targetEmail?: string;
    cancellationReason?: string;
    description?: string;
  };
  result: AuditResult;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: number;
}

// ============================================
// Internal Mutation: Log Audit Event
// ============================================

export const logAuditEvent = internalMutation({
  args: {
    action: v.union(
      v.literal("role_switch"),
      v.literal("role_set"),
      v.literal("application_accepted"),
      v.literal("application_rejected"),
      v.literal("job_cancelled_by_studio"),
      v.literal("job_cancelled_by_instructor"),
      v.literal("payment_offer_created"),
      v.literal("payment_order_created"),
      v.literal("internal_access_grant"),
      v.literal("internal_access_revoke"),
    ),
    actorId: v.optional(v.id("users")),
    actorEmail: v.optional(v.string()),
    actorRole: v.optional(v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio"))),
    targetType: v.optional(v.union(
      v.literal("user"),
      v.literal("job"),
      v.literal("application"),
      v.literal("payment_offer"),
      v.literal("payment_order"),
      v.literal("internal_access"),
    )),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.object({
      previousRole: v.optional(v.string()),
      newRole: v.optional(v.string()),
      jobId: v.optional(v.id("jobs")),
      instructorId: v.optional(v.id("instructorProfiles")),
      studioId: v.optional(v.id("studioProfiles")),
      applicationId: v.optional(v.id("jobApplications")),
      offerId: v.optional(v.id("paymentOffers")),
      orderId: v.optional(v.id("paymentOrders")),
      amountAgorot: v.optional(v.number()),
      grantedRole: v.optional(v.string()),
      targetUserId: v.optional(v.id("users")),
      targetEmail: v.optional(v.string()),
      cancellationReason: v.optional(v.string()),
      description: v.optional(v.string()),
    })),
    result: v.union(v.literal("success"), v.literal("failure")),
    errorMessage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.id("internalAuditLogs"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Wrap in try/catch to prevent audit logging failures from breaking operations
    try {
      return await ctx.db.insert("internalAuditLogs", {
        ...args,
        timestamp: now,
        createdAt: now,
      });
    } catch (error) {
      // Fallback to console logging if database insert fails
      console.error("[AUDIT LOG ERROR]", JSON.stringify({
        ...args,
        timestamp: now,
        error: error instanceof Error ? error.message : String(error),
      }));
      // Return a dummy ID (this won't be used since we're logging to console)
      return "audit_log_error" as Id<"internalAuditLogs">;
    }
  },
});

// ============================================
// Helper Functions for Common Audit Scenarios
// ============================================

/**
 * Log a role switch event
 */
export async function auditRoleSwitch(
  ctx: MutationCtx,
  args: {
    user: { _id: Id<"users">; email?: string; role: string };
    previousRole: string;
    newRole: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await ctx.runMutation(internal.lib.audit.logAuditEvent, {
    action: args.user.role !== args.previousRole ? "role_set" : "role_switch",
    actorId: args.user._id,
    actorEmail: args.user.email,
    actorRole: args.user.role as "pending" | "instructor" | "studio",
    targetType: "user",
    targetId: args.user._id,
    metadata: {
      previousRole: args.previousRole,
      newRole: args.newRole,
      description: `Role changed from ${args.previousRole} to ${args.newRole}`,
    },
    result: "success",
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
}

/**
 * Log a job application acceptance/rejection
 */
export async function auditApplicationReview(
  ctx: MutationCtx,
  args: {
    actor: { _id: Id<"users">; email?: string; role: string };
    applicationId: Id<"jobApplications">;
    jobId: Id<"jobs">;
    studioId: Id<"studioProfiles">;
    instructorId: Id<"instructorProfiles">;
    status: "accepted" | "rejected";
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await ctx.runMutation(internal.lib.audit.logAuditEvent, {
    action: args.status === "accepted" ? "application_accepted" : "application_rejected",
    actorId: args.actor._id,
    actorEmail: args.actor.email,
    actorRole: args.actor.role as "pending" | "instructor" | "studio",
    targetType: "application",
    targetId: args.applicationId,
    metadata: {
      applicationId: args.applicationId,
      jobId: args.jobId,
      studioId: args.studioId,
      instructorId: args.instructorId,
      description: `Application ${args.status} for job ${args.jobId}`,
    },
    result: args.success ? "success" : "failure",
    errorMessage: args.errorMessage,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
}

/**
 * Log a job cancellation
 */
export async function auditJobCancellation(
  ctx: MutationCtx,
  args: {
    actor: { _id: Id<"users">; email?: string; role: string };
    jobId: Id<"jobs">;
    studioId: Id<"studioProfiles">;
    instructorId?: Id<"instructorProfiles">;
    cancelledBy: "studio" | "instructor";
    reason?: string;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await ctx.runMutation(internal.lib.audit.logAuditEvent, {
    action: args.cancelledBy === "studio" ? "job_cancelled_by_studio" : "job_cancelled_by_instructor",
    actorId: args.actor._id,
    actorEmail: args.actor.email,
    actorRole: args.actor.role as "pending" | "instructor" | "studio",
    targetType: "job",
    targetId: args.jobId,
    metadata: {
      jobId: args.jobId,
      studioId: args.studioId,
      instructorId: args.instructorId,
      cancellationReason: args.reason,
      description: `Job ${args.jobId} cancelled by ${args.cancelledBy}`,
    },
    result: args.success ? "success" : "failure",
    errorMessage: args.errorMessage,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
}

/**
 * Log payment offer creation
 */
export async function auditPaymentOfferCreated(
  ctx: MutationCtx,
  args: {
    actor: { _id: Id<"users">; email?: string; role: string };
    offerId: Id<"paymentOffers">;
    jobId: Id<"jobs">;
    studioId: Id<"studioProfiles">;
    instructorId: Id<"instructorProfiles">;
    amountAgorot: number;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await ctx.runMutation(internal.lib.audit.logAuditEvent, {
    action: "payment_offer_created",
    actorId: args.actor._id,
    actorEmail: args.actor.email,
    actorRole: args.actor.role as "pending" | "instructor" | "studio",
    targetType: "payment_offer",
    targetId: args.offerId,
    metadata: {
      offerId: args.offerId,
      jobId: args.jobId,
      studioId: args.studioId,
      instructorId: args.instructorId,
      amountAgorot: args.amountAgorot,
      description: `Payment offer created for ${args.amountAgorot} agorot`,
    },
    result: args.success ? "success" : "failure",
    errorMessage: args.errorMessage,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
}

/**
 * Log payment order creation
 */
export async function auditPaymentOrderCreated(
  ctx: MutationCtx,
  args: {
    actor: { _id: Id<"users">; email?: string; role: string };
    orderId: Id<"paymentOrders">;
    offerId: Id<"paymentOffers">;
    jobId: Id<"jobs">;
    studioId: Id<"studioProfiles">;
    instructorId: Id<"instructorProfiles">;
    amountAgorot: number;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await ctx.runMutation(internal.lib.audit.logAuditEvent, {
    action: "payment_order_created",
    actorId: args.actor._id,
    actorEmail: args.actor.email,
    actorRole: args.actor.role as "pending" | "instructor" | "studio",
    targetType: "payment_order",
    targetId: args.orderId,
    metadata: {
      orderId: args.orderId,
      offerId: args.offerId,
      jobId: args.jobId,
      studioId: args.studioId,
      instructorId: args.instructorId,
      amountAgorot: args.amountAgorot,
      description: `Payment order created for ${args.amountAgorot} agorot`,
    },
    result: args.success ? "success" : "failure",
    errorMessage: args.errorMessage,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
}

/**
 * Log internal access grant/revoke
 */
export async function auditInternalAccessChange(
  ctx: MutationCtx,
  args: {
    actor?: { _id: Id<"users">; email?: string; role?: string };
    targetUserId?: Id<"users">;
    targetEmail?: string;
    grantedRole: "tester";
    active: boolean;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await ctx.runMutation(internal.lib.audit.logAuditEvent, {
    action: args.active ? "internal_access_grant" : "internal_access_revoke",
    actorId: args.actor?._id,
    actorEmail: args.actor?.email,
    actorRole: args.actor?.role as "pending" | "instructor" | "studio" | undefined,
    targetType: "internal_access",
    targetId: args.targetUserId ?? args.targetEmail ?? "unknown",
    metadata: {
      grantedRole: args.grantedRole,
      targetUserId: args.targetUserId,
      targetEmail: args.targetEmail,
      description: `Internal access ${args.active ? "granted" : "revoked"}: ${args.grantedRole} for ${args.targetEmail ?? args.targetUserId}`,
    },
    result: args.success ? "success" : "failure",
    errorMessage: args.errorMessage,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
}

// ============================================
// Query: View Audit Logs (Admin Only)
// ============================================

import { query } from "../_generated/server";
import { requireInternalTester } from "./auth";

export const listAuditLogs = query({
  args: {
    action: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    result: v.optional(v.union(v.literal("success"), v.literal("failure"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("internalAuditLogs"),
    _creationTime: v.number(),
    action: v.string(),
    actorId: v.optional(v.id("users")),
    actorEmail: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    result: v.string(),
    errorMessage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })),
  handler: async (ctx, args) => {
    await requireInternalTester(ctx);

    const limit = args.limit ?? 100;
    const logs = args.action
      ? await ctx.db
          .query("internalAuditLogs")
          .withIndex("by_action", (q) => q.eq("action", args.action as any))
          .order("desc")
          .take(limit)
      : args.actorId
        ? await ctx.db
            .query("internalAuditLogs")
            .withIndex("by_actor", (q) => q.eq("actorId", args.actorId))
            .order("desc")
            .take(limit)
        : args.targetType && args.targetId
          ? await ctx.db
              .query("internalAuditLogs")
              .withIndex("by_target", (q) =>
                q.eq("targetType", args.targetType as any).eq("targetId", args.targetId),
              )
              .order("desc")
              .take(limit)
          : args.result
            ? await ctx.db
                .query("internalAuditLogs")
                .withIndex("by_result", (q) => q.eq("result", args.result))
                .order("desc")
                .take(limit)
            : await ctx.db.query("internalAuditLogs").withIndex("by_timestamp").order("desc").take(limit);

    return logs.map((log) => ({
      _id: log._id,
      _creationTime: log._creationTime,
      action: log.action,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      result: log.result,
      errorMessage: log.errorMessage,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp,
    }));
  },
});
