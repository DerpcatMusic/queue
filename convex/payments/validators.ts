import { v } from "convex/values";
import { getStripeEnvPresence, getStripeMarketDefaults } from "../integrations/stripe/config";
import { diditVerificationStatusValidator } from "../lib/instructorCompliance";

export const DEFAULT_PROVIDER_COUNTRY = getStripeMarketDefaults().country;
export const DEFAULT_PROVIDER_CURRENCY = getStripeMarketDefaults().currency;
export const paymentProviderValidator = v.union(v.literal("airwallex"), v.literal("stripe"));

export const paymentOfferStatusValidator = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("superseded"),
  v.literal("paid"),
  v.literal("cancelled"),
);

export const paymentOrderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("requires_payment_method"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("partially_refunded"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const payoutTransferStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("sent"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("needs_attention"),
);

export const connectedAccountSummaryValidator = v.object({
  _id: v.id("connectedAccounts"),
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

export const connectedAccountOnboardingSummaryValidator = v.object({
  _id: v.id("connectedAccounts"),
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

export const paymentOfferSummaryValidator = v.object({
  _id: v.id("paymentOffers"),
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

export const paymentOrderSummaryValidator = v.object({
  _id: v.id("paymentOrders"),
  offerId: v.optional(v.id("paymentOffers")),
  jobId: v.id("jobs"),
  studioId: v.id("studioProfiles"),
  studioUserId: v.id("users"),
  instructorId: v.id("instructorProfiles"),
  instructorUserId: v.id("users"),
  provider: paymentProviderValidator,
  status: paymentOrderStatusValidator,
  providerCountry: v.optional(v.string()),
  currency: v.string(),
  pricing: v.optional(
    v.object({
      baseLessonAmountAgorot: v.number(),
      bonusAmountAgorot: v.number(),
      instructorOfferAmountAgorot: v.number(),
      platformServiceFeeAgorot: v.number(),
      studioChargeAmountAgorot: v.number(),
    }),
  ),
  capturedAmountAgorot: v.optional(v.number()),
  refundedAmountAgorot: v.optional(v.number()),
  correlationKey: v.optional(v.string()),
  latestError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  succeededAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
});

export const paymentAttemptSummaryValidator = v.object({
  _id: v.id("paymentAttempts"),
  paymentOrderId: v.id("paymentOrders"),
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

export const paymentCheckoutContextValidator = v.union(
  v.null(),
  v.object({
    offer: paymentOfferSummaryValidator,
    order: v.union(v.null(), paymentOrderSummaryValidator),
    attempt: v.union(v.null(), paymentAttemptSummaryValidator),
    connectedAccount: v.union(v.null(), connectedAccountSummaryValidator),
    instructorConnectedAccountRequired: v.boolean(),
  }),
);

export const fundSplitSummaryValidator = v.object({
  _id: v.id("fundSplits"),
  paymentOrderId: v.id("paymentOrders"),
  paymentAttemptId: v.id("paymentAttempts"),
  connectedAccountId: v.id("connectedAccounts"),
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

export const diditVerificationSessionStatusValidator = diditVerificationStatusValidator;

export const diditVerificationSessionSummaryValidator = v.object({
  provider: v.literal("didit"),
  sessionId: v.string(),
  sessionToken: v.string(),
  verificationUrl: v.string(),
  status: diditVerificationSessionStatusValidator,
});

export const diditVerificationRefreshSummaryValidator = v.object({
  provider: v.literal("didit"),
  sessionId: v.string(),
  status: diditVerificationSessionStatusValidator,
});

export const stripePaymentSheetSessionSummaryValidator = v.object({
  provider: v.literal("stripe"),
  providerPaymentIntentId: v.string(),
  clientSecret: v.string(),
  customerId: v.optional(v.string()),
  providerCountry: v.string(),
  currency: v.string(),
  amountAgorot: v.number(),
  status: paymentOrderStatusValidator,
});

export const stripeAccountLinkSummaryValidator = v.object({
  provider: v.literal("stripe"),
  accountId: v.string(),
  onboardingUrl: v.string(),
  expiresAt: v.optional(v.string()),
});

export const stripeAccountSessionSummaryValidator = v.object({
  provider: v.literal("stripe"),
  accountId: v.string(),
  clientSecret: v.string(),
});

export const stripeCustomerSheetSessionSummaryValidator = v.object({
  provider: v.literal("stripe"),
  customerId: v.string(),
  customerSessionClientSecret: v.string(),
  setupIntentClientSecret: v.string(),
});

export function getPaymentsPreflightState() {
  const env = getStripeEnvPresence();
  return {
    mode: env.readyForCheckout ? "stripe" : "missing",
    payoutReleaseMode: "automatic",
    currency: DEFAULT_PROVIDER_CURRENCY,
    webhookMaxSkewSeconds: 300,
    stripe: env.stripe,
    readyForOnboarding: env.readyForCheckout,
    readyForPayouts: env.readyForCheckout,
    readyForCheckout: env.readyForCheckout,
  };
}
