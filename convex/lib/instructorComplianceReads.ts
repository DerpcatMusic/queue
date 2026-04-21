import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getApprovedCertificateGenres,
  getApprovedCertificateSports,
  getApprovedSpecialtyCapabilities,
  type InstructorComplianceSnapshot,
  isApprovedInsuranceActiveRow,
} from "./instructorComplianceShared";
import { getMarketRules } from "./marketRules";
import { getLatestStripeConnectedAccount, isStripeIdentityVerified } from "./stripeIdentity";

type Ctx = QueryCtx | MutationCtx;

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
  const stripeAccount = profile ? await getLatestStripeConnectedAccount(ctx, profile.userId) : null;
  const marketRules = getMarketRules(profile?.addressCountryCode ?? stripeAccount?.country);
  const requiresProfessionalRegistry = profile?.addressCountryCode?.toUpperCase() === "FR";
  const hasApprovedProfessionalRegistry =
    !requiresProfessionalRegistry ||
    (profile?.professionalRegistryCountry === "FR" &&
      profile.professionalRegistryStatus === "found" &&
      profile.professionalRegistryHasValidRegistration === true &&
      profile.professionalRegistryNameMatched === true &&
      (!profile.professionalRegistryExpiresAt || profile.professionalRegistryExpiresAt > now));

  return {
    hasVerificationBypass: false,
    hasApprovedIdentity: isStripeIdentityVerified(stripeAccount),
    hasApprovedInsurance:
      !marketRules.requiresInstructorInsurance ||
      insuranceRows.some((row) => isApprovedInsuranceActiveRow(row, now)),
    requiresProfessionalRegistry,
    hasApprovedProfessionalRegistry,
    approvedCertificateSports: getApprovedCertificateSports(approvedSpecialtyCapabilities),
    approvedCertificateGenres: getApprovedCertificateGenres(approvedSpecialtyCapabilities),
    approvedSpecialtyCapabilities,
  };
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
    specialties: row.specialties
      ? row.specialties.map((specialty) => ({
          sport: specialty.sport,
          ...(specialty.capabilityTags ? { capabilityTags: specialty.capabilityTags } : {}),
        }))
      : row.sport
        ? [{ sport: row.sport }]
        : [],
    ...(row.issuerName ? { issuerName: row.issuerName } : {}),
    ...(row.certificateTitle ? { certificateTitle: row.certificateTitle } : {}),
    ...(row.reviewedAt ? { verifiedAt: row.reviewedAt } : {}),
  }));
}

export async function getInstructorTrustSnapshot(
  ctx: Ctx,
  args: {
    instructor: Doc<"instructorProfiles">;
    now: number;
  },
) {
  const [publicCertificates, insuranceRows, stripeAccount] = await Promise.all([
    getInstructorPublicCertificates(ctx, args.instructor._id),
    ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_instructor", (q) => q.eq("instructorId", args.instructor._id))
      .collect(),
    getLatestStripeConnectedAccount(ctx, args.instructor.userId),
  ]);

  return {
    identityVerified: isStripeIdentityVerified(stripeAccount),
    insuranceVerified: insuranceRows.some((row) => isApprovedInsuranceActiveRow(row, args.now)),
    certificates: publicCertificates,
  };
}
