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

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    value === "created" ||
    value === "pending" ||
    value === "authorized" ||
    value === "captured" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "refunded"
  );
}

export function isPayoutStatus(value: unknown): value is PayoutStatus {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "pending_provider" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "needs_attention"
  );
}

export function formatAgorotCurrency(amountAgorot: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountAgorot / 100);
}

export function getPaymentStatusLabel(status: PaymentStatus | string | null | undefined): string {
  if (!isPaymentStatus(status)) {
    return i18n.t("profile.roles.unknown");
  }
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

export function getPayoutStatusLabel(status: PayoutStatus | string | null | undefined): string {
  if (!isPayoutStatus(status)) {
    return i18n.t("profile.roles.unknown");
  }
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

export function getPaymentStatusTone(
  status: PaymentStatus | string | null | undefined,
): StatusTone {
  if (!isPaymentStatus(status)) {
    return "muted";
  }
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

export function getPayoutStatusTone(status: PayoutStatus | string | null | undefined): StatusTone {
  if (!isPayoutStatus(status)) {
    return "muted";
  }
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
