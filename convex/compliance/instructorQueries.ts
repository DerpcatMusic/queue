import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalQuery, query } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import {
  buildInstructorComplianceSummary,
  instructorCertificateReviewStatusValidator,
  instructorComplianceSummaryValidator,
  instructorInsuranceReviewStatusValidator,
} from "../lib/instructorCompliance";
import { omitUndefined } from "../lib/validation";
import { instructorComplianceDetailsValidator } from "./instructorShared";

export const getMyInstructorComplianceSummary = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.union(v.null(), instructorComplianceSummaryValidator),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructor = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!instructor) {
      return null;
    }

    return buildInstructorComplianceSummary(ctx, {
      instructor,
      now: args.now ?? Date.now(),
    });
  },
});

export async function getInstructorComplianceDetailsRead(
  ctx: QueryCtx,
  args: {
    userId: Doc<"users">["_id"];
    now: number;
  },
) {
  const instructor = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
    .unique();

  if (!instructor) {
    return null;
  }

  const [summary, certificates, insurancePolicies] = await Promise.all([
    buildInstructorComplianceSummary(ctx, {
      instructor,
      now: args.now,
    }),
    ctx.db
      .query("instructorCertificates")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .collect(),
    ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .collect(),
  ]);

  const professionalRegistry =
    instructor.professionalRegistryCountry === "FR" && instructor.professionalRegistryIdentifier
      ? {
          country: "FR" as const,
          provider: "france_eaps_public" as const,
          identifier: instructor.professionalRegistryIdentifier,
          status: instructor.professionalRegistryStatus ?? "error",
          qualifications: (instructor.professionalRegistryQualifications ?? []).map(
            (qualification) => ({
              title: qualification.title,
              ...omitUndefined({
                alert: qualification.alert,
                conditions: qualification.conditions,
                obtainedOn: qualification.obtainedOn,
                obtainedAt: qualification.obtainedAt,
                validFromOn: qualification.validFromOn,
                validFromAt: qualification.validFromAt,
                validUntilOn: qualification.validUntilOn,
                validUntilAt: qualification.validUntilAt,
                lastReviewedOn: qualification.lastReviewedOn,
                lastReviewedAt: qualification.lastReviewedAt,
                renewalRequiredByOn: qualification.renewalRequiredByOn,
                renewalRequiredByAt: qualification.renewalRequiredByAt,
              }),
            }),
          ),
          ...omitUndefined({
            checkedAt: instructor.professionalRegistryCheckedAt,
            isPublic: instructor.professionalRegistryIsPublic,
            hasValidRegistration: instructor.professionalRegistryHasValidRegistration,
            holderName: instructor.professionalRegistryHolderName,
            issuingAuthority: instructor.professionalRegistryIssuingAuthority,
            expiresOn: instructor.professionalRegistryExpiresOn,
            expiresAt: instructor.professionalRegistryExpiresAt,
            publicProfileUrl: instructor.professionalRegistryPublicUrl,
            apiUrl: instructor.professionalRegistryApiUrl,
            errorCode: instructor.professionalRegistryErrorCode,
            errorMessage: instructor.professionalRegistryErrorMessage,
          }),
        }
      : null;

  return {
    summary,
    professionalRegistry,
    certificates: certificates.map((row) => ({
      reviewStatus: row.reviewStatus,
      uploadedAt: row.uploadedAt,
      ...omitUndefined({
        sport: row.sport,
        specialties: row.specialties,
        issuerName: row.issuerName,
        certificateTitle: row.certificateTitle,
        reviewedAt: row.reviewedAt,
      }),
    })),
    insurancePolicies: insurancePolicies.map((row) => ({
      reviewStatus: row.reviewStatus,
      uploadedAt: row.uploadedAt,
      ...omitUndefined({
        issuerName: row.issuerName,
        policyNumber: row.policyNumber,
        expiresOn: row.expiresOn,
        expiresAt: row.expiresAt,
        reviewedAt: row.reviewedAt,
      }),
    })),
  };
}

export const getMyInstructorComplianceDetails = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.union(v.null(), instructorComplianceDetailsValidator),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    return await getInstructorComplianceDetailsRead(ctx, {
      userId: user._id,
      now: args.now ?? Date.now(),
    });
  },
});

export const getInstructorCertificateReviewContext = internalQuery({
  args: {
    certificateId: v.id("instructorCertificates"),
  },
  returns: v.union(
    v.null(),
    v.object({
      certificateId: v.id("instructorCertificates"),
      instructorId: v.id("instructorProfiles"),
      recipientUserId: v.id("users"),
      declaredSport: v.optional(v.string()),
      storageId: v.id("_storage"),
      storageUrl: v.string(),
      mimeType: v.optional(v.string()),
      fileName: v.optional(v.string()),
      instructorDisplayName: v.string(),
      diditLegalName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const certificate = await ctx.db.get(args.certificateId);
    if (!certificate) {
      return null;
    }

    const instructor = await ctx.db.get(certificate.instructorId);
    if (!instructor) {
      return null;
    }

    const storageUrl = await ctx.storage.getUrl(certificate.storageId);
    if (!storageUrl) {
      throw new ConvexError("Certificate file is unavailable");
    }

    return {
      certificateId: certificate._id,
      instructorId: certificate.instructorId,
      recipientUserId: instructor.userId,
      storageId: certificate.storageId,
      storageUrl,
      instructorDisplayName: instructor.displayName,
      ...omitUndefined({
        declaredSport: certificate.sport,
        mimeType: certificate.mimeType,
        fileName: certificate.fileName,
        diditLegalName: instructor.diditLegalName,
      }),
    };
  },
});

export const getInstructorInsuranceReviewContext = internalQuery({
  args: {
    insurancePolicyId: v.id("instructorInsurancePolicies"),
  },
  returns: v.union(
    v.null(),
    v.object({
      insurancePolicyId: v.id("instructorInsurancePolicies"),
      instructorId: v.id("instructorProfiles"),
      recipientUserId: v.id("users"),
      storageId: v.id("_storage"),
      storageUrl: v.string(),
      mimeType: v.optional(v.string()),
      fileName: v.optional(v.string()),
      instructorDisplayName: v.string(),
      diditLegalName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const insurancePolicy = await ctx.db.get(args.insurancePolicyId);
    if (!insurancePolicy) {
      return null;
    }

    const instructor = await ctx.db.get(insurancePolicy.instructorId);
    if (!instructor) {
      return null;
    }

    const storageUrl = await ctx.storage.getUrl(insurancePolicy.storageId);
    if (!storageUrl) {
      throw new ConvexError("Insurance file is unavailable");
    }

    return {
      insurancePolicyId: insurancePolicy._id,
      instructorId: insurancePolicy.instructorId,
      recipientUserId: instructor.userId,
      storageId: insurancePolicy.storageId,
      storageUrl,
      instructorDisplayName: instructor.displayName,
      ...omitUndefined({
        mimeType: insurancePolicy.mimeType,
        fileName: insurancePolicy.fileName,
        diditLegalName: instructor.diditLegalName,
      }),
    };
  },
});

export const getCurrentInstructorComplianceInternal = internalQuery({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      summary: instructorComplianceSummaryValidator,
      professionalRegistry: v.union(
        v.null(),
        v.object({
          country: v.literal("FR"),
          provider: v.literal("france_eaps_public"),
          identifier: v.string(),
          status: v.union(v.literal("found"), v.literal("not_found"), v.literal("error")),
          checkedAt: v.optional(v.number()),
          isPublic: v.optional(v.boolean()),
          hasValidRegistration: v.optional(v.boolean()),
          holderName: v.optional(v.string()),
          issuingAuthority: v.optional(v.string()),
          expiresOn: v.optional(v.string()),
          expiresAt: v.optional(v.number()),
          publicProfileUrl: v.optional(v.string()),
          apiUrl: v.optional(v.string()),
          errorCode: v.optional(v.string()),
          errorMessage: v.optional(v.string()),
          qualifications: v.array(
            v.object({
              title: v.string(),
              alert: v.optional(v.string()),
              conditions: v.optional(v.string()),
              obtainedOn: v.optional(v.string()),
              obtainedAt: v.optional(v.number()),
              validFromOn: v.optional(v.string()),
              validFromAt: v.optional(v.number()),
              validUntilOn: v.optional(v.string()),
              validUntilAt: v.optional(v.number()),
              lastReviewedOn: v.optional(v.string()),
              lastReviewedAt: v.optional(v.number()),
              renewalRequiredByOn: v.optional(v.string()),
              renewalRequiredByAt: v.optional(v.number()),
            }),
          ),
        }),
      ),
      certificates: v.array(
        v.object({
          sport: v.optional(v.string()),
          specialties: v.optional(
            v.array(
              v.object({
                sport: v.string(),
                capabilityTags: v.optional(v.array(v.string())),
              }),
            ),
          ),
          storageId: v.id("_storage"),
          reviewStatus: instructorCertificateReviewStatusValidator,
          issuerName: v.optional(v.string()),
          certificateTitle: v.optional(v.string()),
          uploadedAt: v.number(),
          reviewedAt: v.optional(v.number()),
        }),
      ),
      insurancePolicies: v.array(
        v.object({
          storageId: v.id("_storage"),
          reviewStatus: instructorInsuranceReviewStatusValidator,
          issuerName: v.optional(v.string()),
          policyNumber: v.optional(v.string()),
          expiresOn: v.optional(v.string()),
          expiresAt: v.optional(v.number()),
          uploadedAt: v.number(),
          reviewedAt: v.optional(v.number()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructor = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!instructor) {
      return null;
    }

    const [summary, certificates, insurancePolicies] = await Promise.all([
      buildInstructorComplianceSummary(ctx, {
        instructor,
        now: args.now ?? Date.now(),
      }),
      ctx.db
        .query("instructorCertificates")
        .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
        .collect(),
      ctx.db
        .query("instructorInsurancePolicies")
        .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
        .collect(),
    ]);

    const professionalRegistry =
      instructor.professionalRegistryCountry === "FR" && instructor.professionalRegistryIdentifier
        ? {
            country: "FR" as const,
            provider: "france_eaps_public" as const,
            identifier: instructor.professionalRegistryIdentifier,
            status: instructor.professionalRegistryStatus ?? "error",
            qualifications: (instructor.professionalRegistryQualifications ?? []).map(
              (qualification) => ({
                title: qualification.title,
                ...omitUndefined({
                  alert: qualification.alert,
                  conditions: qualification.conditions,
                  obtainedOn: qualification.obtainedOn,
                  obtainedAt: qualification.obtainedAt,
                  validFromOn: qualification.validFromOn,
                  validFromAt: qualification.validFromAt,
                  validUntilOn: qualification.validUntilOn,
                  validUntilAt: qualification.validUntilAt,
                  lastReviewedOn: qualification.lastReviewedOn,
                  lastReviewedAt: qualification.lastReviewedAt,
                  renewalRequiredByOn: qualification.renewalRequiredByOn,
                  renewalRequiredByAt: qualification.renewalRequiredByAt,
                }),
              }),
            ),
            ...omitUndefined({
              checkedAt: instructor.professionalRegistryCheckedAt,
              isPublic: instructor.professionalRegistryIsPublic,
              hasValidRegistration: instructor.professionalRegistryHasValidRegistration,
              holderName: instructor.professionalRegistryHolderName,
              issuingAuthority: instructor.professionalRegistryIssuingAuthority,
              expiresOn: instructor.professionalRegistryExpiresOn,
              expiresAt: instructor.professionalRegistryExpiresAt,
              publicProfileUrl: instructor.professionalRegistryPublicUrl,
              apiUrl: instructor.professionalRegistryApiUrl,
              errorCode: instructor.professionalRegistryErrorCode,
              errorMessage: instructor.professionalRegistryErrorMessage,
            }),
          }
        : null;

    return {
      summary,
      professionalRegistry,
      certificates: certificates.map((row) => ({
        storageId: row.storageId,
        reviewStatus: row.reviewStatus,
        uploadedAt: row.uploadedAt,
        ...omitUndefined({
          sport: row.sport,
          specialties: row.specialties,
          issuerName: row.issuerName,
          certificateTitle: row.certificateTitle,
          reviewedAt: row.reviewedAt,
        }),
      })),
      insurancePolicies: insurancePolicies.map((row) => ({
        storageId: row.storageId,
        reviewStatus: row.reviewStatus,
        uploadedAt: row.uploadedAt,
        ...omitUndefined({
          issuerName: row.issuerName,
          policyNumber: row.policyNumber,
          expiresOn: row.expiresOn,
          expiresAt: row.expiresAt,
          reviewedAt: row.reviewedAt,
        }),
      })),
    };
  },
});
