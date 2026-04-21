import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getStripeEnvPresence } from "../integrations/stripe/config";
import { getOverdueStudioSettlementState } from "../jobs/lifecycle";

type Ctx = QueryCtx | MutationCtx;

function getOwnerIdentityStatusFromStudioProfile(
  studio: Doc<"studioProfiles">,
): "approved" | "pending" | "missing" | "failed" | null {
  switch (studio.diditVerificationStatus) {
    case "approved":
      return "approved";
    case "pending":
    case "in_progress":
    case "in_review":
    case "abandoned":
    case "expired":
      return "pending";
    case "declined":
      return "failed";
    default:
      return null;
  }
}

function getBusinessProfileStatus(
  billingProfile: Doc<"studioBillingProfiles"> | null,
): "incomplete" | "complete" {
  if (!billingProfile) {
    return "incomplete";
  }
  return billingProfile.status;
}

export async function getStudioBillingProfile(ctx: Ctx, studioId: Id<"studioProfiles">) {
  return await ctx.db
    .query("studioBillingProfiles")
    .withIndex("by_studio", (q) => q.eq("studioId", studioId))
    .unique();
}

export async function getStudioPaymentProfile(ctx: Ctx, studioId: Id<"studioProfiles">) {
  return await ctx.db
    .query("studioPaymentProfiles")
    .withIndex("by_studio", (q) => q.eq("studioId", studioId))
    .unique();
}

export async function getStudioPaymentReadiness(ctx: Ctx, studioId: Id<"studioProfiles">) {
  const paymentProfile = await getStudioPaymentProfile(ctx, studioId);
  if (paymentProfile) {
    const hasReusableMethod =
      (paymentProfile.savedPaymentMethodCount ?? 0) > 0 && paymentProfile.chargesEnabled !== false;
    return {
      status:
        paymentProfile.status === "ready" && hasReusableMethod
          ? ("ready" as const)
          : paymentProfile.status === "failed"
            ? ("failed" as const)
            : paymentProfile.status === "pending"
              ? ("pending" as const)
              : ("missing" as const),
      source: "payment_profile" as const,
      provider: paymentProfile.provider,
    };
  }

  return {
    status: getStripeEnvPresence().readyForCheckout ? ("missing" as const) : ("missing" as const),
    source: "stripe_env" as const,
    provider: "stripe",
  };
}

export async function getActiveStudioOperationalBlock(ctx: Ctx, studioId: Id<"studioProfiles">) {
  return await ctx.db
    .query("studioOperationalBlocks")
    .withIndex("by_studio_active", (q) => q.eq("studioId", studioId).eq("active", true))
    .order("desc")
    .first();
}

export async function buildStudioComplianceSummary(
  ctx: Ctx,
  args: {
    studio: Doc<"studioProfiles">;
  },
) {
  const [billingProfile, paymentReadiness, overdueSettlementState] = await Promise.all([
    getStudioBillingProfile(ctx, args.studio._id),
    getStudioPaymentReadiness(ctx, args.studio._id),
    getOverdueStudioSettlementState(ctx, args.studio._id),
  ]);
  const activeBlock = await getActiveStudioOperationalBlock(ctx, args.studio._id);
  const ownerIdentityStatus = getOwnerIdentityStatusFromStudioProfile(args.studio) ?? "missing";
  const businessProfileStatus = getBusinessProfileStatus(billingProfile);
  const paymentStatus = paymentReadiness.status;
  const isSuspended = Boolean(activeBlock?.active || overdueSettlementState);

  const blockingReasons: Array<
    | "owner_identity_required"
    | "business_profile_required"
    | "payment_method_required"
    | "account_suspended"
  > = [];
  if (ownerIdentityStatus !== "approved") {
    blockingReasons.push("owner_identity_required");
  }
  if (businessProfileStatus !== "complete") {
    blockingReasons.push("business_profile_required");
  }
  if (paymentStatus !== "ready") {
    blockingReasons.push("payment_method_required");
  }
  if (isSuspended) {
    blockingReasons.push("account_suspended");
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
    paymentProvider: paymentReadiness.provider,
    suspensionReason:
      activeBlock?.reason ?? (overdueSettlementState ? "overdue_payment" : undefined),
    paymentReadinessSource: paymentReadiness.source,
  };
}
