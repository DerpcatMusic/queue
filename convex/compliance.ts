import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUserRole } from "./lib/auth";
import { normalizeCapabilityTagArray, normalizeSportType } from "./lib/domainValidation";
import {
  buildInstructorComplianceSummary,
  instructorCertificateReviewStatusValidator,
  instructorComplianceSummaryValidator,
  instructorInsuranceReviewStatusValidator,
} from "./lib/instructorCompliance";
import { omitUndefined } from "./lib/validation";

const DOCUMENT_UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;

function createUploadSessionToken(userId: string, now: number) {
  const entropy = Math.random().toString(36).slice(2, 12);
  return `${userId}:${now}:${entropy}`;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalStringArray(values: ReadonlyArray<string> | undefined) {
  if (!values) {
    return undefined;
  }
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalSpecialties(
  values:
    | ReadonlyArray<{
        sport: string;
        capabilityTags?: ReadonlyArray<string>;
      }>
    | undefined,
) {
  if (!values) {
    return undefined;
  }
  const normalized = values
    .map((value) => {
      const capabilityTags = normalizeCapabilityTagArray(value.capabilityTags);
      return {
        sport: normalizeSportType(value.sport),
        ...(capabilityTags ? { capabilityTags } : {}),
      };
    })
    .filter((value, index, array) => {
      const key = `${value.sport}::${(value.capabilityTags ?? []).join(",")}`;
      return (
        array.findIndex(
          (candidate) =>
            `${candidate.sport}::${(candidate.capabilityTags ?? []).join(",")}` === key,
        ) === index
      );
    });
  return normalized.length > 0 ? normalized : undefined;
}

function assertAllowedComplianceContentType(contentType: string | undefined) {
  const normalized = normalizeOptionalText(contentType);
  if (!normalized) {
    throw new ConvexError("Uploaded file is missing a content type");
  }
  if (normalized === "application/pdf" || normalized.startsWith("image/")) {
    return normalized;
  }
  throw new ConvexError("Only PDF and image uploads are allowed");
}

export const createMyComplianceDocumentUploadSession = mutation({
  args: {
    kind: v.union(v.literal("certificate"), v.literal("insurance")),
    sport: v.optional(v.string()),
  },
  returns: v.object({
    uploadUrl: v.string(),
    sessionToken: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructor = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!instructor) {
      throw new ConvexError("Instructor profile not found");
    }

    const sport =
      args.kind === "certificate" && args.sport ? normalizeSportType(args.sport) : undefined;
    const now = Date.now();
    const expiresAt = now + DOCUMENT_UPLOAD_SESSION_TTL_MS;
    const sessionToken = createUploadSessionToken(String(user._id), now);
    const uploadUrl = await ctx.storage.generateUploadUrl();

    await ctx.db.insert("instructorDocumentUploadSessions", {
      userId: user._id,
      instructorId: instructor._id,
      kind: args.kind,
      createdAt: now,
      expiresAt,
      token: sessionToken,
      ...omitUndefined({ sport }),
    });

    return {
      uploadUrl,
      sessionToken,
      expiresAt,
    };
  },
});

export const completeMyComplianceDocumentUpload = mutation({
  args: {
    sessionToken: v.string(),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    documentKind: v.union(v.literal("certificate"), v.literal("insurance")),
    documentId: v.union(v.id("instructorCertificates"), v.id("instructorInsurancePolicies")),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const session = await ctx.db
      .query("instructorDocumentUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    const now = Date.now();
    if (!session || session.userId !== user._id) {
      throw new ConvexError("Invalid upload session");
    }
    if (session.consumedAt !== undefined) {
      throw new ConvexError("Upload session has already been used");
    }
    if (session.expiresAt < now) {
      throw new ConvexError("Upload session has expired");
    }

    const uploadedFile = await ctx.storage.getMetadata(args.storageId);
    if (!uploadedFile) {
      throw new ConvexError("Uploaded file was not found");
    }

    const mimeType = assertAllowedComplianceContentType(uploadedFile.contentType ?? undefined);
    const fileName = normalizeOptionalText(args.fileName);

    if (session.kind === "certificate") {
      const documentId = await ctx.db.insert("instructorCertificates", {
        instructorId: session.instructorId,
        storageId: args.storageId,
        reviewStatus: "uploaded",
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
        ...omitUndefined({
          sport: session.sport,
          fileName,
          mimeType,
        }),
      });

      await ctx.db.patch("instructorDocumentUploadSessions", session._id, {
        consumedAt: now,
        storageId: args.storageId,
      });

      await ctx.scheduler.runAfter(0, internal.complianceReview.reviewInstructorCertificate, {
        certificateId: documentId,
      });

      return {
        ok: true,
        documentKind: session.kind,
        documentId,
      };
    } else {
      const documentId = await ctx.db.insert("instructorInsurancePolicies", {
        instructorId: session.instructorId,
        storageId: args.storageId,
        reviewStatus: "uploaded",
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
        ...omitUndefined({
          fileName,
          mimeType,
        }),
      });

      await ctx.db.patch("instructorDocumentUploadSessions", session._id, {
        consumedAt: now,
        storageId: args.storageId,
      });

      await ctx.scheduler.runAfter(0, internal.complianceReview.reviewInstructorInsurancePolicy, {
        insurancePolicyId: documentId,
      });

      return {
        ok: true,
        documentKind: session.kind,
        documentId,
      };
    }
  },
});

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

export const getMyInstructorComplianceDetails = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      summary: instructorComplianceSummaryValidator,
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
          reviewStatus: instructorCertificateReviewStatusValidator,
          issuerName: v.optional(v.string()),
          certificateTitle: v.optional(v.string()),
          uploadedAt: v.number(),
          reviewedAt: v.optional(v.number()),
        }),
      ),
      insurancePolicies: v.array(
        v.object({
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

    return {
      summary,
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
  },
});

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
    await ctx.db.insert("userNotifications", {
      recipientUserId: args.recipientUserId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.userPushNotifications.sendUserPushNotification, {
      userId: args.recipientUserId,
      title: args.title,
      body: args.body,
      data: {
        type: args.kind,
      },
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
      firstReminderSentAt: v.optional(v.number()),
      finalReminderSentAt: v.optional(v.number()),
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
          if (!user || !user.isActive) {
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
              firstReminderSentAt: row.firstReminderSentAt,
              finalReminderSentAt: row.finalReminderSentAt,
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
      v.literal("first_reminder"),
      v.literal("final_reminder"),
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
    if (args.event === "first_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        firstReminderSentAt: at,
        updatedAt: at,
      });
    } else if (args.event === "final_reminder") {
      await ctx.db.patch(args.insurancePolicyId, {
        finalReminderSentAt: at,
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

export const getCurrentInstructorComplianceInternal = internalQuery({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      summary: instructorComplianceSummaryValidator,
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

    return {
      summary,
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
