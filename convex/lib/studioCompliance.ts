import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getStripeEnvPresence } from "../integrations/stripe/config";
import { resolveInternalAccessForUserId } from "./internalAccess";
import {
  getLatestStripeConnectedAccount,
  isStripeIdentityVerified,
  mapStripeConnectedAccountStatusToIdentityStatus,
} from "./stripeIdentity";
import { omitUndefined } from "./validation";

type Ctx = QueryCtx | MutationCtx;

export type StudioComplianceBlockReason =
  | "owner_identity_required"
  | "business_profile_required"
  | "payment_method_required";

export const studioComplianceBlockReasonValidator = v.union(
  v.literal("owner_identity_required"),
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

export const studioTaxClassificationValidator = v.string();

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

function getOwnerIdentityStatusFromStripe(
  stripeAccount: Doc<"connectedAccountsV2"> | null,
): "approved" | "pending" | "missing" | "failed" {
  if (!stripeAccount) return "missing";
  if (isStripeIdentityVerified(stripeAccount)) return "approved";
  const mapped = mapStripeConnectedAccountStatusToIdentityStatus(stripeAccount.status);
  switch (mapped) {
    case "approved":
      return "approved";
    case "in_progress":
    case "pending":
    case "in_review":
      return "pending";
    case "declined":
      return "failed";
    default:
      return "missing";
  }
}

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

function getLegacyPaymentStatus(): "missing" | "ready" {
  return getStripeEnvPresence().readyForCheckout ? "ready" : "missing";
}

async function getStudioPaymentReadiness(ctx: Ctx, studioId: Id<"studioProfiles">) {
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
  const [billingProfile, paymentReadiness, stripeAccount] = await Promise.all([
    getStudioBillingProfile(ctx, args.studio._id),
    getStudioPaymentReadiness(ctx, args.studio._id),
    getLatestStripeConnectedAccount(ctx, args.studio.userId),
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

  const ownerIdentityStatus =
    getOwnerIdentityStatusFromStudioProfile(args.studio) ??
    getOwnerIdentityStatusFromStripe(stripeAccount);
  const businessProfileStatus = getBusinessProfileStatus(billingProfile);
  const paymentStatus = paymentReadiness.status;

  const blockingReasons: StudioComplianceBlockReason[] = [];
  if (ownerIdentityStatus !== "approved") {
    blockingReasons.push("owner_identity_required");
  }
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

export async function assertStudioCanPublishJobs(ctx: Ctx, studio: Doc<"studioProfiles">) {
  const summary = await buildStudioComplianceSummary(ctx, { studio });
  if (summary.canPublishJobs) {
    return summary;
  }

  throw new ConvexError(
    `Studio compliance required: ${summary.blockingReasons.join(", ") || "unknown_blocker"}`,
  );
}
