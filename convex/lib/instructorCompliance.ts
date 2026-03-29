import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getSportGenreKey } from "../constants";
import { normalizeSportType } from "./domainValidation";
import { omitUndefined } from "./validation";

type Ctx = QueryCtx | MutationCtx;
type InstructorJobActionBlockReason =
  | "identity_verification_required"
  | "insurance_verification_required"
  | "sport_certificate_required";

// Flip this to `false` to allow any approved certificate from the same genre
// (for example any Pilates certificate) to unlock sibling sub-sports.
export const STRICT_INSTRUCTOR_CERTIFICATE_SUBSPORT_ENFORCEMENT = true;

export type InstructorComplianceSnapshot = {
  hasApprovedInsurance: boolean;
  approvedCertificateSports: Set<string>;
  approvedCertificateGenres: Set<string>;
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
  sports: v.array(v.string()),
  machines: v.optional(v.array(v.string())),
  issuerName: v.optional(v.string()),
  certificateTitle: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
});

export const instructorComplianceSummaryValidator = v.object({
  diditApproved: v.boolean(),
  diditStatus: v.optional(diditVerificationStatusValidator),
  canApplyToJobs: v.boolean(),
  canBeAcceptedForJobs: v.boolean(),
  blockingReasons: v.array(instructorJobActionBlockReasonValidator),
  publicCertificates: v.array(instructorPublicCertificateValidator),
  hasApprovedInsurance: v.boolean(),
  pendingCertificateCount: v.number(),
  pendingInsuranceCount: v.number(),
});

function isApprovedInsuranceActive(
  row: Doc<"instructorInsurancePolicies">,
  now: number,
) {
  return (
    row.reviewStatus === "approved" && (!row.expiresAt || row.expiresAt > now)
  );
}

function getApprovedCertificateSports(
  rows: ReadonlyArray<Doc<"instructorCertificates">>,
) {
  const sports = new Set<string>();
  for (const row of rows) {
    if (row.reviewStatus !== "approved") {
      continue;
    }
    const coveredSports =
      row.coveredSports && row.coveredSports.length > 0
        ? row.coveredSports
        : row.sport
          ? [row.sport]
          : [];
    for (const sport of coveredSports) {
      sports.add(normalizeSportType(sport));
    }
  }
  return sports;
}

function getApprovedCertificateGenres(
  rows: ReadonlyArray<Doc<"instructorCertificates">>,
) {
  const genres = new Set<string>();
  for (const row of rows) {
    if (row.reviewStatus !== "approved") {
      continue;
    }
    const coveredSports =
      row.coveredSports && row.coveredSports.length > 0
        ? row.coveredSports
        : row.sport
          ? [row.sport]
          : [];
    for (const sport of coveredSports) {
      const genreKey = getSportGenreKey(sport);
      if (genreKey) {
        genres.add(genreKey);
      }
    }
  }
  return genres;
}

function hasCertificateCoverageForSport(args: {
  sport: string;
  compliance: InstructorComplianceSnapshot;
}) {
  const normalizedSport = normalizeSportType(args.sport);
  if (args.compliance.approvedCertificateSports.has(normalizedSport)) {
    return true;
  }

  if (STRICT_INSTRUCTOR_CERTIFICATE_SUBSPORT_ENFORCEMENT) {
    return false;
  }

  const genreKey = getSportGenreKey(normalizedSport);
  return genreKey
    ? args.compliance.approvedCertificateGenres.has(genreKey)
    : false;
}

export async function loadInstructorComplianceSnapshot(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
  now: number,
): Promise<InstructorComplianceSnapshot> {
  const [insuranceRows, certificateRows] = await Promise.all([
    ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructorId))
      .collect(),
    ctx.db
      .query("instructorCertificates")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructorId))
      .collect(),
  ]);

  return {
    hasApprovedInsurance: insuranceRows.some((row) =>
      isApprovedInsuranceActive(row, now),
    ),
    approvedCertificateSports: getApprovedCertificateSports(certificateRows),
    approvedCertificateGenres: getApprovedCertificateGenres(certificateRows),
  };
}

export function getInstructorGlobalJobActionBlockReasons(args: {
  profile: Doc<"instructorProfiles">;
  compliance: InstructorComplianceSnapshot;
}) {
  const reasons: InstructorJobActionBlockReason[] = [];
  if (args.profile.diditVerificationStatus !== "approved") {
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
}): InstructorJobActionBlockReason | undefined {
  if (args.profile.diditVerificationStatus !== "approved") {
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
    sports:
      row.coveredSports && row.coveredSports.length > 0
        ? row.coveredSports
        : row.sport
          ? [row.sport]
          : [],
    ...omitUndefined({
      machines: row.machineTags,
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
  const [publicCertificates, insuranceRows, certificateRows] =
    await Promise.all([
      getInstructorPublicCertificates(ctx, args.instructor._id),
      ctx.db
        .query("instructorInsurancePolicies")
        .withIndex("by_instructor", (q) =>
          q.eq("instructorId", args.instructor._id),
        )
        .collect(),
      ctx.db
        .query("instructorCertificates")
        .withIndex("by_instructor", (q) =>
          q.eq("instructorId", args.instructor._id),
        )
        .collect(),
    ]);

  const compliance = {
    hasApprovedInsurance: insuranceRows.some((row) =>
      isApprovedInsuranceActive(row, args.now),
    ),
    approvedCertificateSports: getApprovedCertificateSports(certificateRows),
    approvedCertificateGenres: getApprovedCertificateGenres(certificateRows),
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
    diditApproved: args.instructor.diditVerificationStatus === "approved",
    canApplyToJobs: blockingReasons.length === 0,
    canBeAcceptedForJobs: blockingReasons.length === 0,
    blockingReasons,
    publicCertificates,
    hasApprovedInsurance: compliance.hasApprovedInsurance,
    pendingCertificateCount,
    pendingInsuranceCount,
    ...omitUndefined({
      diditStatus: args.instructor.diditVerificationStatus,
    }),
  };
}
