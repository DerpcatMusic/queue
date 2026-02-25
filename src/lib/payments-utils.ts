export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";

export type PayoutStatus =
  | "queued"
  | "processing"
  | "pending_provider"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention";

export type StatusTone = "primary" | "success" | "warning" | "danger" | "muted";

export function formatAgorotCurrency(
  amountAgorot: number,
  locale: string,
  currency: string,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountAgorot / 100);
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "created":
      return "Created";
    case "pending":
      return "Pending";
    case "authorized":
      return "Authorized";
    case "captured":
      return "Captured";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return "Unknown";
  }
}

export function getPayoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "pending_provider":
      return "Pending provider";
    case "paid":
      return "Paid out";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "needs_attention":
      return "Needs attention";
    default:
      return "Unknown";
  }
}

export function getPaymentStatusTone(status: PaymentStatus): StatusTone {
  switch (status) {
    case "captured":
      return "success";
    case "failed":
    case "cancelled":
    case "refunded":
      return "danger";
    case "pending":
    case "authorized":
      return "warning";
    case "created":
      return "primary";
    default:
      return "muted";
  }
}

export function getPayoutStatusTone(status: PayoutStatus): StatusTone {
  switch (status) {
    case "paid":
      return "success";
    case "failed":
    case "cancelled":
    case "needs_attention":
      return "danger";
    case "queued":
    case "processing":
    case "pending_provider":
      return "warning";
    default:
      return "muted";
  }
}
