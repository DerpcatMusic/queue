import i18n from "@/i18n";

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

export function formatAgorotCurrency(amountAgorot: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountAgorot / 100);
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "created":
      return i18n.t("jobsTab.checkout.paymentStatus.created");
    case "pending":
      return i18n.t("jobsTab.checkout.paymentStatus.pending");
    case "authorized":
      return i18n.t("jobsTab.checkout.paymentStatus.authorized");
    case "captured":
      return i18n.t("jobsTab.checkout.paymentStatus.captured");
    case "failed":
      return i18n.t("jobsTab.checkout.paymentStatus.failed");
    case "cancelled":
      return i18n.t("jobsTab.checkout.paymentStatus.cancelled");
    case "refunded":
      return i18n.t("jobsTab.checkout.paymentStatus.refunded");
    default:
      return i18n.t("profile.roles.unknown");
  }
}

export function getPayoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case "queued":
      return i18n.t("jobsTab.checkout.payoutStatus.queued");
    case "processing":
      return i18n.t("jobsTab.checkout.payoutStatus.processing");
    case "pending_provider":
      return i18n.t("jobsTab.checkout.payoutStatus.pendingProvider");
    case "paid":
      return i18n.t("jobsTab.checkout.payoutStatus.paid");
    case "failed":
      return i18n.t("jobsTab.checkout.payoutStatus.failed");
    case "cancelled":
      return i18n.t("jobsTab.checkout.payoutStatus.cancelled");
    case "needs_attention":
      return i18n.t("jobsTab.checkout.payoutStatus.needsAttention");
    default:
      return i18n.t("profile.roles.unknown");
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
