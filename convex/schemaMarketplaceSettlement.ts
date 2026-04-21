import { defineTable } from "convex/server";
import { v } from "convex/values";

export const marketplaceSettlementTables = {
  jobSettlementPolicies: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    paymentTiming: v.union(
      v.literal("before_lesson"),
      v.literal("after_start"),
      v.literal("after_end"),
      v.literal("net_terms"),
    ),
    graceDays: v.number(),
    requiresVerifiedCheckIn: v.boolean(),
    requiresVerifiedCheckOut: v.boolean(),
    autoSuspendOnOverdue: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_studio", ["studioId", "createdAt"]),

  jobSettlementStates: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    branchId: v.id("studioBranches"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    assignmentId: v.optional(v.id("jobAssignments")),
    paymentOfferId: v.optional(v.id("paymentOffers")),
    paymentOrderId: v.optional(v.id("paymentOrders")),
    paymentStatus: v.union(
      v.literal("not_required_yet"),
      v.literal("payment_pending"),
      v.literal("payment_processing"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("overdue"),
    ),
    lessonStatus: v.union(
      v.literal("scheduled"),
      v.literal("checked_in"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("confirmed"),
      v.literal("cancelled"),
    ),
    settlementStatus: v.union(
      v.literal("pending"),
      v.literal("awaiting_lesson"),
      v.literal("ready_for_payment"),
      v.literal("awaiting_capture"),
      v.literal("settled"),
      v.literal("overdue"),
      v.literal("cancelled"),
    ),
    dueAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    lessonCompletedAt: v.optional(v.number()),
    overdueAt: v.optional(v.number()),
    suspendedStudioAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_assignment", ["assignmentId"])
    .index("by_payment_order", ["paymentOrderId"])
    .index("by_studio_status_due", ["studioId", "settlementStatus", "dueAt"])
    .index("by_status_due", ["settlementStatus", "dueAt"]),

  studioOperationalBlocks: defineTable({
    studioId: v.id("studioProfiles"),
    userId: v.id("users"),
    reason: v.union(
      v.literal("overdue_payment"),
      v.literal("manual_review"),
      v.literal("chargeback_risk"),
    ),
    scope: v.union(v.literal("post_jobs"), v.literal("payments"), v.literal("full")),
    active: v.boolean(),
    triggeredByJobId: v.optional(v.id("jobs")),
    triggeredBySettlementStateId: v.optional(v.id("jobSettlementStates")),
    detail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    liftedAt: v.optional(v.number()),
  })
    .index("by_studio_active", ["studioId", "active", "createdAt"])
    .index("by_user_active", ["userId", "active", "createdAt"])
    .index("by_active_reason", ["active", "reason", "createdAt"]),

  lessonRatings: defineTable({
    jobId: v.id("jobs"),
    assignmentId: v.optional(v.id("jobAssignments")),
    studioId: v.id("studioProfiles"),
    instructorId: v.id("instructorProfiles"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    fromRole: v.union(v.literal("studio"), v.literal("instructor")),
    toRole: v.union(v.literal("studio"), v.literal("instructor")),
    score: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId", "createdAt"])
    .index("by_assignment", ["assignmentId", "createdAt"])
    .index("by_from_to_job", ["fromUserId", "toUserId", "jobId"])
    .index("by_to_role", ["toRole", "createdAt"]),
};
