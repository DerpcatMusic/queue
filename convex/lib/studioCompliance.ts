import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getStripeEnvPresence } from "../integrations/stripe/config";
import { resolveInternalAccessForUserId } from "./internalAccess";
import { omitUndefined } from "./validation";

type Ctx = QueryCtx | MutationCtx;

export type StudioComplianceBlockReason =
  | "business_profile_required"
  | "payment_method_required";

export const studioComplianceBlockReasonValidator = v.union(
  v.literal("business_profile_required"),
  v.literal("payment_method_required"),
);

export const studioBillingProfileStatusValidator = v.union(
  v.literal("incomplete"),
  v.literal("complete"),
);

export const studioLegalEntityTypeValidator = v.union(
  v.literal("individual"),
  v.literal("company"),
);

export const studioVatReportingTypeValidator = v.union(
  v.literal("osek_patur"),
  v.literal("osek_murshe"),
  v.literal("company"),
  v.literal("other"),
);

export const studioPaymentStatusValidator = v.union(
  v.literal("missing"),
  v.literal("pending"),
  v.literal("ready"),
  v.literal("failed"),
);

export const studioPaymentReadinessSourceValidator = v.union(
  v.literal("payment_profile"),
  v.literal("stripe_env"),
);

export const studioOwnerIdentityStatusValidator = v.union(
  v.literal("approved"),
  v.literal("pending"),
  v.literal("missing"),
  v.literal("failed"),
);

export const studioComplianceSummaryValidator = v.object({
  canBrowse: v.boolean(),
  canCreateDraftJobs: v.boolean(),
  canPublishJobs: v.boolean(),
  canRunPayments: v.boolean(),
  verificationBypassed: v.boolean(),
  blockingReasons: v.array(studioComplianceBlockReasonValidator),
  ownerIdentityStatus: studioOwnerIdentityStatusValidator,
  diditStatus: v.optional(v.string()),
  businessProfileStatus: studioBillingProfileStatusValidator,
  paymentStatus: studioPaymentStatusValidator,
  paymentProvider: v.optional(v.string()),
  paymentReadinessSource: studioPaymentReadinessSourceValidator,
});

function getOwnerIdentityStatus(
  studio: Pick<Doc<"studioProfiles">, "diditVerificationStatus">,
): "approved" | "pending" | "missing" | "failed" {
  void studio;
  return "approved";
}

function getBusinessProfileStatus(
  billingProfile: Doc<"studioBillingProfiles"> | null,
): "incomplete" | "complete" {
  if (!billingProfile) {
    return "incomplete";
  }
  return billingProfile.status;
}

export async function getStudioBillingProfile(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
) {
  return await ctx.db
    .query("studioBillingProfiles")
    .withIndex("by_studio", (q) => q.eq("studioId", studioId))
    .unique();
}

export async function getStudioPaymentProfile(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
) {
  return await ctx.db
    .query("studioPaymentProfiles")
    .withIndex("by_studio", (q) => q.eq("studioId", studioId))
    .unique();
}

function getLegacyPaymentStatus(): "missing" | "ready" {
  return getStripeEnvPresence().readyForCheckout ? "ready" : "missing";
}

async function getStudioPaymentReadiness(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
) {
  const paymentProfile = await getStudioPaymentProfile(ctx, studioId);
  if (paymentProfile) {
    return {
      status: paymentProfile.status,
      source: "payment_profile" as const,
      provider: paymentProfile.provider,
    };
  }

  return {
    status: getLegacyPaymentStatus(),
    source: "stripe_env" as const,
    provider: "stripe",
  };
}

export async function buildStudioComplianceSummary(
  ctx: Ctx,
  args: {
    studio: Doc<"studioProfiles">;
  },
) {
  const [billingProfile, paymentReadiness] = await Promise.all([
    getStudioBillingProfile(ctx, args.studio._id),
    getStudioPaymentReadiness(ctx, args.studio._id),
  ]);
  const access = await resolveInternalAccessForUserId(ctx, args.studio.userId);
  if (access.verificationBypass) {
    return {
      canBrowse: true,
      canCreateDraftJobs: true,
      canPublishJobs: true,
      canRunPayments: true,
      verificationBypassed: true,
      blockingReasons: [],
      ownerIdentityStatus: "approved" as const,
      businessProfileStatus: "complete" as const,
      paymentStatus: "ready" as const,
      ...omitUndefined({
        paymentProvider: paymentReadiness.provider,
      }),
      paymentReadinessSource: paymentReadiness.source,
    };
  }

  const ownerIdentityStatus = getOwnerIdentityStatus(args.studio);
  const businessProfileStatus = getBusinessProfileStatus(billingProfile);
  const paymentStatus = paymentReadiness.status;

  const blockingReasons: StudioComplianceBlockReason[] = [];
  if (businessProfileStatus !== "complete") {
    blockingReasons.push("business_profile_required");
  }
  if (paymentStatus !== "ready") {
    blockingReasons.push("payment_method_required");
  }

  return {
    canBrowse: true,
    canCreateDraftJobs: true,
    canPublishJobs: blockingReasons.length === 0,
    canRunPayments: paymentStatus === "ready",
    verificationBypassed: false,
    blockingReasons,
    ownerIdentityStatus,
    businessProfileStatus,
    paymentStatus,
    ...omitUndefined({
      paymentProvider: paymentReadiness.provider,
    }),
    paymentReadinessSource: paymentReadiness.source,
  };
}

export async function assertStudioCanPublishJobs(
  ctx: Ctx,
  studio: Doc<"studioProfiles">,
) {
  const summary = await buildStudioComplianceSummary(ctx, { studio });
  if (summary.canPublishJobs) {
    return summary;
  }

  throw new ConvexError(
    `Studio compliance required: ${summary.blockingReasons.join(", ") || "unknown_blocker"}`,
  );
}
