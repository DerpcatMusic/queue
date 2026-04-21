import { ConvexError, v } from "convex/values";
import { normalizeCapabilityTagArray, normalizeSportType } from "../lib/domainValidation";
import {
  instructorCertificateReviewStatusValidator,
  instructorComplianceSummaryValidator,
  instructorInsuranceReviewStatusValidator,
} from "../lib/instructorCompliance";
import { createSecureUploadToken } from "../lib/secureToken";

// Token generation is handled by secureToken.ts which uses "use node"

export const DOCUMENT_UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;

// Re-export the secure token generator
// Uses nanoid for cryptographically secure tokens (NOT Math.random)
export function createUploadSessionToken(userId: string, now: number): string {
  return createSecureUploadToken(userId, now);
}

export const instructorProfessionalRegistrySnapshotValidator = v.union(
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
    nameMatched: v.optional(v.boolean()),
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
);

export const instructorComplianceDetailsValidator = v.object({
  summary: instructorComplianceSummaryValidator,
  professionalRegistry: instructorProfessionalRegistrySnapshotValidator,
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
});

export function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeOptionalStringArray(values: ReadonlyArray<string> | undefined) {
  if (!values) {
    return undefined;
  }
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionalSpecialties(
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

export function assertAllowedComplianceContentType(contentType: string | undefined) {
  const normalized = normalizeOptionalText(contentType);
  if (!normalized) {
    throw new ConvexError("Uploaded file is missing a content type");
  }
  if (normalized === "application/pdf" || normalized.startsWith("image/")) {
    return normalized;
  }
  throw new ConvexError("Only PDF and image uploads are allowed");
}
