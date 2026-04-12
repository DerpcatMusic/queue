import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getStripeEnvPresence, getStripeMarketDefaults } from "./integrations/stripe/config";
import { requireCurrentUser, requireUserRole } from "./lib/auth";
import { omitUndefined } from "./lib/validation";
import { computePricingV2 } from "./paymentsPricingV2";

const DEFAULT_PROVIDER_COUNTRY = getStripeMarketDefaults().country;
const DEFAULT_PROVIDER_CURRENCY = getStripeMarketDefaults().currency;
const paymentProviderValidator = v.union(v.literal("airwallex"), v.literal("stripe"));

const paymentOfferStatusValidator = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("superseded"),
  v.literal("paid"),
  v.literal("cancelled"),
);

const paymentOrderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("requires_payment_method"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("partially_refunded"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const payoutTransferStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("sent"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("needs_attention"),
);

const connectedAccountSummaryValidator = v.object({
  _id: v.id("connectedAccountsV2"),
  provider: paymentProviderValidator,
  providerAccountId: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("action_required"),
    v.literal("active"),
    v.literal("restricted"),
    v.literal("rejected"),
    v.literal("disabled"),
  ),
  requirementsSummary: v.optional(v.string()),
});

const connectedAccountOnboardingSummaryValidator = v.object({
  _id: v.id("connectedAccountsV2"),
  provider: paymentProviderValidator,
  providerAccountId: v.string(),
  accountCapability: v.union(v.literal("ledger"), v.literal("withdrawal"), v.literal("full")),
  status: v.union(
    v.literal("pending"),
    v.literal("action_required"),
    v.literal("active"),
    v.literal("restricted"),
    v.literal("rejected"),
    v.literal("disabled"),
  ),
  country: v.string(),
  currency: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  activatedAt: v.optional(v.number()),
  requirementsSummary: v.optional(v.string()),
});

const paymentOfferSummaryValidator = v.object({
  _id: v.id("paymentOffersV2"),
  jobId: v.id("jobs"),
  studioId: v.id("studioProfiles"),
  studioUserId: v.id("users"),
  instructorId: v.id("instructorProfiles"),
  instructorUserId: v.id("users"),
  providerCountry: v.string(),
  currency: v.string(),
  pricing: v.object({
    baseLessonAmountAgorot: v.number(),
    bonusAmountAgorot: v.number(),
    instructorOfferAmountAgorot: v.number(),
    platformServiceFeeAgorot: v.number(),
    studioChargeAmountAgorot: v.number(),
  }),
  pricingSnapshot: v.object({
    pricingRuleVersion: v.string(),
    feeMode: v.union(v.literal("standard"), v.literal("bonus")),
    hasBonus: v.boolean(),
  }),
  bonusReason: v.optional(v.string()),
  status: paymentOfferStatusValidator,
  expiresAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const paymentOrderSummaryValidator = v.object({
  _id: v.id("paymentOrdersV2"),
  offerId: v.id("paymentOffersV2"),
  jobId: v.id("jobs"),
  studioId: v.id("studioProfiles"),
  studioUserId: v.id("users"),
  instructorId: v.id("instructorProfiles"),
  instructorUserId: v.id("users"),
  provider: paymentProviderValidator,
  status: paymentOrderStatusValidator,
  providerCountry: v.string(),
  currency: v.string(),
  pricing: v.object({
    baseLessonAmountAgorot: v.number(),
    bonusAmountAgorot: v.number(),
    instructorOfferAmountAgorot: v.number(),
    platformServiceFeeAgorot: v.number(),
    studioChargeAmountAgorot: v.number(),
  }),
  capturedAmountAgorot: v.number(),
  refundedAmountAgorot: v.number(),
  correlationKey: v.string(),
  latestError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  succeededAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
});

const paymentAttemptSummaryValidator = v.object({
  _id: v.id("paymentAttemptsV2"),
  paymentOrderId: v.id("paymentOrdersV2"),
  provider: paymentProviderValidator,
  providerPaymentIntentId: v.string(),
  providerAttemptId: v.optional(v.string()),
  clientSecretRef: v.optional(v.string()),
  status: paymentOrderStatusValidator,
  statusRaw: v.optional(v.string()),
  requestId: v.string(),
  idempotencyKey: v.string(),
  metadata: v.optional(v.record(v.string(), v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const paymentCheckoutContextValidator = v.union(
  v.null(),
  v.object({
    offer: paymentOfferSummaryValidator,
    order: v.union(v.null(), paymentOrderSummaryValidator),
    attempt: v.union(v.null(), paymentAttemptSummaryValidator),
    connectedAccount: v.union(v.null(), connectedAccountSummaryValidator),
    instructorConnectedAccountRequired: v.boolean(),
  }),
);

const fundSplitSummaryValidator = v.object({
  _id: v.id("fundSplitsV2"),
  paymentOrderId: v.id("paymentOrdersV2"),
  paymentAttemptId: v.id("paymentAttemptsV2"),
  connectedAccountId: v.id("connectedAccountsV2"),
  provider: paymentProviderValidator,
  sourcePaymentIntentId: v.string(),
  destinationAccountId: v.string(),
  amountAgorot: v.number(),
  currency: v.string(),
  autoRelease: v.boolean(),
  releaseMode: v.union(v.literal("automatic"), v.literal("manual"), v.literal("scheduled")),
  status: v.union(
    v.literal("pending_create"),
    v.literal("created"),
    v.literal("released"),
    v.literal("settled"),
    v.literal("failed"),
    v.literal("reversed"),
  ),
  requestId: v.string(),
  idempotencyKey: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  providerFundsSplitId: v.optional(v.string()),
  failureReason: v.optional(v.string()),
  releasedAt: v.optional(v.number()),
  settledAt: v.optional(v.number()),
});

const toAgorot = (amount: number): number => Math.max(0, Math.round(amount * 100));

const normalizeOptionalText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const mapAirwallexAccountStatusToCanonical = (
  providerStatusRaw: string,
): Doc<"connectedAccountsV2">["status"] => {
  switch (providerStatusRaw) {
    case "ACTIVE":
      return "active";
    case "SUBMITTED":
    case "ACTION_REQUIRED":
    case "CREATED":
      return "action_required";
    case "REJECTED":
      return "rejected";
    case "SUSPENDED":
    case "DISABLED":
      return "disabled";
    default:
      return "pending";
  }
};

type CompatibilityInvoiceSummary = {
  _id: string;
  status: "pending" | "issued" | "failed";
  externalInvoiceId?: string;
  externalInvoiceUrl?: string;
  issuedAt?: number;
} | null;

type CompatibilityReceiptSummary = {
  status: "pending" | "ready";
  issuedAt?: number;
  documentUrl?: string;
  receiptNumber?: string;
};

const mapV2OrderStatusToLegacy = (
  status: Doc<"paymentOrdersV2">["status"],
): "created" | "pending" | "authorized" | "captured" | "failed" | "cancelled" | "refunded" => {
  switch (status) {
    case "draft":
    case "requires_payment_method":
      return "created";
    case "processing":
      return "pending";
    case "succeeded":
      return "captured";
    case "partially_refunded":
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "created";
  }
};

const mapV2TransferStatusToLegacy = (
  status: Doc<"payoutTransfersV2">["status"],
):
  | "queued"
  | "processing"
  | "pending_provider"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention" => {
  switch (status) {
    case "pending":
      return "queued";
    case "processing":
      return "processing";
    case "sent":
      return "pending_provider";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "needs_attention":
      return "needs_attention";
    default:
      return "pending_provider";
  }
};

const mapV2SplitStatusToLegacy = (
  status: Doc<"fundSplitsV2">["status"],
):
  | "queued"
  | "processing"
  | "pending_provider"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention" => {
  switch (status) {
    case "settled":
      return "paid";
    case "failed":
      return "failed";
    case "reversed":
      return "cancelled";
    case "released":
      return "processing";
    case "created":
    case "pending_create":
      return "pending_provider";
    default:
      return "pending_provider";
  }
};

const mapStripeStatusToLegacyIdentityStatus = (
  status: Doc<"connectedAccountsV2">["status"],
): Doc<"instructorProfiles">["diditVerificationStatus"] => {
  switch (status) {
    case "active":
      return "approved";
    case "pending":
      return "in_progress";
    case "action_required":
    case "restricted":
      return "pending";
    case "rejected":
    case "disabled":
      return "declined";
    default:
      return "not_started";
  }
};

async function listV2OrdersForCurrentUser(
  ctx: Parameters<typeof requireCurrentUser>[0],
  args: { limit?: number },
) {
  const user = await requireCurrentUser(ctx);
  const rawLimit = Math.floor(args.limit ?? 20);
  const limit = Math.min(Math.max(rawLimit, 1), 300);

  let orders: Doc<"paymentOrdersV2">[] = [];
  if (user.role === "studio") {
    orders = await ctx.db
      .query("paymentOrdersV2")
      .withIndex("by_studio_user", (q) => q.eq("studioUserId", user._id))
      .order("desc")
      .take(limit);
  } else if (user.role === "instructor") {
    orders = await ctx.db
      .query("paymentOrdersV2")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
      .order("desc")
      .take(limit);
  }

  if (orders.length === 0) {
    return [] as Array<{
      payment: {
        _id: Id<"paymentOrdersV2">;
        jobId: Id<"jobs">;
        status:
          | "created"
          | "pending"
          | "authorized"
          | "captured"
          | "failed"
          | "cancelled"
          | "refunded";
        currency: string;
        studioChargeAmountAgorot: number;
        instructorBaseAmountAgorot: number;
        platformMarkupAmountAgorot: number;
        createdAt: number;
      };
      payout: {
        status:
          | "queued"
          | "processing"
          | "pending_provider"
          | "paid"
          | "failed"
          | "cancelled"
          | "needs_attention";
        settledAt?: number;
      } | null;
      invoice: CompatibilityInvoiceSummary;
      job: {
        _id: Id<"jobs">;
        sport: string;
        startTime: number;
        status: Doc<"jobs">["status"];
      } | null;
    }>;
  }

  const [jobs, splitGroups, attemptGroups] = await Promise.all([
    Promise.all(orders.map((order) => ctx.db.get("jobs", order.jobId))),
    Promise.all(
      orders.map((order) =>
        ctx.db
          .query("fundSplitsV2")
          .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
          .order("desc")
          .collect(),
      ),
    ),
    Promise.all(
      orders.map((order) =>
        ctx.db
          .query("paymentAttemptsV2")
          .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
          .order("desc")
          .collect(),
      ),
    ),
  ]);

  const latestTransferBySplitId = new Map<string, Doc<"payoutTransfersV2">>();
  for (const splits of splitGroups) {
    for (const split of splits) {
      const transfer = await ctx.db
        .query("payoutTransfersV2")
        .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
        .order("desc")
        .first();
      if (transfer) {
        latestTransferBySplitId.set(String(split._id), transfer);
      }
    }
  }

  return orders.map((order, index) => {
    const latestSplit = splitGroups[index]?.[0] ?? null;
    const latestTransfer = latestSplit
      ? (latestTransferBySplitId.get(String(latestSplit._id)) ?? null)
      : null;
    const job = jobs[index];
    const latestAttempt = attemptGroups[index]?.[0] ?? null;
    const legacyPaymentStatus = mapV2OrderStatusToLegacy(order.status);

    return {
      payment: {
        _id: order._id,
        jobId: order.jobId,
        status: latestAttempt?.status === "succeeded" ? "captured" : legacyPaymentStatus,
        currency: order.currency,
        studioChargeAmountAgorot: order.pricing.studioChargeAmountAgorot,
        instructorBaseAmountAgorot: order.pricing.instructorOfferAmountAgorot,
        platformMarkupAmountAgorot: order.pricing.platformServiceFeeAgorot,
        createdAt: order.createdAt,
      },
      payout: latestTransfer
        ? {
            status: mapV2TransferStatusToLegacy(latestTransfer.status),
            ...omitUndefined({
              settledAt: latestTransfer.paidAt,
            }),
          }
        : latestSplit
          ? {
              status: mapV2SplitStatusToLegacy(latestSplit.status),
              ...omitUndefined({
                settledAt: latestSplit.settledAt,
              }),
            }
          : null,
      job: job
        ? {
            _id: job._id,
            sport: job.sport,
            startTime: job.startTime,
            status: job.status,
          }
        : null,
      invoice: null as CompatibilityInvoiceSummary,
    };
  });
}

const projectPaymentOffer = (offer: Doc<"paymentOffersV2">) => ({
  _id: offer._id,
  jobId: offer.jobId,
  studioId: offer.studioId,
  studioUserId: offer.studioUserId,
  instructorId: offer.instructorId,
  instructorUserId: offer.instructorUserId,
  providerCountry: offer.providerCountry,
  currency: offer.currency,
  pricing: offer.pricing,
  pricingSnapshot: offer.pricingSnapshot,
  ...omitUndefined({
    bonusReason: offer.bonusReason,
    expiresAt: offer.expiresAt,
  }),
  status: offer.status,
  createdAt: offer.createdAt,
  updatedAt: offer.updatedAt,
});

const projectPaymentOrder = (order: Doc<"paymentOrdersV2">) => ({
  _id: order._id,
  offerId: order.offerId,
  jobId: order.jobId,
  studioId: order.studioId,
  studioUserId: order.studioUserId,
  instructorId: order.instructorId,
  instructorUserId: order.instructorUserId,
  provider: order.provider,
  status: order.status,
  providerCountry: order.providerCountry,
  currency: order.currency,
  pricing: order.pricing,
  capturedAmountAgorot: order.capturedAmountAgorot,
  refundedAmountAgorot: order.refundedAmountAgorot,
  correlationKey: order.correlationKey,
  ...omitUndefined({
    latestError: order.latestError,
    succeededAt: order.succeededAt,
    cancelledAt: order.cancelledAt,
  }),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const projectPaymentAttempt = (attempt: Doc<"paymentAttemptsV2">) => ({
  _id: attempt._id,
  paymentOrderId: attempt.paymentOrderId,
  provider: attempt.provider,
  providerPaymentIntentId: attempt.providerPaymentIntentId,
  ...omitUndefined({
    providerAttemptId: attempt.providerAttemptId,
    clientSecretRef: attempt.clientSecretRef,
    statusRaw: attempt.statusRaw,
    metadata: attempt.metadata,
  }),
  status: attempt.status,
  requestId: attempt.requestId,
  idempotencyKey: attempt.idempotencyKey,
  createdAt: attempt.createdAt,
  updatedAt: attempt.updatedAt,
});

const projectConnectedAccount = (account: Doc<"connectedAccountsV2">) => ({
  _id: account._id,
  provider: account.provider,
  providerAccountId: account.providerAccountId,
  accountCapability: account.accountCapability,
  status: account.status,
  country: account.country,
  currency: account.currency,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  ...omitUndefined({
    activatedAt: account.activatedAt,
    requirementsSummary: account.metadata?.requirementsSummary,
  }),
});

function mapStripeProviderStatusToCanonical(
  providerStatusRaw: string,
): Doc<"connectedAccountsV2">["status"] {
  switch (providerStatusRaw) {
    case "active":
      return "active";
    case "restricted":
      return "action_required";
    case "unsupported":
      return "disabled";
    default:
      return "pending";
  }
}

const projectFundSplit = (split: Doc<"fundSplitsV2">) => ({
  _id: split._id,
  paymentOrderId: split.paymentOrderId,
  paymentAttemptId: split.paymentAttemptId,
  connectedAccountId: split.connectedAccountId,
  provider: split.provider,
  sourcePaymentIntentId: split.sourcePaymentIntentId,
  destinationAccountId: split.destinationAccountId,
  amountAgorot: split.amountAgorot,
  currency: split.currency,
  autoRelease: split.autoRelease,
  releaseMode: split.releaseMode,
  status: split.status,
  requestId: split.requestId,
  idempotencyKey: split.idempotencyKey,
  createdAt: split.createdAt,
  updatedAt: split.updatedAt,
  ...omitUndefined({
    providerFundsSplitId: split.providerFundsSplitId,
    failureReason: split.failureReason,
    releasedAt: split.releasedAt,
    settledAt: split.settledAt,
  }),
});

async function loadLatestConnectedAccountForUser(
  ctx: Parameters<typeof requireCurrentUser>[0],
  userId: Id<"users">,
  provider?: Doc<"connectedAccountsV2">["provider"],
) {
  const accounts = await ctx.db
    .query("connectedAccountsV2")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);

  return provider
    ? (accounts.find((account) => account.provider === provider) ?? null)
    : (accounts[0] ?? null);
}

async function loadCurrentStudio(ctx: Parameters<typeof requireUserRole>[0]) {
  const user = await requireUserRole(ctx, ["studio"]);
  const studio = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();
  if (!studio) {
    throw new ConvexError("Studio profile not found");
  }
  return { user, studio };
}

async function loadJobContext(ctx: Parameters<typeof requireUserRole>[0], jobId: Id<"jobs">) {
  const { user, studio } = await loadCurrentStudio(ctx);
  const job = await ctx.db.get("jobs", jobId);
  if (!job) {
    throw new ConvexError("Job not found");
  }
  if (job.studioId !== studio._id) {
    throw new ConvexError("Unauthorized job");
  }
  if (!job.filledByInstructorId) {
    throw new ConvexError("Job is not assigned to an instructor yet");
  }

  const instructor = await ctx.db.get("instructorProfiles", job.filledByInstructorId);
  if (!instructor) {
    throw new ConvexError("Instructor profile not found");
  }

  const instructorUserId = instructor.userId;

  return { user, studio, job, instructor, instructorUserId };
}

export const getMyStudioPaymentOfferV2 = query({
  args: { jobId: v.id("jobs") },
  returns: paymentOfferSummaryValidator,
  handler: async (ctx, args) => {
    const { studio } = await loadCurrentStudio(ctx);
    const offer = await ctx.db
      .query("paymentOffersV2")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
    if (!offer || offer.studioId !== studio._id) {
      throw new ConvexError("Payment offer not found");
    }
    return projectPaymentOffer(offer);
  },
});

export const listMyPaymentsV2 = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => await listV2OrdersForCurrentUser(ctx, args),
});

export const getMyPaymentDetailV2 = query({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const order = await ctx.db.get("paymentOrdersV2", args.paymentOrderId);
    if (!order) {
      return null;
    }
    if (order.studioUserId !== user._id && order.instructorUserId !== user._id) {
      throw new ConvexError("Not authorized");
    }

    const [job, attempts, splits] = await Promise.all([
      ctx.db.get("jobs", order.jobId),
      ctx.db
        .query("paymentAttemptsV2")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("fundSplitsV2")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
        .order("desc")
        .take(20),
    ]);

    const transfers = await Promise.all(
      splits.map((split) =>
        ctx.db
          .query("payoutTransfersV2")
          .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
          .order("desc")
          .first(),
      ),
    );
    const latestSplit = splits[0] ?? null;
    const latestTransfer = transfers[0] ?? null;
    const latestAttempt = attempts[0] ?? null;
    const receiptUrl = latestAttempt?.metadata?.receipt_url;
    const receiptNumber = latestAttempt?.metadata?.receipt_number;

    const timeline = [
      {
        _id: `payment-order:${order._id}`,
        createdAt: order.createdAt,
        title: `payment_order.${order.status}`,
        description: order.correlationKey,
        signatureValid: true,
        processed: true,
      },
      ...attempts.map((attempt) => ({
        _id: `payment-attempt:${attempt._id}`,
        createdAt: attempt.updatedAt,
        title: `payment_attempt.${attempt.status}`,
        description: attempt.statusRaw ?? attempt.providerPaymentIntentId,
        signatureValid: true,
        processed: true,
      })),
      ...splits.map((split) => ({
        _id: `fund-split:${split._id}`,
        createdAt: split.updatedAt,
        title: `fund_split.${split.status}`,
        description: split.providerFundsSplitId ?? split.destinationAccountId,
        signatureValid: true,
        processed: true,
      })),
      ...transfers
        .filter((transfer): transfer is Doc<"payoutTransfersV2"> => Boolean(transfer))
        .map((transfer) => ({
          _id: `payout-transfer:${transfer._id}`,
          createdAt: transfer.updatedAt,
          title: `payout_transfer.${transfer.status}`,
          description: transfer.statusRaw ?? transfer.providerTransferId ?? transfer.requestId,
          signatureValid: true,
          processed: true,
        })),
    ].sort((left, right) => right.createdAt - left.createdAt);

    return {
      payment: {
        _id: order._id,
        status: mapV2OrderStatusToLegacy(order.status),
        currency: order.currency,
        studioChargeAmountAgorot: order.pricing.studioChargeAmountAgorot,
        instructorBaseAmountAgorot: order.pricing.instructorOfferAmountAgorot,
        platformMarkupAmountAgorot: order.pricing.platformServiceFeeAgorot,
        createdAt: order.createdAt,
      },
      job,
      payout: latestTransfer
        ? {
            status: mapV2TransferStatusToLegacy(latestTransfer.status),
            settledAt: latestTransfer.paidAt,
          }
        : latestSplit
          ? {
              status: mapV2SplitStatusToLegacy(latestSplit.status),
              settledAt: latestSplit.settledAt,
            }
          : null,
      invoice: null as CompatibilityInvoiceSummary,
      timeline,
      fundSplit: latestSplit
        ? {
            _id: latestSplit._id,
            provider: latestSplit.provider,
            status: latestSplit.status,
            payoutStatus: mapV2SplitStatusToLegacy(latestSplit.status),
            releaseMode: latestSplit.releaseMode,
            autoRelease: latestSplit.autoRelease,
            releasedAt: latestSplit.releasedAt,
            settledAt: latestSplit.settledAt,
            canRelease: false,
          }
        : null,
      receipt: {
        status:
          order.status === "succeeded" || Boolean(latestSplit)
            ? ("ready" as const)
            : ("pending" as const),
        issuedAt: order.succeededAt ?? order.createdAt,
        ...(receiptUrl ? { documentUrl: receiptUrl } : {}),
        ...(receiptNumber ? { receiptNumber } : {}),
      } satisfies CompatibilityReceiptSummary,
    };
  },
});

export const getMyPayoutSummaryV2 = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const orders = await ctx.db
      .query("paymentOrdersV2")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
      .order("desc")
      .collect();
    const connectedAccount = await loadLatestConnectedAccountForUser(ctx, user._id, "stripe");

    let currency = orders[0]?.currency ?? DEFAULT_PROVIDER_CURRENCY;
    const availableAmountAgorot = 0;
    let pendingAmountAgorot = 0;
    let paidAmountAgorot = 0;
    let attentionAmountAgorot = 0;
    const availablePaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let paidPaymentsCount = 0;
    let attentionPaymentsCount = 0;

    for (const order of orders) {
      currency = order.currency || currency;
      const split = await ctx.db
        .query("fundSplitsV2")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
        .order("desc")
        .first();
      const transfer = split
        ? await ctx.db
            .query("payoutTransfersV2")
            .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
            .order("desc")
            .first()
        : null;

      const amountAgorot = order.pricing.instructorOfferAmountAgorot;
      const paid = transfer?.status === "paid" || split?.status === "settled";
      const attention =
        transfer?.status === "failed" ||
        transfer?.status === "cancelled" ||
        transfer?.status === "needs_attention" ||
        split?.status === "failed" ||
        split?.status === "reversed";

      if (paid) {
        paidAmountAgorot += amountAgorot;
        paidPaymentsCount += 1;
        continue;
      }
      if (attention) {
        attentionAmountAgorot += amountAgorot;
        attentionPaymentsCount += 1;
        continue;
      }
      if (order.status === "succeeded" || order.status === "processing") {
        pendingAmountAgorot += amountAgorot;
        pendingPaymentsCount += 1;
      }
    }

    return {
      payoutReleaseMode: "automatic",
      sandboxSelfVerifyEnabled: false,
      payoutPreferenceMode: "immediate_when_eligible",
      payoutPreferenceScheduledDate: null,
      currency,
      hasVerifiedDestination: connectedAccount?.status === "active",
      isIdentityVerified:
        connectedAccount?.status === "active" || connectedAccount?.status === "action_required",
      verifiedDestination: connectedAccount
        ? {
            _id: connectedAccount._id,
            type: "stripe_connected_account",
            label: "Stripe connected account",
            country: connectedAccount.country,
            currency: connectedAccount.currency,
            last4: undefined,
          }
        : null,
      heldAmountAgorot: 0,
      availableAmountAgorot,
      pendingAmountAgorot,
      paidAmountAgorot,
      attentionAmountAgorot,
      outstandingAmountAgorot: availableAmountAgorot + pendingAmountAgorot,
      lifetimeEarnedAmountAgorot: availableAmountAgorot + pendingAmountAgorot + paidAmountAgorot,
      availablePaymentsCount,
      pendingPaymentsCount,
      paidPaymentsCount,
      attentionPaymentsCount,
      onboardingStatus: connectedAccount?.status ?? null,
      onboardingUpdatedAt: connectedAccount?.updatedAt ?? null,
      onboardingLastError: null,
    };
  },
});

export const getPaymentsPreflightV2 = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    const env = getStripeEnvPresence();
    const invoice = {
      INVOICE_PROVIDER: Boolean(process.env.INVOICE_PROVIDER?.trim()),
    };

    return {
      mode: env.readyForCheckout ? "stripe" : "missing",
      payoutReleaseMode: "automatic",
      currency: DEFAULT_PROVIDER_CURRENCY,
      webhookMaxSkewSeconds: 300,
      stripe: env.stripe,
      readyForOnboarding: env.readyForCheckout,
      readyForPayouts: env.readyForCheckout,
      invoice,
      readyForCheckout: env.readyForCheckout,
      readyForInvoicing: Object.values(invoice).every(Boolean),
    };
  },
});

export const getMyStudioPaymentOrderV2 = query({
  args: { paymentOrderId: v.id("paymentOrdersV2") },
  returns: paymentOrderSummaryValidator,
  handler: async (ctx, args) => {
    const { studio } = await loadCurrentStudio(ctx);
    const order = await ctx.db.get("paymentOrdersV2", args.paymentOrderId);
    if (!order || order.studioId !== studio._id) {
      throw new ConvexError("Payment order not found");
    }
    return projectPaymentOrder(order);
  },
});

export const getPaymentCheckoutContextV2 = query({
  args: { paymentOrderId: v.id("paymentOrdersV2") },
  returns: paymentCheckoutContextValidator,
  handler: async (ctx, args) => {
    const { studio } = await loadCurrentStudio(ctx);
    const order = await ctx.db.get("paymentOrdersV2", args.paymentOrderId);
    if (!order || order.studioId !== studio._id) {
      return null;
    }

    const offer = await ctx.db.get("paymentOffersV2", order.offerId);
    if (!offer) {
      throw new ConvexError("Payment offer not found");
    }

    const attempt = await ctx.db
      .query("paymentAttemptsV2")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();

    const connectedAccount = await loadLatestConnectedAccountForUser(
      ctx,
      order.instructorUserId,
      order.provider,
    );

    return {
      offer: projectPaymentOffer(offer),
      order: projectPaymentOrder(order),
      attempt: attempt ? projectPaymentAttempt(attempt) : null,
      connectedAccount: connectedAccount ? projectConnectedAccount(connectedAccount) : null,
      instructorConnectedAccountRequired: order.provider === "stripe",
    };
  },
});

export const getMyInstructorConnectedAccountV2 = query({
  args: {},
  returns: v.union(v.null(), connectedAccountOnboardingSummaryValidator),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const account = await loadLatestConnectedAccountForUser(ctx, user._id, "stripe");
    return account ? projectConnectedAccount(account) : null;
  },
});

export const getMyStudioConnectedAccountV2 = query({
  args: {},
  returns: v.union(v.null(), connectedAccountOnboardingSummaryValidator),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const account = await loadLatestConnectedAccountForUser(ctx, user._id, "stripe");
    return account ? projectConnectedAccount(account) : null;
  },
});

export const getFundSplitCreationContextV2 = internalQuery({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: v.union(
    v.null(),
    v.object({
      order: paymentOrderSummaryValidator,
      attempt: paymentAttemptSummaryValidator,
      connectedAccount: connectedAccountOnboardingSummaryValidator,
      existingSplit: v.union(v.null(), fundSplitSummaryValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.paymentOrderId);
    if (!order) {
      return null;
    }
    const attempt = await ctx.db
      .query("paymentAttemptsV2")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();
    const connectedAccount = await loadLatestConnectedAccountForUser(
      ctx,
      order.instructorUserId,
      order.provider,
    );
    if (!attempt || !connectedAccount) {
      return null;
    }
    const existingSplit = await ctx.db
      .query("fundSplitsV2")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();
    return {
      order: projectPaymentOrder(order),
      attempt: projectPaymentAttempt(attempt),
      connectedAccount: projectConnectedAccount(connectedAccount),
      existingSplit: existingSplit ? projectFundSplit(existingSplit) : null,
    };
  },
});

export const createStudioPaymentOfferV2 = mutation({
  args: {
    jobId: v.id("jobs"),
    bonusAmountAgorot: v.optional(v.number()),
    bonusReason: v.optional(v.string()),
  },
  returns: paymentOfferSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, studio, job, instructor, instructorUserId } = await loadJobContext(
      ctx,
      args.jobId,
    );

    const baseLessonAmountAgorot = toAgorot(job.pay);
    const bonusAmountAgorot = Math.max(0, Math.round(args.bonusAmountAgorot ?? 0));
    const pricing = computePricingV2({
      baseLessonAmountAgorot,
      bonusAmountAgorot,
      country: DEFAULT_PROVIDER_COUNTRY,
      currency: DEFAULT_PROVIDER_CURRENCY,
    });

    const latestOffer = await ctx.db
      .query("paymentOffersV2")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .order("desc")
      .first();

    if (
      latestOffer &&
      latestOffer.status !== "cancelled" &&
      latestOffer.status !== "paid" &&
      latestOffer.pricing.baseLessonAmountAgorot === pricing.baseLessonAmountAgorot &&
      latestOffer.pricing.bonusAmountAgorot === pricing.bonusAmountAgorot &&
      latestOffer.pricing.instructorOfferAmountAgorot === pricing.instructorOfferAmountAgorot &&
      latestOffer.pricing.platformServiceFeeAgorot === pricing.platformServiceFeeAgorot &&
      latestOffer.pricing.studioChargeAmountAgorot === pricing.studioChargeAmountAgorot
    ) {
      return projectPaymentOffer(latestOffer);
    }

    if (latestOffer && latestOffer.status === "ready") {
      await ctx.db.patch(latestOffer._id, {
        status: "superseded",
        updatedAt: now,
      });
    }

    const offerId = await ctx.db.insert("paymentOffersV2", {
      jobId: job._id,
      studioId: studio._id,
      studioUserId: user._id,
      instructorId: instructor._id,
      instructorUserId,
      providerCountry: DEFAULT_PROVIDER_COUNTRY,
      currency: DEFAULT_PROVIDER_CURRENCY,
      pricing,
      pricingSnapshot: {
        pricingRuleVersion: pricing.pricingRuleVersion,
        feeMode: pricing.feeMode,
        hasBonus: pricing.hasBonus,
      },
      ...omitUndefined({
        bonusReason: normalizeOptionalText(args.bonusReason),
      }),
      status: "ready",
      createdAt: now,
      updatedAt: now,
    });

    const offer = await ctx.db.get("paymentOffersV2", offerId);
    if (!offer) {
      throw new ConvexError("Failed to create payment offer");
    }
    return projectPaymentOffer(offer);
  },
});

export const createStudioPaymentOrderV2 = mutation({
  args: {
    offerId: v.id("paymentOffersV2"),
  },
  returns: paymentOrderSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["studio"]);
    const offer = await ctx.db.get("paymentOffersV2", args.offerId);
    if (!offer) {
      throw new ConvexError("Payment offer not found");
    }
    if (offer.studioUserId !== user._id) {
      throw new ConvexError("Unauthorized payment offer");
    }
    if (offer.status !== "ready" && offer.status !== "draft") {
      throw new ConvexError("Payment offer is not payable");
    }

    const existingOrder = await ctx.db
      .query("paymentOrdersV2")
      .withIndex("by_offer", (q) => q.eq("offerId", offer._id))
      .order("desc")
      .first();
    if (existingOrder) {
      return projectPaymentOrder(existingOrder);
    }

    const correlationKey = `stripe:${offer._id}:${offer.jobId}:${crypto.randomUUID()}`;
    const orderId = await ctx.db.insert("paymentOrdersV2", {
      offerId: offer._id,
      jobId: offer.jobId,
      studioId: offer.studioId,
      studioUserId: offer.studioUserId,
      instructorId: offer.instructorId,
      instructorUserId: offer.instructorUserId,
      provider: "stripe",
      status: "draft",
      providerCountry: offer.providerCountry,
      currency: offer.currency,
      pricing: offer.pricing,
      capturedAmountAgorot: 0,
      refundedAmountAgorot: 0,
      correlationKey,
      createdAt: now,
      updatedAt: now,
    });

    const order = await ctx.db.get("paymentOrdersV2", orderId);
    if (!order) {
      throw new ConvexError("Failed to create payment order");
    }
    return projectPaymentOrder(order);
  },
});

export const upsertInstructorConnectedAccountFromProviderV2 = internalMutation({
  args: {
    provider: paymentProviderValidator,
    providerAccountId: v.string(),
    providerStatusRaw: v.string(),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    legalName: v.optional(v.string()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);

    const existing = await ctx.db
      .query("connectedAccountsV2")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const instructorProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    const mappedStatus =
      args.provider === "stripe"
        ? mapStripeProviderStatusToCanonical(args.providerStatusRaw)
        : mapAirwallexAccountStatusToCanonical(args.providerStatusRaw);

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        providerAccountId: args.providerAccountId,
        status: mappedStatus,
        kycStatus: args.providerStatusRaw,
        metadata: {
          ...(existing.metadata ?? {}),
          providerStatusRaw: args.providerStatusRaw,
          ...(args.metadata ?? {}),
        },
        country: args.country ?? existing.country,
        currency: args.currency ?? existing.currency,
        updatedAt: now,
        activatedAt:
          mappedStatus === "active" ? (existing.activatedAt ?? now) : existing.activatedAt,
      });
      if (args.provider === "stripe" && instructorProfile) {
        await ctx.db.patch(instructorProfile._id, {
          diditSessionId: args.providerAccountId,
          diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
          diditStatusRaw: args.providerStatusRaw,
          diditLastEventAt: now,
          ...(mappedStatus === "active"
            ? { diditVerifiedAt: instructorProfile.diditVerifiedAt ?? now }
            : {}),
          ...(args.legalName ? { diditLegalName: args.legalName } : {}),
          ...(args.legalFirstName ? { diditLegalFirstName: args.legalFirstName } : {}),
          ...(args.legalMiddleName ? { diditLegalMiddleName: args.legalMiddleName } : {}),
          ...(args.legalLastName ? { diditLegalLastName: args.legalLastName } : {}),
          updatedAt: now,
        });
      }
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update Airwallex connected account");
      }
      return projectConnectedAccount(updated);
    }

    const accountId = await ctx.db.insert("connectedAccountsV2", {
      userId: user._id,
      role: "instructor",
      provider: args.provider,
      providerAccountId: args.providerAccountId,
      accountCapability: "withdrawal",
      status: mappedStatus,
      kycStatus: args.providerStatusRaw,
      country: args.country ?? DEFAULT_PROVIDER_COUNTRY,
      currency: args.currency ?? DEFAULT_PROVIDER_CURRENCY,
      metadata: {
        providerStatusRaw: args.providerStatusRaw,
        ...(args.metadata ?? {}),
      },
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        activatedAt: mappedStatus === "active" ? now : undefined,
      }),
    });
    if (args.provider === "stripe" && instructorProfile) {
      await ctx.db.patch(instructorProfile._id, {
        diditSessionId: args.providerAccountId,
        diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
        diditStatusRaw: args.providerStatusRaw,
        diditLastEventAt: now,
        ...(mappedStatus === "active" ? { diditVerifiedAt: now } : {}),
        ...(args.legalName ? { diditLegalName: args.legalName } : {}),
        ...(args.legalFirstName ? { diditLegalFirstName: args.legalFirstName } : {}),
        ...(args.legalMiddleName ? { diditLegalMiddleName: args.legalMiddleName } : {}),
        ...(args.legalLastName ? { diditLegalLastName: args.legalLastName } : {}),
        updatedAt: now,
      });
    }

    const account = await ctx.db.get("connectedAccountsV2", accountId);
    if (!account) {
      throw new ConvexError("Failed to create Stripe connected account");
    }
    return projectConnectedAccount(account);
  },
});

export const upsertStudioConnectedAccountFromProviderV2 = internalMutation({
  args: {
    provider: paymentProviderValidator,
    providerAccountId: v.string(),
    providerStatusRaw: v.string(),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    legalName: v.optional(v.string()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["studio"]);

    const existing = await ctx.db
      .query("connectedAccountsV2")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();

    const mappedStatus =
      args.provider === "stripe"
        ? mapStripeProviderStatusToCanonical(args.providerStatusRaw)
        : mapAirwallexAccountStatusToCanonical(args.providerStatusRaw);

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        providerAccountId: args.providerAccountId,
        status: mappedStatus,
        kycStatus: args.providerStatusRaw,
        metadata: {
          ...(existing.metadata ?? {}),
          providerStatusRaw: args.providerStatusRaw,
          ...(args.metadata ?? {}),
        },
        country: args.country ?? existing.country,
        currency: args.currency ?? existing.currency,
        updatedAt: now,
        activatedAt:
          mappedStatus === "active" ? (existing.activatedAt ?? now) : existing.activatedAt,
      });

      // Sync verification status to studio profile
      const studioProfile = await ctx.db
        .query("studioProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();
      if (studioProfile && args.provider === "stripe") {
        await ctx.db.patch(studioProfile._id, {
          diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
          diditStatusRaw: args.providerStatusRaw,
          diditLastEventAt: now,
          ...(mappedStatus === "active"
            ? { diditVerifiedAt: studioProfile.diditVerifiedAt ?? now }
            : {}),
          ...(args.legalName ? { diditLegalName: args.legalName } : {}),
          updatedAt: now,
        });
      }

      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update studio connected account");
      }
      return projectConnectedAccount(updated);
    }

    const accountId = await ctx.db.insert("connectedAccountsV2", {
      userId: user._id,
      role: "studio",
      provider: args.provider,
      providerAccountId: args.providerAccountId,
      accountCapability: "withdrawal",
      status: mappedStatus,
      kycStatus: args.providerStatusRaw,
      country: args.country ?? DEFAULT_PROVIDER_COUNTRY,
      currency: args.currency ?? DEFAULT_PROVIDER_CURRENCY,
      metadata: {
        providerStatusRaw: args.providerStatusRaw,
        ...(args.metadata ?? {}),
      },
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        activatedAt: mappedStatus === "active" ? now : undefined,
      }),
    });

    // Sync verification status to studio profile
    const studioProfile = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (studioProfile && args.provider === "stripe") {
      await ctx.db.patch(studioProfile._id, {
        diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
        diditStatusRaw: args.providerStatusRaw,
        diditLastEventAt: now,
        ...(mappedStatus === "active" ? { diditVerifiedAt: now } : {}),
        ...(args.legalName ? { diditLegalName: args.legalName } : {}),
        updatedAt: now,
      });
    }

    const account = await ctx.db.get(accountId);
    if (!account) {
      throw new ConvexError("Failed to create studio connected account");
    }
    return projectConnectedAccount(account);
  },
});

export const syncStripeConnectedAccountWebhookV2 = internalMutation({
  args: {
    providerAccountId: v.string(),
    providerStatusRaw: v.string(),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    legalName: v.optional(v.string()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("connectedAccountsV2")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", "stripe").eq("providerAccountId", args.providerAccountId),
      )
      .unique();

    if (!existing) {
      return null;
    }

    const mappedStatus = mapStripeProviderStatusToCanonical(args.providerStatusRaw);
    await ctx.db.patch(existing._id, {
      status: mappedStatus,
      kycStatus: args.providerStatusRaw,
      metadata: {
        ...(existing.metadata ?? {}),
        providerStatusRaw: args.providerStatusRaw,
        ...(args.metadata ?? {}),
      },
      country: args.country ?? existing.country,
      currency: args.currency ?? existing.currency,
      updatedAt: now,
      activatedAt: mappedStatus === "active" ? (existing.activatedAt ?? now) : existing.activatedAt,
    });

    const instructorProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", existing.userId))
      .unique();
    if (instructorProfile) {
      await ctx.db.patch(instructorProfile._id, {
        diditSessionId: args.providerAccountId,
        diditVerificationStatus: mapStripeStatusToLegacyIdentityStatus(mappedStatus),
        diditStatusRaw: args.providerStatusRaw,
        diditLastEventAt: now,
        ...(mappedStatus === "active"
          ? { diditVerifiedAt: instructorProfile.diditVerifiedAt ?? now }
          : {}),
        ...(args.legalName ? { diditLegalName: args.legalName } : {}),
        ...(args.legalFirstName ? { diditLegalFirstName: args.legalFirstName } : {}),
        ...(args.legalMiddleName ? { diditLegalMiddleName: args.legalMiddleName } : {}),
        ...(args.legalLastName ? { diditLegalLastName: args.legalLastName } : {}),
        updatedAt: now,
      });
    }

    return null;
  },
});

export const recordStripePaymentIntentAttemptV2 = internalMutation({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
    providerPaymentIntentId: v.string(),
    clientSecretRef: v.optional(v.string()),
    status: paymentOrderStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.id("paymentAttemptsV2"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("paymentAttemptsV2")
      .withIndex("by_provider_payment_intent", (q) =>
        q.eq("provider", "stripe").eq("providerPaymentIntentId", args.providerPaymentIntentId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...omitUndefined({
          clientSecretRef: args.clientSecretRef,
          statusRaw: args.statusRaw,
          metadata: args.metadata,
        }),
        status: args.status,
        updatedAt: now,
      });
      return existing._id;
    }

    const attemptId = await ctx.db.insert("paymentAttemptsV2", {
      paymentOrderId: args.paymentOrderId,
      provider: "stripe",
      providerPaymentIntentId: args.providerPaymentIntentId,
      ...omitUndefined({
        clientSecretRef: args.clientSecretRef,
        statusRaw: args.statusRaw,
        metadata: args.metadata,
      }),
      status: args.status,
      requestId: args.requestId,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.paymentOrderId, {
      status: args.status,
      latestError: undefined,
      updatedAt: now,
    });

    return attemptId;
  },
});

export const applyStripePaymentIntentWebhookV2 = internalMutation({
  args: {
    providerPaymentIntentId: v.string(),
    status: paymentOrderStatusValidator,
    statusRaw: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const attempt = await ctx.db
      .query("paymentAttemptsV2")
      .withIndex("by_provider_payment_intent", (q) =>
        q.eq("provider", "stripe").eq("providerPaymentIntentId", args.providerPaymentIntentId),
      )
      .unique();

    if (!attempt) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      ...omitUndefined({
        statusRaw: args.statusRaw,
        lastError: args.errorMessage,
        metadata: args.metadata
          ? {
              ...(attempt.metadata ?? {}),
              ...args.metadata,
            }
          : undefined,
      }),
      status: args.status,
      updatedAt: now,
    });

    const order = await ctx.db.get(attempt.paymentOrderId);
    if (!order) {
      return null;
    }

    await ctx.db.patch(order._id, {
      status: args.status,
      capturedAmountAgorot:
        args.status === "succeeded"
          ? order.pricing.studioChargeAmountAgorot
          : order.capturedAmountAgorot,
      latestError: args.errorMessage,
      updatedAt: now,
      ...omitUndefined({
        succeededAt: args.status === "succeeded" ? now : undefined,
        cancelledAt: args.status === "cancelled" ? now : undefined,
      }),
    });

    return null;
  },
});

export const syncStripeDestinationChargeFundSplitV2 = internalMutation({
  args: {
    providerPaymentIntentId: v.string(),
    providerFundsSplitId: v.optional(v.string()),
    destinationAccountId: v.string(),
    settledAt: v.optional(v.number()),
  },
  returns: v.union(v.null(), fundSplitSummaryValidator),
  handler: async (ctx, args): Promise<any> => {
    const attempt = await ctx.db
      .query("paymentAttemptsV2")
      .withIndex("by_provider_payment_intent", (q) =>
        q.eq("provider", "stripe").eq("providerPaymentIntentId", args.providerPaymentIntentId),
      )
      .unique();
    if (!attempt) {
      return null;
    }

    const order = await ctx.db.get(attempt.paymentOrderId);
    if (!order) {
      return null;
    }

    const connectedAccount = await loadLatestConnectedAccountForUser(
      ctx,
      order.instructorUserId,
      "stripe",
    );
    if (!connectedAccount || connectedAccount.provider !== "stripe") {
      return null;
    }

    return await ctx.runMutation(internal.paymentsV2.upsertFundSplitFromProviderV2, {
      paymentOrderId: order._id,
      paymentAttemptId: attempt._id,
      connectedAccountId: connectedAccount._id,
      provider: "stripe",
      sourcePaymentIntentId: attempt.providerPaymentIntentId,
      destinationAccountId: args.destinationAccountId,
      amountAgorot: order.pricing.instructorOfferAmountAgorot,
      currency: order.currency,
      autoRelease: true,
      releaseMode: "automatic",
      status: "settled",
      requestId: `stripe-fund-split:${args.providerPaymentIntentId}`,
      idempotencyKey: `stripe-fund-split:${args.providerPaymentIntentId}`,
      ...omitUndefined({
        providerFundsSplitId: args.providerFundsSplitId,
        settledAt: args.settledAt ?? Date.now(),
        releasedAt: args.settledAt ?? Date.now(),
      }),
    });
  },
});

export const ensureStripePendingPayoutTransferForFundSplitV2 = internalMutation({
  args: {
    fundSplitId: v.id("fundSplitsV2"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("payoutTransfersV2"),
      fundSplitId: v.id("fundSplitsV2"),
      connectedAccountId: v.id("connectedAccountsV2"),
      provider: paymentProviderValidator,
      providerTransferId: v.optional(v.string()),
      amountAgorot: v.number(),
      currency: v.string(),
      status: payoutTransferStatusValidator,
      statusRaw: v.optional(v.string()),
      requestId: v.string(),
      idempotencyKey: v.string(),
      failureReason: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      paidAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const split = await ctx.db.get(args.fundSplitId);
    if (!split || split.provider !== "stripe") {
      return null;
    }

    const existing = await ctx.db
      .query("payoutTransfersV2")
      .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
      .order("desc")
      .first();
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const transferId = await ctx.db.insert("payoutTransfersV2", {
      connectedAccountId: split.connectedAccountId,
      fundSplitId: split._id,
      provider: "stripe",
      amountAgorot: split.amountAgorot,
      currency: split.currency,
      status: "pending",
      statusRaw: "pending",
      requestId: `stripe-payout-pending:${split._id}`,
      idempotencyKey: `stripe-payout-pending:${split._id}`,
      metadata: {
        sourcePaymentIntentId: split.sourcePaymentIntentId,
      },
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(transferId);
  },
});

export const reconcileStripePayoutWebhookV2 = internalMutation({
  args: {
    providerAccountId: v.string(),
    providerPayoutId: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    status: payoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const connectedAccount = await ctx.db
      .query("connectedAccountsV2")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", "stripe").eq("providerAccountId", args.providerAccountId),
      )
      .unique();
    if (!connectedAccount) {
      return null;
    }

    const direct = await ctx.db
      .query("payoutTransfersV2")
      .withIndex("by_provider_transfer", (q) =>
        q.eq("provider", "stripe").eq("providerTransferId", args.providerPayoutId),
      )
      .unique();
    if (direct) {
      await ctx.db.patch(direct._id, {
        status: args.status,
        statusRaw: args.statusRaw,
        updatedAt: now,
        ...omitUndefined({
          failureReason: args.failureReason,
          paidAt: args.paidAt,
          metadata: args.metadata
            ? {
                ...(direct.metadata ?? {}),
                ...args.metadata,
              }
            : undefined,
        }),
      });
      return null;
    }

    const openTransfers = (
      await ctx.db
        .query("payoutTransfersV2")
        .withIndex("by_connected_account", (q) => q.eq("connectedAccountId", connectedAccount._id))
        .order("asc")
        .take(100)
    ).filter(
      (transfer) =>
        transfer.provider === "stripe" &&
        transfer.currency.toUpperCase() === args.currency.toUpperCase() &&
        transfer.status !== "paid" &&
        transfer.status !== "failed" &&
        transfer.status !== "cancelled",
    );

    const exactMatches = openTransfers.filter(
      (transfer) => transfer.amountAgorot === args.amountAgorot,
    );
    const firstOpenTransfer = openTransfers[0];
    const candidate =
      exactMatches.length === 1
        ? exactMatches[0]
        : openTransfers.length === 1 &&
            firstOpenTransfer &&
            firstOpenTransfer.amountAgorot <= args.amountAgorot
          ? firstOpenTransfer
          : null;

    if (!candidate) {
      return null;
    }

    await ctx.db.patch(candidate._id, {
      providerTransferId: args.providerPayoutId,
      status: args.status,
      statusRaw: args.statusRaw,
      updatedAt: now,
      ...omitUndefined({
        failureReason: args.failureReason,
        paidAt: args.paidAt,
        metadata: args.metadata
          ? {
              ...(candidate.metadata ?? {}),
              ...args.metadata,
            }
          : undefined,
      }),
    });

    return null;
  },
});

export const upsertFundSplitFromProviderV2 = internalMutation({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
    paymentAttemptId: v.id("paymentAttemptsV2"),
    connectedAccountId: v.id("connectedAccountsV2"),
    provider: paymentProviderValidator,
    providerFundsSplitId: v.optional(v.string()),
    sourcePaymentIntentId: v.string(),
    destinationAccountId: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    autoRelease: v.boolean(),
    releaseMode: v.union(v.literal("automatic"), v.literal("manual"), v.literal("scheduled")),
    status: v.union(
      v.literal("pending_create"),
      v.literal("created"),
      v.literal("released"),
      v.literal("settled"),
      v.literal("failed"),
      v.literal("reversed"),
    ),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    releasedAt: v.optional(v.number()),
    settledAt: v.optional(v.number()),
  },
  returns: fundSplitSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing =
      (args.providerFundsSplitId
        ? await ctx.db
            .query("fundSplitsV2")
            .withIndex("by_provider_split", (q) =>
              q.eq("provider", args.provider).eq("providerFundsSplitId", args.providerFundsSplitId),
            )
            .unique()
        : null) ??
      (await ctx.db
        .query("fundSplitsV2")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", args.paymentOrderId))
        .order("desc")
        .first());

    if (existing) {
      await ctx.db.patch(existing._id, {
        paymentAttemptId: args.paymentAttemptId,
        connectedAccountId: args.connectedAccountId,
        sourcePaymentIntentId: args.sourcePaymentIntentId,
        destinationAccountId: args.destinationAccountId,
        amountAgorot: args.amountAgorot,
        currency: args.currency,
        autoRelease: args.autoRelease,
        releaseMode: args.releaseMode,
        status: args.status,
        requestId: args.requestId,
        idempotencyKey: args.idempotencyKey,
        updatedAt: now,
        ...omitUndefined({
          providerFundsSplitId: args.providerFundsSplitId,
          failureReason: args.failureReason,
          releasedAt: args.releasedAt,
          settledAt: args.settledAt,
        }),
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update fund split");
      }
      return projectFundSplit(updated);
    }

    const splitId = await ctx.db.insert("fundSplitsV2", {
      paymentOrderId: args.paymentOrderId,
      paymentAttemptId: args.paymentAttemptId,
      connectedAccountId: args.connectedAccountId,
      provider: args.provider,
      sourcePaymentIntentId: args.sourcePaymentIntentId,
      destinationAccountId: args.destinationAccountId,
      amountAgorot: args.amountAgorot,
      currency: args.currency,
      autoRelease: args.autoRelease,
      releaseMode: args.releaseMode,
      status: args.status,
      requestId: args.requestId,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        providerFundsSplitId: args.providerFundsSplitId,
        failureReason: args.failureReason,
        releasedAt: args.releasedAt,
        settledAt: args.settledAt,
      }),
    });
    const split = await ctx.db.get(splitId);
    if (!split) {
      throw new ConvexError("Failed to create fund split");
    }
    return projectFundSplit(split);
  },
});

export const upsertPayoutTransferFromProviderV2 = internalMutation({
  args: {
    fundSplitId: v.id("fundSplitsV2"),
    connectedAccountId: v.id("connectedAccountsV2"),
    provider: paymentProviderValidator,
    providerTransferId: v.optional(v.string()),
    amountAgorot: v.number(),
    currency: v.string(),
    status: payoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  },
  returns: v.object({
    _id: v.id("payoutTransfersV2"),
    fundSplitId: v.id("fundSplitsV2"),
    connectedAccountId: v.id("connectedAccountsV2"),
    provider: paymentProviderValidator,
    providerTransferId: v.optional(v.string()),
    amountAgorot: v.number(),
    currency: v.string(),
    status: payoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    paidAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = args.providerTransferId
      ? await ctx.db
          .query("payoutTransfersV2")
          .withIndex("by_provider_transfer", (q) =>
            q.eq("provider", args.provider).eq("providerTransferId", args.providerTransferId),
          )
          .unique()
      : null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        fundSplitId: args.fundSplitId,
        connectedAccountId: args.connectedAccountId,
        amountAgorot: args.amountAgorot,
        currency: args.currency,
        status: args.status,
        statusRaw: args.statusRaw,
        requestId: args.requestId,
        idempotencyKey: args.idempotencyKey,
        updatedAt: now,
        ...omitUndefined({
          providerTransferId: args.providerTransferId,
          failureReason: args.failureReason,
          paidAt: args.paidAt,
        }),
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update payout transfer");
      }
      return updated;
    }

    const transferId = await ctx.db.insert("payoutTransfersV2", {
      connectedAccountId: args.connectedAccountId,
      fundSplitId: args.fundSplitId,
      provider: args.provider,
      amountAgorot: args.amountAgorot,
      currency: args.currency,
      status: args.status,
      requestId: args.requestId,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        providerTransferId: args.providerTransferId,
        failureReason: args.failureReason,
        paidAt: args.paidAt,
      }),
    });
    const transfer = await ctx.db.get(transferId);
    if (!transfer) {
      throw new ConvexError("Failed to create payout transfer");
    }
    return transfer;
  },
});

export const markPaymentOrderProcessingV2 = internalMutation({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const order = await ctx.db.get("paymentOrdersV2", args.paymentOrderId);
    if (!order) {
      throw new ConvexError("Payment order not found");
    }
    if (order.status === "succeeded" || order.status === "refunded") {
      return null;
    }
    await ctx.db.patch(order._id, {
      status: "processing",
      updatedAt: now,
    });
    return null;
  },
});
