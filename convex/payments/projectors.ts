import type { Doc } from "../_generated/dataModel";
import { omitUndefined } from "../lib/validation";

export const mapAirwallexAccountStatusToCanonical = (
  providerStatusRaw: string,
): Doc<"connectedAccounts">["status"] => {
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

export const mapStripeProviderStatusToCanonical = (
  providerStatusRaw: string,
): Doc<"connectedAccounts">["status"] => {
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
};

export const mapStripeStatusToLegacyIdentityStatus = (
  status: Doc<"connectedAccounts">["status"],
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

export const mapStripeIdentitySessionStatusToLegacyIdentityStatus = (
  status: string,
): Doc<"studioProfiles">["diditVerificationStatus"] => {
  switch (status) {
    case "verified":
      return "approved";
    case "processing":
    case "requires_input":
      return "pending";
    case "canceled":
      return "abandoned";
    default:
      return "not_started";
  }
};

export const projectPaymentOffer = (offer: Doc<"paymentOffers">) => ({
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

export const projectPaymentOrder = (order: Doc<"paymentOrders">) => ({
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

export const projectPaymentAttempt = (attempt: Doc<"paymentAttempts">) => ({
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

export const projectConnectedAccount = (account: Doc<"connectedAccounts">) => ({
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

export const projectFundSplit = (split: Doc<"fundSplits">) => ({
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
