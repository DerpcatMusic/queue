import { v } from "convex/values";
import { query } from "./_generated/server";
import { getInstructorComplianceDetailsRead, instructorComplianceDetailsValidator } from "./compliance";
import { getStudioComplianceDetailsRead, studioComplianceDetailsValidator } from "./complianceStudio";
import { requireUserRole } from "./lib/auth";
import { diditVerificationStatusValidator } from "./lib/instructorCompliance";
import { internalAccessRoleValidator, resolveInternalAccessForUser } from "./lib/internalAccess";

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

type DiditProfileFields = {
  diditVerificationStatus: string | undefined;
  diditSessionId: string | undefined;
  diditLegalName: string | undefined;
  diditLegalFirstName: string | undefined;
  diditLegalMiddleName: string | undefined;
  diditLegalLastName: string | undefined;
  diditStatusRaw: string | undefined;
  diditLastEventAt: number | undefined;
  diditVerifiedAt: number | undefined;
  diditDecision: unknown;
};

function toStudioDiditStatus(ownerIdentityStatus: "approved" | "pending" | "missing" | "failed") {
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
  profile: DiditProfileFields,
  verificationBypass: boolean,
): DiditVerificationPayload {
  return {
    status:
      verificationBypass || profile.diditVerificationStatus === "approved"
        ? "approved"
        : ((profile.diditVerificationStatus ?? "not_started") as DiditVerificationPayload["status"]),
    isVerified: verificationBypass || profile.diditVerificationStatus === "approved",
    verificationBypassed: verificationBypass,
    ...(profile.diditSessionId ? { sessionId: profile.diditSessionId } : {}),
    ...(profile.diditLegalName ? { legalName: profile.diditLegalName } : {}),
    ...(profile.diditLegalFirstName ? { legalFirstName: profile.diditLegalFirstName } : {}),
    ...(profile.diditLegalMiddleName ? { legalMiddleName: profile.diditLegalMiddleName } : {}),
    ...(profile.diditLegalLastName ? { legalLastName: profile.diditLegalLastName } : {}),
    ...(profile.diditStatusRaw ? { statusRaw: profile.diditStatusRaw } : {}),
    ...(profile.diditLastEventAt ? { lastEventAt: profile.diditLastEventAt } : {}),
    ...(profile.diditVerifiedAt ? { verifiedAt: profile.diditVerifiedAt } : {}),
    ...(profile.diditDecision !== undefined ? { decision: profile.diditDecision } : {}),
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
    const [profile, compliance] = await Promise.all([
      ctx.db
        .query("instructorProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique(),
      getInstructorComplianceDetailsRead(ctx, {
        userId: user._id,
        now: args.now ?? Date.now(),
      }),
    ]);
    if (!compliance) {
      return null;
    }

    return {
      internalAccess,
      compliance,
      verification: buildDiditVerificationPayload(
        {
          diditVerificationStatus:
            profile?.diditVerificationStatus ?? compliance.summary.diditStatus,
          diditSessionId: profile?.diditSessionId,
          diditLegalName: profile?.diditLegalName,
          diditLegalFirstName: profile?.diditLegalFirstName,
          diditLegalMiddleName: profile?.diditLegalMiddleName,
          diditLegalLastName: profile?.diditLegalLastName,
          diditStatusRaw: profile?.diditStatusRaw,
          diditLastEventAt: profile?.diditLastEventAt,
          diditVerifiedAt: profile?.diditVerifiedAt,
          diditDecision: profile?.diditDecision,
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
    const studio = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!studio) {
      return null;
    }
    const compliance = await getStudioComplianceDetailsRead(ctx, { studioId: studio._id });
    if (!compliance) {
      return null;
    }

    return {
      internalAccess,
      compliance,
      verification: buildDiditVerificationPayload(
        {
          diditVerificationStatus:
            studio.diditVerificationStatus ??
            toStudioDiditStatus(compliance.summary.ownerIdentityStatus),
          diditSessionId: studio.diditSessionId,
          diditLegalName: studio.diditLegalName,
          diditLegalFirstName: studio.diditLegalFirstName,
          diditLegalMiddleName: studio.diditLegalMiddleName,
          diditLegalLastName: studio.diditLegalLastName,
          diditStatusRaw: studio.diditStatusRaw,
          diditLastEventAt: studio.diditLastEventAt,
          diditVerifiedAt: studio.diditVerifiedAt,
          diditDecision: studio.diditDecision,
        },
        internalAccess.verificationBypass,
      ),
    };
  },
});
