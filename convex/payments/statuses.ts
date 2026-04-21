import type { Doc } from "../_generated/dataModel";

export type LegacyPaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";

export type LegacyPayoutStatus =
  | "queued"
  | "processing"
  | "pending_provider"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention";

export function mapPaymentOrderStatusToLegacy(
  status: Doc<"paymentOrders">["status"],
): LegacyPaymentStatus {
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
}

export function mapFundSplitStatusToLegacy(
  status: Doc<"fundSplits">["status"],
): LegacyPayoutStatus {
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
}

export function mapPayoutTransferStatusToLegacy(
  status: Doc<"payoutTransfers">["status"],
): LegacyPayoutStatus {
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
}
