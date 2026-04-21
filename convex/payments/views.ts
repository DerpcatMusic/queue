import type { Doc } from "../_generated/dataModel";
import {
  mapFundSplitStatusToLegacy,
  mapPaymentOrderStatusToLegacy,
  mapPayoutTransferStatusToLegacy,
} from "./statuses";
import { DEFAULT_PROVIDER_CURRENCY } from "./validators";

type PaymentOrderDetailInput = {
  order: Doc<"paymentOrders">;
  job: Doc<"jobs"> | null;
  attempts: Doc<"paymentAttempts">[];
  splits: Doc<"fundSplits">[];
  transfers: Array<Doc<"payoutTransfers"> | null>;
  latestSplit: Doc<"fundSplits"> | null;
  latestTransfer: Doc<"payoutTransfers"> | null;
};

type PayoutSummaryInput = {
  orders: Doc<"paymentOrders">[];
  connectedAccount: Doc<"connectedAccounts"> | null;
  latestSplitByOrderId: Map<string, Doc<"fundSplits"> | null>;
  latestTransferByOrderId: Map<string, Doc<"payoutTransfers"> | null>;
};

export function buildPaymentOrderDetailView(input: PaymentOrderDetailInput) {
  const { order, job, attempts, splits, transfers, latestSplit, latestTransfer } = input;
  const latestAttempt = attempts[0] ?? null;
  const receiptUrl = latestAttempt?.metadata?.receipt_url;
  const receiptNumber = latestAttempt?.metadata?.receipt_number;

  const timeline = [
    {
      _id: `payment-order:${String(order._id)}`,
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
      .filter((transfer): transfer is Doc<"payoutTransfers"> => Boolean(transfer))
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
      status: mapPaymentOrderStatusToLegacy(order.status),
      currency: order.currency,
      studioChargeAmountAgorot: order.pricing.studioChargeAmountAgorot,
      instructorBaseAmountAgorot: order.pricing.instructorOfferAmountAgorot,
      platformMarkupAmountAgorot: order.pricing.platformServiceFeeAgorot,
      createdAt: order.createdAt,
    },
    job,
    payout: latestTransfer
      ? {
          status: mapPayoutTransferStatusToLegacy(latestTransfer.status),
          settledAt: latestTransfer.paidAt,
        }
      : latestSplit
        ? {
            status: mapFundSplitStatusToLegacy(latestSplit.status),
            settledAt: latestSplit.settledAt,
          }
        : null,
    timeline,
    fundSplit: latestSplit
      ? {
          _id: latestSplit._id,
          provider: latestSplit.provider,
          status: latestSplit.status,
          payoutStatus: mapFundSplitStatusToLegacy(latestSplit.status),
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
    } satisfies {
      status: "pending" | "ready";
      issuedAt?: number;
      documentUrl?: string;
      receiptNumber?: string;
    },
  };
}

export function buildPayoutSummaryView(input: PayoutSummaryInput) {
  const { orders, connectedAccount, latestSplitByOrderId, latestTransferByOrderId } = input;

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
    const split = latestSplitByOrderId.get(String(order._id)) ?? null;
    const transfer = latestTransferByOrderId.get(String(order._id)) ?? null;
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
    payoutReleaseMode: "automatic" as const,
    sandboxSelfVerifyEnabled: false,
    payoutPreferenceMode: "immediate_when_eligible" as const,
    payoutPreferenceScheduledDate: null,
    currency,
    hasVerifiedDestination: connectedAccount?.status === "active",
    isIdentityVerified:
      connectedAccount?.status === "active" || connectedAccount?.status === "action_required",
    verifiedDestination: connectedAccount
      ? {
          _id: connectedAccount._id,
          type: "stripe_connected_account" as const,
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
}
