import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { instructorInsuranceReviewStatusValidator } from "../lib/instructorCompliance";
import { omitUndefined } from "../lib/validation";
import {
  normalizeOptionalSpecialties,
  normalizeOptionalStringArray,
  normalizeOptionalText,
} from "./instructorShared";

export const applyInstructorCertificateReviewDecision = internalMutation({
  args: {
    certificateId: v.id("instructorCertificates"),
    reviewStatus: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("needs_resubmission"),
    ),
    reviewProvider: v.optional(v.literal("gemini")),
    issuerName: v.optional(v.string()),
    certificateTitle: v.optional(v.string()),
    specialties: v.optional(
      v.array(
        v.object({
          sport: v.string(),
          capabilityTags: v.optional(v.array(v.string())),
        }),
      ),
    ),
    completedAt: v.optional(v.number()),
    reviewSummary: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
    rejectionReasons: v.optional(v.array(v.string())),
    reviewedAt: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const certificate = await ctx.db.get(args.certificateId);
    if (!certificate) {
      throw new ConvexError("Certificate not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.certificateId, {
      reviewStatus: args.reviewStatus,
      updatedAt: now,
      reviewedAt: args.reviewedAt ?? now,
      ...omitUndefined({
        reviewProvider: args.reviewProvider,
        issuerName: normalizeOptionalText(args.issuerName),
        certificateTitle: normalizeOptionalText(args.certificateTitle),
        specialties: normalizeOptionalSpecialties(args.specialties),
        completedAt: args.completedAt,
        reviewSummary: normalizeOptionalText(args.reviewSummary),
        reviewJson: normalizeOptionalText(args.reviewJson),
        rejectionReasons: normalizeOptionalStringArray(args.rejectionReasons),
      }),
    });

    return { ok: true };
  },
});

export const applyInstructorInsuranceReviewDecision = internalMutation({
  args: {
    insurancePolicyId: v.id("instructorInsurancePolicies"),
    reviewStatus: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("needs_resubmission"),
      v.literal("expired"),
    ),
    reviewProvider: v.optional(v.literal("gemini")),
    issuerName: v.optional(v.string()),
    policyHolderName: v.optional(v.string()),
    policyNumber: v.optional(v.string()),
    expiresOn: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    reviewSummary: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
    rejectionReasons: v.optional(v.array(v.string())),
    reviewedAt: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const insurancePolicy = await ctx.db.get(args.insurancePolicyId);
    if (!insurancePolicy) {
      throw new ConvexError("Insurance policy not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.insurancePolicyId, {
      reviewStatus: args.reviewStatus,
      updatedAt: now,
      reviewedAt: args.reviewedAt ?? now,
      ...omitUndefined({
        reviewProvider: args.reviewProvider,
        issuerName: normalizeOptionalText(args.issuerName),
        policyHolderName: normalizeOptionalText(args.policyHolderName),
        policyNumber: normalizeOptionalText(args.policyNumber),
        expiresOn: normalizeOptionalText(args.expiresOn),
        expiresAt: args.expiresAt,
        reviewSummary: normalizeOptionalText(args.reviewSummary),
        reviewJson: normalizeOptionalText(args.reviewJson),
        rejectionReasons: normalizeOptionalStringArray(args.rejectionReasons),
      }),
    });

    return { ok: true };
  },
});

export const markInstructorCertificateReviewProgress = internalMutation({
  args: {
    certificateId: v.id("instructorCertificates"),
    reviewStatus: v.union(v.literal("ai_pending"), v.literal("ai_reviewing")),
    reviewProvider: v.optional(v.literal("gemini")),
    reviewSummary: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const certificate = await ctx.db.get(args.certificateId);
    if (!certificate) {
      throw new ConvexError("Certificate not found");
    }

    await ctx.db.patch(args.certificateId, {
      reviewStatus: args.reviewStatus,
      updatedAt: Date.now(),
      ...omitUndefined({
        reviewProvider: args.reviewProvider,
        reviewSummary: normalizeOptionalText(args.reviewSummary),
      }),
    });

    return { ok: true };
  },
});

export const markInstructorInsuranceReviewProgress = internalMutation({
  args: {
    insurancePolicyId: v.id("instructorInsurancePolicies"),
    reviewStatus: v.union(v.literal("ai_pending"), v.literal("ai_reviewing")),
    reviewProvider: v.optional(v.literal("gemini")),
    reviewSummary: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const insurancePolicy = await ctx.db.get(args.insurancePolicyId);
    if (!insurancePolicy) {
      throw new ConvexError("Insurance policy not found");
    }

    await ctx.db.patch(args.insurancePolicyId, {
      reviewStatus: args.reviewStatus,
      updatedAt: Date.now(),
      ...omitUndefined({
        reviewProvider: args.reviewProvider,
        reviewSummary: normalizeOptionalText(args.reviewSummary),
      }),
    });

    return { ok: true };
  },
});

export const createInstructorComplianceNotification = internalMutation({
  args: {
    recipientUserId: v.id("users"),
    kind: v.union(
      v.literal("compliance_certificate_approved"),
      v.literal("compliance_certificate_rejected"),
      v.literal("compliance_insurance_approved"),
      v.literal("compliance_insurance_rejected"),
      v.literal("compliance_insurance_expiring"),
      v.literal("compliance_insurance_expired"),
    ),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.notifications.core.deliverNotificationEvent, {
      recipientUserId: args.recipientUserId,
      kind: args.kind,
      title: args.title,
      body: args.body,
    });

    return { ok: true };
  },
});

export const listInsurancePoliciesForRenewalProcessing = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      insurancePolicyId: v.id("instructorInsurancePolicies"),
      instructorId: v.id("instructorProfiles"),
      recipientUserId: v.id("users"),
      email: v.optional(v.string()),
      instructorDisplayName: v.string(),
      expiresAt: v.number(),
      reviewStatus: instructorInsuranceReviewStatusValidator,
      monthReminderSentAt: v.optional(v.number()),
      weekReminderSentAt: v.optional(v.number()),
      firstReminderSentAt: v.optional(v.number()),
      finalReminderSentAt: v.optional(v.number()),
      dayReminderSentAt: v.optional(v.number()),
      expiredNoticeSentAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_expiresAt")
      .collect();

    const results = await Promise.all(
      rows
        .filter((row) => row.expiresAt !== undefined)
        .map(async (row) => {
          const instructor = await ctx.db.get(row.instructorId);
          if (!instructor) {
            return null;
          }
          const user = await ctx.db.get(instructor.userId);
          if (!user?.isActive) {
            return null;
          }
          return {
            insurancePolicyId: row._id,
            instructorId: row.instructorId,
            recipientUserId: instructor.userId,
            instructorDisplayName: instructor.displayName,
            expiresAt: row.expiresAt!,
            reviewStatus: row.reviewStatus,
            ...omitUndefined({
              email: user.email,
              monthReminderSentAt: row.monthReminderSentAt,
              weekReminderSentAt: row.weekReminderSentAt,
              firstReminderSentAt: row.firstReminderSentAt,
              finalReminderSentAt: row.finalReminderSentAt,
              dayReminderSentAt: row.dayReminderSentAt,
              expiredNoticeSentAt: row.expiredNoticeSentAt,
            }),
          };
        }),
    );

    return results.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

export const markInsuranceReminderEvent = internalMutation({
  args: {
    insurancePolicyId: v.id("instructorInsurancePolicies"),
    event: v.union(
      v.literal("month_reminder"),
      v.literal("week_reminder"),
      v.literal("first_reminder"),
      v.literal("final_reminder"),
      v.literal("day_reminder"),
      v.literal("expired_notice"),
    ),
    at: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const insurancePolicy = await ctx.db.get(args.insurancePolicyId);
    if (!insurancePolicy) {
      throw new ConvexError("Insurance policy not found");
    }

    const at = args.at ?? Date.now();
    if (args.event === "month_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        monthReminderSentAt: at,
        updatedAt: at,
      });
    } else if (args.event === "week_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        weekReminderSentAt: at,
        updatedAt: at,
      });
    } else if (args.event === "first_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        firstReminderSentAt: at,
        updatedAt: at,
      });
    } else if (args.event === "final_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        finalReminderSentAt: at,
        updatedAt: at,
      });
    } else if (args.event === "day_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        dayReminderSentAt: at,
        updatedAt: at,
      });
    } else {
      await ctx.db.patch(args.insurancePolicyId, {
        reviewStatus: "expired",
        expiredNoticeSentAt: at,
        updatedAt: at,
      });
    }

    return { ok: true };
  },
});
