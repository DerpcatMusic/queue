import { v } from "convex/values";

export type StudioComplianceBlockReason =
  | "owner_identity_required"
  | "business_profile_required"
  | "payment_method_required"
  | "account_suspended";

export const studioComplianceBlockReasonValidator = v.union(
  v.literal("owner_identity_required"),
  v.literal("business_profile_required"),
  v.literal("payment_method_required"),
  v.literal("account_suspended"),
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
  suspensionReason: v.optional(v.string()),
});
