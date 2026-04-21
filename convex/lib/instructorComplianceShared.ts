import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { getSportGenreKey } from "../constants";
import { normalizeCapabilityTagArray, normalizeSportType } from "./domainValidation";

export const STRICT_INSTRUCTOR_CERTIFICATE_SUBSPORT_ENFORCEMENT = true;

export type InstructorComplianceSnapshot = {
  hasVerificationBypass: boolean;
  hasApprovedIdentity: boolean;
  hasApprovedInsurance: boolean;
  requiresProfessionalRegistry: boolean;
  hasApprovedProfessionalRegistry: boolean;
  approvedCertificateSports: Set<string>;
  approvedCertificateGenres: Set<string>;
  approvedSpecialtyCapabilities: Map<string, Set<string>>;
};

export const diditVerificationStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("pending"),
  v.literal("in_review"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("abandoned"),
  v.literal("expired"),
);

export const instructorCertificateReviewStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("ai_pending"),
  v.literal("ai_reviewing"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("needs_resubmission"),
);

export const instructorInsuranceReviewStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("ai_pending"),
  v.literal("ai_reviewing"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("needs_resubmission"),
);

export const instructorJobActionBlockReasonValidator = v.union(
  v.literal("identity_verification_required"),
  v.literal("insurance_verification_required"),
  v.literal("sport_certificate_required"),
  v.literal("professional_registry_required"),
);

export const instructorPublicCertificateValidator = v.object({
  specialties: v.array(
    v.object({
      sport: v.string(),
      capabilityTags: v.optional(v.array(v.string())),
    }),
  ),
  issuerName: v.optional(v.string()),
  certificateTitle: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
});

export const instructorComplianceSummaryValidator = v.object({
  diditApproved: v.boolean(),
  verificationBypassed: v.boolean(),
  diditStatus: v.optional(diditVerificationStatusValidator),
  canApplyToJobs: v.boolean(),
  canBeAcceptedForJobs: v.boolean(),
  blockingReasons: v.array(instructorJobActionBlockReasonValidator),
  publicCertificates: v.array(instructorPublicCertificateValidator),
  hasApprovedInsurance: v.boolean(),
  requiresProfessionalRegistry: v.boolean(),
  hasApprovedProfessionalRegistry: v.boolean(),
  professionalRegistry: v.optional(
    v.object({
      country: v.string(),
      provider: v.optional(v.string()),
      identifier: v.optional(v.string()),
      status: v.optional(v.union(v.literal("found"), v.literal("not_found"), v.literal("error"))),
      checkedAt: v.optional(v.number()),
      isPublic: v.optional(v.boolean()),
      hasValidRegistration: v.optional(v.boolean()),
      holderName: v.optional(v.string()),
      issuingAuthority: v.optional(v.string()),
      expiresOn: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      nameMatched: v.optional(v.boolean()),
      errorCode: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
    }),
  ),
  pendingCertificateCount: v.number(),
  pendingInsuranceCount: v.number(),
});

function isApprovedInsuranceActive(row: Doc<"instructorInsurancePolicies">, now: number) {
  return row.reviewStatus === "approved" && (!row.expiresAt || row.expiresAt > now);
}

function getCertificateSpecialties(
  row: Doc<"instructorCertificates">,
): Array<{ sport: string; capabilityTags?: string[] }> {
  if (row.specialties && row.specialties.length > 0) {
    return row.specialties.map((specialty) => {
      const capabilityTags = normalizeCapabilityTagArray(specialty.capabilityTags);
      return {
        sport: normalizeSportType(specialty.sport),
        ...(capabilityTags ? { capabilityTags } : {}),
      };
    });
  }
  if (row.sport) {
    return [{ sport: normalizeSportType(row.sport) }];
  }
  return [];
}

export function getApprovedSpecialtyCapabilities(
  rows: ReadonlyArray<Doc<"instructorCertificates">>,
) {
  const specialties: Map<string, Set<string>> = new Map();
  for (const row of rows) {
    if (row.reviewStatus !== "approved") {
      continue;
    }
    for (const specialty of getCertificateSpecialties(row)) {
      const existing = specialties.get(specialty.sport) ?? new Set<string>();
      for (const tag of specialty.capabilityTags ?? []) {
        existing.add(tag);
      }
      specialties.set(specialty.sport, existing);
    }
  }
  return specialties;
}

export function getApprovedCertificateSports(specialtyMap: Map<string, Set<string>>) {
  return new Set<string>(specialtyMap.keys());
}

export function getApprovedCertificateGenres(specialtyMap: Map<string, Set<string>>) {
  const genres = new Set<string>();
  for (const sport of specialtyMap.keys()) {
    const genreKey = getSportGenreKey(sport);
    if (genreKey) {
      genres.add(genreKey);
    }
  }
  return genres;
}

export function hasCertificateCoverageForSport(args: {
  sport: string;
  requiredCapabilityTags?: ReadonlyArray<string> | undefined;
  compliance: InstructorComplianceSnapshot;
}) {
  const normalizedSport = normalizeSportType(args.sport);
  const requiredCapabilityTags = normalizeCapabilityTagArray(args.requiredCapabilityTags) ?? [];
  const directCapabilities = args.compliance.approvedSpecialtyCapabilities.get(normalizedSport);

  if (directCapabilities) {
    return requiredCapabilityTags.every((tag) => directCapabilities.has(tag));
  }

  if (STRICT_INSTRUCTOR_CERTIFICATE_SUBSPORT_ENFORCEMENT) {
    return false;
  }

  const genreKey = getSportGenreKey(normalizedSport);
  if (!genreKey || !args.compliance.approvedCertificateGenres.has(genreKey)) {
    return false;
  }
  return requiredCapabilityTags.length === 0;
}

export function isApprovedInsuranceActiveRow(row: Doc<"instructorInsurancePolicies">, now: number) {
  return isApprovedInsuranceActive(row, now);
}
