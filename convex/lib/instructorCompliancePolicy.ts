import type { Doc } from "../_generated/dataModel";
import { getInstructorPublicCertificates } from "./instructorComplianceReads";
import {
  getApprovedCertificateGenres,
  getApprovedCertificateSports,
  getApprovedSpecialtyCapabilities,
  hasCertificateCoverageForSport,
  type InstructorComplianceSnapshot,
} from "./instructorComplianceShared";
import { resolveInternalAccessForUserId } from "./internalAccess";
import { getMarketRules } from "./marketRules";
import { getLatestStripeConnectedAccount, isStripeIdentityVerified } from "./stripeIdentity";

export function getInstructorGlobalJobActionBlockReasons(args: {
  profile: Doc<"instructorProfiles">;
  compliance: InstructorComplianceSnapshot;
}) {
  if (args.compliance.hasVerificationBypass) {
    return [];
  }

  const reasons: Array<
    | "identity_verification_required"
    | "insurance_verification_required"
    | "sport_certificate_required"
    | "professional_registry_required"
  > = [];
  if (!args.compliance.hasApprovedIdentity) {
    reasons.push("identity_verification_required");
  }
  if (!args.compliance.hasApprovedInsurance) {
    reasons.push("insurance_verification_required");
  }
  if (
    args.compliance.requiresProfessionalRegistry &&
    !args.compliance.hasApprovedProfessionalRegistry
  ) {
    reasons.push("professional_registry_required");
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
}) {
  if (args.compliance.hasVerificationBypass) {
    return undefined;
  }

  if (!args.compliance.hasApprovedIdentity) {
    return "identity_verification_required" as const;
  }
  if (!args.compliance.hasApprovedInsurance) {
    return "insurance_verification_required" as const;
  }
  if (
    args.compliance.requiresProfessionalRegistry &&
    !args.compliance.hasApprovedProfessionalRegistry
  ) {
    return "professional_registry_required" as const;
  }
  if (!hasCertificateCoverageForSport(args)) {
    return "sport_certificate_required" as const;
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

export async function buildInstructorComplianceSummary(
  ctx: Parameters<typeof resolveInternalAccessForUserId>[0],
  args: {
    instructor: Doc<"instructorProfiles">;
    now: number;
  },
) {
  const [publicCertificates, insuranceRows, certificateRows, stripeAccount] = await Promise.all([
    getInstructorPublicCertificates(ctx, args.instructor._id),
    ctx.db
      .query("instructorInsurancePolicies")
      .withIndex("by_instructor", (q: any) => q.eq("instructorId", args.instructor._id))
      .collect(),
    ctx.db
      .query("instructorCertificates")
      .withIndex("by_instructor", (q: any) => q.eq("instructorId", args.instructor._id))
      .collect(),
    getLatestStripeConnectedAccount(ctx, args.instructor.userId),
  ]);

  const approvedSpecialtyCapabilities = getApprovedSpecialtyCapabilities(certificateRows);
  const access = await resolveInternalAccessForUserId(ctx, args.instructor.userId);
  const marketRules = getMarketRules(args.instructor.addressCountryCode ?? stripeAccount?.country);
  const requiresProfessionalRegistry = args.instructor.addressCountryCode?.toUpperCase() === "FR";
  const hasApprovedProfessionalRegistry =
    !requiresProfessionalRegistry ||
    (args.instructor.professionalRegistryCountry === "FR" &&
      args.instructor.professionalRegistryStatus === "found" &&
      args.instructor.professionalRegistryHasValidRegistration === true &&
      args.instructor.professionalRegistryNameMatched === true &&
      (!args.instructor.professionalRegistryExpiresAt ||
        args.instructor.professionalRegistryExpiresAt > args.now));
  const compliance = {
    hasVerificationBypass: access.verificationBypass,
    hasApprovedIdentity: access.verificationBypass || isStripeIdentityVerified(stripeAccount),
    hasApprovedInsurance:
      !marketRules.requiresInstructorInsurance ||
      insuranceRows.some(
        (row) => row.reviewStatus === "approved" && (!row.expiresAt || row.expiresAt > args.now),
      ),
    requiresProfessionalRegistry,
    hasApprovedProfessionalRegistry,
    approvedCertificateSports: getApprovedCertificateSports(approvedSpecialtyCapabilities),
    approvedCertificateGenres: getApprovedCertificateGenres(approvedSpecialtyCapabilities),
    approvedSpecialtyCapabilities,
  } satisfies InstructorComplianceSnapshot;

  const pendingCertificateCount = certificateRows.filter(
    (row: any) =>
      row.reviewStatus === "uploaded" ||
      row.reviewStatus === "ai_pending" ||
      row.reviewStatus === "ai_reviewing",
  ).length;
  const pendingInsuranceCount = insuranceRows.filter(
    (row: any) =>
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
    hasApprovedInsurance: compliance.hasApprovedInsurance,
    requiresProfessionalRegistry: compliance.requiresProfessionalRegistry,
    hasApprovedProfessionalRegistry: compliance.hasApprovedProfessionalRegistry,
    ...(requiresProfessionalRegistry
      ? {
          professionalRegistry: {
            country: "FR",
            ...(args.instructor.professionalRegistryProvider
              ? { provider: args.instructor.professionalRegistryProvider }
              : {}),
            ...(args.instructor.professionalRegistryIdentifier
              ? { identifier: args.instructor.professionalRegistryIdentifier }
              : {}),
            ...(args.instructor.professionalRegistryStatus
              ? { status: args.instructor.professionalRegistryStatus }
              : {}),
            ...(args.instructor.professionalRegistryCheckedAt
              ? { checkedAt: args.instructor.professionalRegistryCheckedAt }
              : {}),
            ...(args.instructor.professionalRegistryIsPublic !== undefined
              ? { isPublic: args.instructor.professionalRegistryIsPublic }
              : {}),
            ...(args.instructor.professionalRegistryHasValidRegistration !== undefined
              ? { hasValidRegistration: args.instructor.professionalRegistryHasValidRegistration }
              : {}),
            ...(args.instructor.professionalRegistryHolderName
              ? { holderName: args.instructor.professionalRegistryHolderName }
              : {}),
            ...(args.instructor.professionalRegistryIssuingAuthority
              ? { issuingAuthority: args.instructor.professionalRegistryIssuingAuthority }
              : {}),
            ...(args.instructor.professionalRegistryExpiresOn
              ? { expiresOn: args.instructor.professionalRegistryExpiresOn }
              : {}),
            ...(args.instructor.professionalRegistryExpiresAt
              ? { expiresAt: args.instructor.professionalRegistryExpiresAt }
              : {}),
            ...(args.instructor.professionalRegistryErrorCode
              ? { errorCode: args.instructor.professionalRegistryErrorCode }
              : {}),
            ...(args.instructor.professionalRegistryErrorMessage
              ? { errorMessage: args.instructor.professionalRegistryErrorMessage }
              : {}),
            ...(args.instructor.professionalRegistryNameMatched !== undefined
              ? { nameMatched: args.instructor.professionalRegistryNameMatched }
              : {}),
          },
        }
      : {}),
    pendingCertificateCount,
    pendingInsuranceCount,
    diditStatus: stripeAccount?.status,
  };
}
