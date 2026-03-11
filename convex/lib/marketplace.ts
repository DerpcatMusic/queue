import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export const PAYMENT_ORDER_STATUSES = [
  "draft",
  "checkout_pending",
  "payment_pending",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refunded",
] as const;

export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export const LEDGER_ENTRY_TYPES = [
  "charge_gross",
  "platform_fee",
  "instructor_gross",
  "provider_fee",
  "refund",
  "refund_fee_impact",
  "payout_reserved",
  "payout_sent",
  "payout_failed",
  "adjustment",
] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_BALANCE_BUCKETS = [
  "provider_clearing",
  "platform_available",
  "instructor_held",
  "instructor_available",
  "instructor_reserved",
  "instructor_paid",
  "adjustments",
] as const;

export type LedgerBalanceBucket = (typeof LEDGER_BALANCE_BUCKETS)[number];

export const PAYOUT_SCHEDULE_STATUSES = [
  "blocked",
  "pending_eligibility",
  "available",
  "scheduled",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "needs_attention",
] as const;

export type PayoutScheduleStatus = (typeof PAYOUT_SCHEDULE_STATUSES)[number];

export const PAYOUT_PREFERENCE_MODES = [
  "immediate_when_eligible",
  "scheduled_date",
  "manual_hold",
] as const;

export type PayoutPreferenceMode = (typeof PAYOUT_PREFERENCE_MODES)[number];

export const DEFAULT_PAYOUT_PREFERENCE_MODE: PayoutPreferenceMode = "immediate_when_eligible";

export const PROVIDER_METHOD_CACHE_KINDS = [
  "payment_methods_country",
  "payout_method_types",
  "payout_required_fields",
] as const;

export type ProviderMethodCacheKind = (typeof PROVIDER_METHOD_CACHE_KINDS)[number];

export const PROVIDER_OBJECT_TYPES = [
  "merchant_reference",
  "checkout",
  "payment",
  "payout",
] as const;

export type ProviderObjectType = (typeof PROVIDER_OBJECT_TYPES)[number];

export const inferPayoutRailCategory = (
  payoutMethodType: string | undefined,
): "bank" | "card" | "ewallet" | "rapyd_wallet" => {
  const normalized = (payoutMethodType ?? "").trim().toLowerCase();
  if (normalized.includes("card")) return "card";
  if (normalized.includes("rapyd") || normalized.includes("wallet")) return "rapyd_wallet";
  if (normalized.includes("ewallet")) return "ewallet";
  return "bank";
};

export const buildPaymentOrderCorrelationToken = (studioUserId: string): string =>
  `payord:${studioUserId}:${crypto.randomUUID()}`;

export const buildPayoutCorrelationToken = (instructorUserId: string): string =>
  `payout:${instructorUserId}:${crypto.randomUUID()}`;

export const mapLegacyPaymentStatusToOrderStatus = (
  status: Doc<"payments">["status"],
): PaymentOrderStatus => {
  switch (status) {
    case "created":
      return "draft";
    case "pending":
      return "payment_pending";
    case "authorized":
      return "authorized";
    case "captured":
      return "captured";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "failed":
    default:
      return "failed";
  }
};

export const normalizePayoutPreferenceMode = (
  mode: string | undefined,
): PayoutPreferenceMode => {
  const normalized = (mode ?? "").trim().toLowerCase();
  if (normalized === "scheduled_date") return "scheduled_date";
  if (normalized === "manual_hold") return "manual_hold";
  return DEFAULT_PAYOUT_PREFERENCE_MODE;
};

export const toAgorot = (amount: number): number => Math.max(0, Math.round(amount * 100));

export const summarizeLedgerBalances = (
  entries: ReadonlyArray<
    Pick<Doc<"ledgerEntries">, "balanceBucket" | "amountAgorot" | "referenceType" | "entryType">
  >,
) => {
  const balances: Record<LedgerBalanceBucket, number> = {
    provider_clearing: 0,
    platform_available: 0,
    instructor_held: 0,
    instructor_available: 0,
    instructor_reserved: 0,
    instructor_paid: 0,
    adjustments: 0,
  };

  for (const entry of entries) {
    balances[entry.balanceBucket] += entry.amountAgorot;
  }

  return balances;
};

export const requirePositiveAgorot = (amountAgorot: number, label: string): number => {
  if (!Number.isFinite(amountAgorot) || amountAgorot <= 0) {
    throw new ConvexError(`${label} must be greater than zero`);
  }
  return Math.round(amountAgorot);
};
