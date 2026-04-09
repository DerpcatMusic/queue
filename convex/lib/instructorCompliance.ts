import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getSportGenreKey } from "../constants";
import { normalizeCapabilityTagArray, normalizeSportType } from "./domainValidation";
import { resolveInternalAccessForUserId } from "./internalAccess";
import {
  getLatestStripeConnectedAccount,
  isStripeIdentityVerified,
  mapStripeConnectedAccountStatusToIdentityStatus,
} from "./stripeIdentity";
import { omitUndefined } from "./validation";

type Ctx = QueryCtx | MutationCtx;
type InstructorJobActionBlockReason =
  | "identity_verification_required"
  | "insurance_verification_required"
  | "sport_certificate_required";

type ApprovedSpecialtyMap = Map<string, Set<string>>;

// Flip this to `false` to allow any approved certificate from the same genre
// to unlock sibling sub-sports. Capability tags are still enforced when present.
export const STRICT_INSTRUCTOR_CERTIFICATE_SUBSPORT_ENFORCEMENT = true;

export type InstructorComplianceSnapshot = {
  hasVerificationBypass: boolean;
  hasApprovedIdentity: boolean;
  hasApprovedInsurance: boolean;
  approvedCertificateSports: Set<string>;
  approvedCertificateGenres: Set<string>;
  approvedSpecialtyCapabilities: ApprovedSpecialtyMap;
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

function getApprovedSpecialtyCapabilities(rows: ReadonlyArray<Doc<"instructorCertificates">>) {
  const specialties: ApprovedSpecialtyMap = new Map();
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

function getApprovedCertificateSports(specialtyMap: ApprovedSpecialtyMap) {
  return new Set<string>(specialtyMap.keys());
}

function getApprovedCertificateGenres(specialtyMap: ApprovedSpecialtyMap) {
  const genres = new Set<string>();
  for (const sport of specialtyMap.keys()) {
    const genreKey = getSportGenreKey(sport);
    if (genreKey) {
      genres.add(genreKey);
    }
  }
  return genres;
}

function hasCertificateCoverageForSport(args: {
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

export async function loadInstructorComplianceSnapshot(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
  now: number,
): Promise<InstructorComplianceSnapshot> {
  const [profile, insuranceRows, certificateRows] = await Promise.all([
    ctx.db.get(instructorId),
    ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructorId))
      .collect(),
    ctx.db
      .query("instructorCertificates")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructorId))
      .collect(),
  ]);

  const approvedSpecialtyCapabilities = getApprovedSpecialtyCapabilities(certificateRows);
  const access = profile ? await resolveInternalAccessForUserId(ctx, profile.userId) : null;

  return {
    hasVerificationBypass: access?.verificationBypass === true,
    hasApprovedIdentity: access?.verificationBypass === true,
    hasApprovedInsurance: insuranceRows.some((row) => isApprovedInsuranceActive(row, now)),
    approvedCertificateSports: getApprovedCertificateSports(approvedSpecialtyCapabilities),
    approvedCertificateGenres: getApprovedCertificateGenres(approvedSpecialtyCapabilities),
    approvedSpecialtyCapabilities,
  };
}

export function getInstructorGlobalJobActionBlockReasons(args: {
  profile: Doc<"instructorProfiles">;
  compliance: InstructorComplianceSnapshot;
}) {
  if (args.compliance.hasVerificationBypass) {
    return [];
  }

  const reasons: InstructorJobActionBlockReason[] = [];
  if (!args.compliance.hasApprovedIdentity) {
    reasons.push("identity_verification_required");
  }
  if (!args.compliance.hasApprovedInsurance) {
    reasons.push("insurance_verification_required");
  }
  if (args.compliance.approvedCertificateSports.size === 0) {
    reasons.push("sport_certificate_required");
  }
  return reasons;
}

export function getInstructorJobActionBlockReason(args: {
  profile: Doc<"instructorProfiles">;
  compliance: InstructorComplianceSnapshot;
  sport: string;
  requiredCapabilityTags?: ReadonlyArray<string> | undefined;
}): InstructorJobActionBlockReason | undefined {
  if (args.compliance.hasVerificationBypass) {
    return undefined;
  }

  if (!args.compliance.hasApprovedIdentity) {
    return "identity_verification_required";
  }
  if (!args.compliance.hasApprovedInsurance) {
    return "insurance_verification_required";
  }
  if (!hasCertificateCoverageForSport(args)) {
    return "sport_certificate_required";
  }
  return undefined;
}

export function canInstructorPerformJobActions(args: {
  profile: Doc<"instructorProfiles">;
  compliance: InstructorComplianceSnapshot;
  sport: string;
  requiredCapabilityTags?: ReadonlyArray<string> | undefined;
}) {
  return getInstructorJobActionBlockReason(args) === undefined;
}

export async function getInstructorPublicCertificates(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
) {
  const rows = await ctx.db
    .query("instructorCertificates")
    .withIndex("by_instructor_review", (q) =>
      q.eq("instructorId", instructorId).eq("reviewStatus", "approved"),
    )
    .collect();

  return rows.map((row) => ({
    specialties: getCertificateSpecialties(row),
    ...omitUndefined({
      issuerName: row.issuerName,
      certificateTitle: row.certificateTitle,
      verifiedAt: row.reviewedAt,
    }),
  }));
}

export async function buildInstructorComplianceSummary(
  ctx: Ctx,
  args: {
    instructor: Doc<"instructorProfiles">;
    now: number;
  },
) {
  const [publicCertificates, insuranceRows, certificateRows, stripeAccount] = await Promise.all([
    getInstructorPublicCertificates(ctx, args.instructor._id),
    ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_instructor", (q) => q.eq("instructorId", args.instructor._id))
      .collect(),
    ctx.db
      .query("instructorCertificates")
      .withIndex("by_instructor", (q) => q.eq("instructorId", args.instructor._id))
      .collect(),
    getLatestStripeConnectedAccount(ctx, args.instructor.userId),
  ]);

  const approvedSpecialtyCapabilities = getApprovedSpecialtyCapabilities(certificateRows);
  const access = await resolveInternalAccessForUserId(ctx, args.instructor.userId);
  const compliance = {
    hasVerificationBypass: access.verificationBypass,
    hasApprovedIdentity: access.verificationBypass || isStripeIdentityVerified(stripeAccount),
    hasApprovedInsurance: insuranceRows.some((row) => isApprovedInsuranceActive(row, args.now)),
    approvedCertificateSports: getApprovedCertificateSports(approvedSpecialtyCapabilities),
    approvedCertificateGenres: getApprovedCertificateGenres(approvedSpecialtyCapabilities),
    approvedSpecialtyCapabilities,
  } satisfies InstructorComplianceSnapshot;

  const pendingCertificateCount = certificateRows.filter(
    (row) =>
      row.reviewStatus === "uploaded" ||
      row.reviewStatus === "ai_pending" ||
      row.reviewStatus === "ai_reviewing",
  ).length;
  const pendingInsuranceCount = insuranceRows.filter(
    (row) =>
      row.reviewStatus === "uploaded" ||
      row.reviewStatus === "ai_pending" ||
      row.reviewStatus === "ai_reviewing",
  ).length;
  const blockingReasons = getInstructorGlobalJobActionBlockReasons({
    profile: args.instructor,
    compliance,
  });

  return {
    diditApproved: compliance.hasApprovedIdentity,
    verificationBypassed: access.verificationBypass,
    canApplyToJobs: blockingReasons.length === 0,
    canBeAcceptedForJobs: blockingReasons.length === 0,
    blockingReasons,
    publicCertificates,
    hasApprovedInsurance: access.verificationBypass || compliance.hasApprovedInsurance,
    pendingCertificateCount,
    pendingInsuranceCount,
    ...omitUndefined({
      diditStatus: mapStripeConnectedAccountStatusToIdentityStatus(stripeAccount?.status),
    }),
  };
}
