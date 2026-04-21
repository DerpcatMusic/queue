import { v } from "convex/values";

export const v2MoneyBreakdownValidator = v.object({
  baseLessonAmountAgorot: v.number(),
  bonusAmountAgorot: v.number(),
  instructorOfferAmountAgorot: v.number(),
  platformServiceFeeAgorot: v.number(),
  studioChargeAmountAgorot: v.number(),
});

export const v2PricingSnapshotValidator = v.object({
  pricingRuleVersion: v.string(),
  feeMode: v.union(v.literal("standard"), v.literal("bonus")),
  hasBonus: v.boolean(),
});

export const v2MetadataValidator = v.object({
  jobSnapshotStatus: v.optional(v.string()),
  failureCode: v.optional(v.string()),
  failureReason: v.optional(v.string()),
  providerStatusRaw: v.optional(v.string()),
  providerEventId: v.optional(v.string()),
  receipt_url: v.optional(v.string()),
  receipt_number: v.optional(v.string()),
  charge_id: v.optional(v.string()),
  dashboard: v.optional(v.string()),
  requirementsSummary: v.optional(v.string()),
  blockingRequirementsCount: v.optional(v.string()),
  lastWebhookEventType: v.optional(v.string()),
  payoutMethod: v.optional(v.string()),
  sourcePaymentIntentId: v.optional(v.string()),
});

export const v2ConnectedAccountStatusValidator = v.union(
  v.literal("pending"),
  v.literal("action_required"),
  v.literal("active"),
  v.literal("restricted"),
  v.literal("rejected"),
  v.literal("disabled"),
);

export const v2RequirementKindValidator = v.union(
  v.literal("agreement"),
  v.literal("identity"),
  v.literal("business"),
  v.literal("bank_account"),
  v.literal("payment_method"),
  v.literal("other"),
);

export const v2PaymentOrderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("requires_payment_method"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("partially_refunded"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const v2FundSplitStatusValidator = v.union(
  v.literal("pending_create"),
  v.literal("created"),
  v.literal("released"),
  v.literal("settled"),
  v.literal("failed"),
  v.literal("reversed"),
);

export const v2PayoutTransferStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("sent"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("needs_attention"),
);

export const v2LedgerEntryTypeValidator = v.union(
  v.literal("studio_charge"),
  v.literal("platform_gross_revenue"),
  v.literal("processor_fee_expense"),
  v.literal("instructor_offer_reserved"),
  v.literal("fund_split_created"),
  v.literal("fund_split_released"),
  v.literal("payout_transfer_sent"),
  v.literal("refund_gross"),
  v.literal("refund_platform_reversal"),
  v.literal("refund_instructor_reversal"),
  v.literal("adjustment"),
);

export const v2LedgerBucketValidator = v.union(
  v.literal("provider_clearing"),
  v.literal("platform_gross_revenue"),
  v.literal("platform_fee_expense"),
  v.literal("platform_net_revenue"),
  v.literal("instructor_split_pending"),
  v.literal("instructor_split_available"),
  v.literal("instructor_payout_in_flight"),
  v.literal("instructor_paid_out"),
  v.literal("refund_reserve"),
  v.literal("adjustments"),
);
