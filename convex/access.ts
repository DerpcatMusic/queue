import { v } from "convex/values";
import { query } from "./_generated/server";
import { getInstructorComplianceDetailsRead, instructorComplianceDetailsValidator } from "./compliance";
import { getStudioComplianceDetailsRead, studioComplianceDetailsValidator } from "./complianceStudio";
import { requireUserRole } from "./lib/auth";
import { diditVerificationStatusValidator } from "./lib/instructorCompliance";
import { internalAccessRoleValidator, resolveInternalAccessForUser } from "./lib/internalAccess";
import {
  getLatestStripeConnectedAccount,
  isStripeIdentityVerified,
  mapStripeConnectedAccountStatusToIdentityStatus,
} from "./lib/stripeIdentity";

const diditVerificationPayloadValidator = v.object({
  status: diditVerificationStatusValidator,
  isVerified: v.boolean(),
  verificationBypassed: v.boolean(),
  sessionId: v.optional(v.string()),
  legalName: v.optional(v.string()),
  legalFirstName: v.optional(v.string()),
  legalMiddleName: v.optional(v.string()),
  legalLastName: v.optional(v.string()),
  statusRaw: v.optional(v.string()),
  lastEventAt: v.optional(v.number()),
  verifiedAt: v.optional(v.number()),
  decision: v.optional(v.any()),
});

type DiditVerificationPayload = {
  status: "not_started" | "in_progress" | "pending" | "in_review" | "approved" | "declined" | "abandoned" | "expired";
  isVerified: boolean;
  verificationBypassed: boolean;
  sessionId?: string;
  legalName?: string;
  legalFirstName?: string;
  legalMiddleName?: string;
  legalLastName?: string;
  statusRaw?: string;
  lastEventAt?: number;
  verifiedAt?: number;
  decision?: unknown;
};

type VerificationProfileFields = {
  identityStatus: string | undefined;
  sessionId: string | undefined;
  legalName: string | undefined;
  legalFirstName: string | undefined;
  legalMiddleName: string | undefined;
  legalLastName: string | undefined;
  statusRaw: string | undefined;
  lastEventAt: number | undefined;
  verifiedAt: number | undefined;
  decision: unknown;
};

function toStudioVerificationStatus(ownerIdentityStatus: "approved" | "pending" | "missing" | "failed") {
  switch (ownerIdentityStatus) {
    case "approved":
      return "approved" as const;
    case "pending":
      return "pending" as const;
    case "failed":
      return "declined" as const;
    default:
      return "not_started" as const;
  }
}

function buildDiditVerificationPayload(
  profile: VerificationProfileFields,
  verificationBypass: boolean,
): DiditVerificationPayload {
  return {
    status:
      verificationBypass || profile.identityStatus === "approved"
        ? "approved"
        : ((profile.identityStatus ?? "not_started") as DiditVerificationPayload["status"]),
    isVerified: verificationBypass || profile.identityStatus === "approved",
    verificationBypassed: verificationBypass,
    ...(profile.sessionId ? { sessionId: profile.sessionId } : {}),
    ...(profile.legalName ? { legalName: profile.legalName } : {}),
    ...(profile.legalFirstName ? { legalFirstName: profile.legalFirstName } : {}),
    ...(profile.legalMiddleName ? { legalMiddleName: profile.legalMiddleName } : {}),
    ...(profile.legalLastName ? { legalLastName: profile.legalLastName } : {}),
    ...(profile.statusRaw ? { statusRaw: profile.statusRaw } : {}),
    ...(profile.lastEventAt ? { lastEventAt: profile.lastEventAt } : {}),
    ...(profile.verifiedAt ? { verifiedAt: profile.verifiedAt } : {}),
    ...(profile.decision !== undefined ? { decision: profile.decision } : {}),
  };
}

export const getMyInstructorAccessSnapshot = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      internalAccess: v.object({
        role: v.optional(internalAccessRoleValidator),
        verificationBypass: v.boolean(),
        canManageInternalAccess: v.boolean(),
        source: v.union(
          v.literal("none"),
          v.literal("table"),
          v.literal("env"),
          v.literal("table+env"),
        ),
      }),
      verification: diditVerificationPayloadValidator,
      compliance: instructorComplianceDetailsValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const internalAccess = await resolveInternalAccessForUser(ctx, user);
    const [profile, compliance, stripeAccount] = await Promise.all([
      ctx.db
        .query("instructorProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique(),
      getInstructorComplianceDetailsRead(ctx, {
        userId: user._id,
        now: args.now ?? Date.now(),
      }),
      getLatestStripeConnectedAccount(ctx, user._id),
    ]);
    if (!compliance) {
      return null;
    }

    return {
      internalAccess,
      compliance,
      verification: buildDiditVerificationPayload(
        {
          identityStatus:
            isStripeIdentityVerified(stripeAccount)
              ? "approved"
              : mapStripeConnectedAccountStatusToIdentityStatus(stripeAccount?.status) ??
                compliance.summary.diditStatus,
          sessionId: stripeAccount?.providerAccountId,
          legalName: profile?.diditLegalName ?? user.fullName ?? profile?.displayName,
          legalFirstName: profile?.diditLegalFirstName,
          legalMiddleName: profile?.diditLegalMiddleName,
          legalLastName: profile?.diditLegalLastName,
          statusRaw: stripeAccount?.status,
          lastEventAt: stripeAccount?.updatedAt,
          verifiedAt: stripeAccount?.activatedAt,
          decision: stripeAccount?.metadata,
        },
        internalAccess.verificationBypass,
      ),
    };
  },
});

export const getMyStudioAccessSnapshot = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      internalAccess: v.object({
        role: v.optional(internalAccessRoleValidator),
        verificationBypass: v.boolean(),
        canManageInternalAccess: v.boolean(),
        source: v.union(
          v.literal("none"),
          v.literal("table"),
          v.literal("env"),
          v.literal("table+env"),
        ),
      }),
      verification: diditVerificationPayloadValidator,
      compliance: studioComplianceDetailsValidator,
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const internalAccess = await resolveInternalAccessForUser(ctx, user);

    const [studio, stripeAccount] = await Promise.all([
      ctx.db
        .query("studioProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique(),
      getLatestStripeConnectedAccount(ctx, user._id),
    ]);
    if (!studio) {
      return null;
    }

    const compliance = await getStudioComplianceDetailsRead(ctx, { studioId: studio._id });
    if (!compliance) {
      return null;
    }

    // Derive identity status from Stripe connected account (same as instructor flow)
    const stripeIdentityStatus =
      isStripeIdentityVerified(stripeAccount)
        ? "approved"
        : mapStripeConnectedAccountStatusToIdentityStatus(stripeAccount?.status) ??
          toStudioVerificationStatus(compliance.summary.ownerIdentityStatus);

    return {
      internalAccess,
      compliance,
      verification: buildDiditVerificationPayload(
        {
          identityStatus: stripeIdentityStatus,
          sessionId: stripeAccount?.providerAccountId,
          legalName: studio.diditLegalName ?? user.fullName ?? studio.studioName,
          legalFirstName: studio.diditLegalFirstName,
          legalMiddleName: studio.diditLegalMiddleName,
          legalLastName: studio.diditLegalLastName,
          statusRaw: stripeAccount?.status,
          lastEventAt: stripeAccount?.updatedAt ?? studio.diditLastEventAt,
          verifiedAt: stripeAccount?.activatedAt ?? studio.diditVerifiedAt,
          decision: stripeAccount?.metadata,
        },
        internalAccess.verificationBypass,
      ),
    };
  },
});
