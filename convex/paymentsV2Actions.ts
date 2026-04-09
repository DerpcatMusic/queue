"use node";

import { ConvexError, v } from "convex/values";
import StripeSDK from "stripe";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { getStripeMarketDefaults } from "./integrations/stripe/config";
import {
  createStripeAccountLinkV2,
  createStripeRecipientAccountV2,
  getStripeRepresentativeNameV2,
  retrieveStripeAccountV2,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "./integrations/stripe/connectV2";

const paymentOrderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("requires_payment_method"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("partially_refunded"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const connectedAccountOnboardingSummaryValidator = v.object({
  _id: v.id("connectedAccountsV2"),
  provider: v.literal("stripe"),
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
});

const stripePaymentSheetSessionSummaryValidator = v.object({
  provider: v.literal("stripe"),
  providerPaymentIntentId: v.string(),
  clientSecret: v.string(),
  status: paymentOrderStatusValidator,
});

type ConnectedAccountOnboardingSummary = {
  _id: Id<"connectedAccountsV2">;
  provider: "stripe";
  providerAccountId: string;
  accountCapability: "ledger" | "withdrawal" | "full";
  status: "pending" | "action_required" | "active" | "restricted" | "rejected" | "disabled";
  country: string;
  currency: string;
  createdAt: number;
  updatedAt: number;
  activatedAt?: number | undefined;
};

type StripePaymentSheetSessionSummary = {
  provider: "stripe";
  providerPaymentIntentId: string;
  clientSecret: string;
  status:
    | "draft"
    | "requires_payment_method"
    | "processing"
    | "succeeded"
    | "partially_refunded"
    | "refunded"
    | "failed"
    | "cancelled";
};

const stripeAccountLinkSummaryValidator = v.object({
  provider: v.literal("stripe"),
  accountId: v.string(),
  onboardingUrl: v.string(),
  expiresAt: v.optional(v.string()),
});

const mapStripePaymentIntentStatusToPaymentOrderStatus = (
  status: StripeSDK.PaymentIntent.Status | string | null | undefined,
): StripePaymentSheetSessionSummary["status"] => {
  switch (status) {
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return "requires_payment_method";
    case "processing":
      return "processing";
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "cancelled";
    default:
      return "failed";
  }
};

const STRIPE_CONNECT_RETURN_URL = "queue://stripe-connect-return";
const STRIPE_CONNECT_REFRESH_URL = "queue://stripe-connect-refresh";

async function buildStripeIdentitySync(accountId: string) {
  const representative = await getStripeRepresentativeNameV2(accountId);
  if (!representative) {
    return {};
  }
  return {
    ...(representative.legalName ? { legalName: representative.legalName } : {}),
    ...(representative.firstName ? { legalFirstName: representative.firstName } : {}),
    ...(representative.lastName ? { legalLastName: representative.lastName } : {}),
  };
}

async function ensureInstructorStripeConnectedAccount(
  ctx: any,
): Promise<ConnectedAccountOnboardingSummary> {
  const market = getStripeMarketDefaults();
  const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
  if (!currentUser || currentUser.role !== "instructor") {
    throw new ConvexError("Unauthorized");
  }

  const existing: ConnectedAccountOnboardingSummary | null = await ctx.runQuery(
    api.paymentsV2.getMyInstructorConnectedAccountV2,
    {},
  );

  if (existing?.provider === "stripe") {
    const remote = await retrieveStripeAccountV2(existing.providerAccountId);
    const identity = await buildStripeIdentitySync(remote.id);
    const requirements = summarizeStripeRecipientRequirements(remote);
    return await ctx.runMutation(internal.paymentsV2.upsertInstructorConnectedAccountFromProviderV2, {
      provider: "stripe",
      providerAccountId: remote.id,
      providerStatusRaw: summarizeStripeRecipientAccountStatus(remote),
      country: remote.identity?.country?.toUpperCase() || market.country,
      currency: market.currency,
      ...identity,
      metadata: {
        dashboard: "express",
        ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
        blockingRequirementsCount: String(requirements.blockingCount),
      },
    });
  }

  const email = currentUser.email?.trim();
  if (!email) {
    throw new ConvexError("Instructor email is required for Stripe onboarding");
  }

  const displayName = currentUser.name?.trim() || email;
  const account = await createStripeRecipientAccountV2({
    email,
    displayName,
    country: market.country,
    defaultCurrency: market.currency,
  });
  const identity = await buildStripeIdentitySync(account.id);
  const requirements = summarizeStripeRecipientRequirements(account);

  return await ctx.runMutation(internal.paymentsV2.upsertInstructorConnectedAccountFromProviderV2, {
    provider: "stripe",
    providerAccountId: account.id,
    providerStatusRaw: summarizeStripeRecipientAccountStatus(account),
    country: account.identity?.country?.toUpperCase() || market.country,
    currency: market.currency,
    ...identity,
    metadata: {
      dashboard: "express",
      ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
      blockingRequirementsCount: String(requirements.blockingCount),
    },
  });
}

export const ensureMyInstructorStripeConnectedAccountV2 = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureInstructorStripeConnectedAccount(ctx);
  },
});

export const createMyInstructorStripeAccountLinkV2 = action({
  args: {},
  returns: stripeAccountLinkSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureInstructorStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const link = await createStripeAccountLinkV2({
      accountId: account.providerAccountId,
      refreshUrl: STRIPE_CONNECT_REFRESH_URL,
      returnUrl: STRIPE_CONNECT_RETURN_URL,
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      onboardingUrl: link.url,
      ...(link.expires_at ? { expiresAt: link.expires_at } : {}),
    };
  },
});

export const refreshMyInstructorStripeConnectedAccountV2 = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const market = getStripeMarketDefaults();
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Unauthorized");
    }

    const existing = await ctx.runQuery(api.paymentsV2.getMyInstructorConnectedAccountV2, {});
    if (!existing?.providerAccountId || existing.provider !== "stripe") {
      throw new ConvexError("Stripe connected account not found");
    }

    const remote = await retrieveStripeAccountV2(existing.providerAccountId);
    const identity = await buildStripeIdentitySync(remote.id);
    const requirements = summarizeStripeRecipientRequirements(remote);
    return await ctx.runMutation(internal.paymentsV2.upsertInstructorConnectedAccountFromProviderV2, {
      provider: "stripe",
      providerAccountId: remote.id,
      providerStatusRaw: summarizeStripeRecipientAccountStatus(remote),
      country: remote.identity?.country?.toUpperCase() || market.country,
      currency: market.currency,
      ...identity,
      metadata: {
        dashboard: "express",
        ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
        blockingRequirementsCount: String(requirements.blockingCount),
      },
    });
  },
});

export const ensureMyInstructorConnectedAccountV2 = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureInstructorStripeConnectedAccount(ctx);
  },
});

export const createStripePaymentSheetForPaymentOrderV2 = action({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: stripePaymentSheetSessionSummaryValidator,
  handler: async (ctx, args): Promise<StripePaymentSheetSessionSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }
    const checkoutContext: Awaited<ReturnType<typeof ctx.runQuery<typeof api.paymentsV2.getPaymentCheckoutContextV2>>> =
      await ctx.runQuery(api.paymentsV2.getPaymentCheckoutContextV2, {
      paymentOrderId: args.paymentOrderId,
    });
    if (!checkoutContext?.order) {
      throw new ConvexError("Payment order not found");
    }

    const { order, attempt, connectedAccount } = checkoutContext;
    if (order.provider !== "stripe") {
      throw new ConvexError("Payment order is not configured for Stripe");
    }
    if (!connectedAccount?.providerAccountId || connectedAccount.provider !== "stripe") {
      throw new ConvexError("Instructor Stripe account is required before checkout");
    }
    if (connectedAccount.status !== "active") {
      throw new ConvexError("Instructor Stripe account is not ready to receive funds");
    }

    if (attempt?.provider === "stripe" && attempt.providerPaymentIntentId && attempt.clientSecretRef) {
      return {
        provider: "stripe",
        providerPaymentIntentId: attempt.providerPaymentIntentId,
        clientSecret: attempt.clientSecretRef,
        status: attempt.status,
      };
    }

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ConvexError("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new StripeSDK(secretKey);
    const requestId = crypto.randomUUID();
    const idempotencyKey = `stripe:payment-intent:${order._id}`;
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: order.pricing.studioChargeAmountAgorot,
        currency: order.currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        application_fee_amount: order.pricing.platformServiceFeeAgorot,
        ...(currentUser.email?.trim() ? { receipt_email: currentUser.email.trim() } : {}),
        metadata: {
          payment_order_id: String(order._id),
          job_id: String(order.jobId),
          instructor_user_id: String(order.instructorUserId),
          studio_user_id: String(order.studioUserId),
          connected_account_id: connectedAccount.providerAccountId,
        },
        on_behalf_of: connectedAccount.providerAccountId,
        transfer_data: {
          destination: connectedAccount.providerAccountId,
        },
        description: `Queue lesson ${order.correlationKey}`,
      },
      {
        idempotencyKey,
      },
    );

    if (!paymentIntent.client_secret) {
      throw new ConvexError("Stripe did not return a PaymentIntent client secret");
    }

    const status = mapStripePaymentIntentStatusToPaymentOrderStatus(paymentIntent.status);

    await ctx.runMutation(internal.paymentsV2.recordStripePaymentIntentAttemptV2, {
      paymentOrderId: order._id,
      providerPaymentIntentId: paymentIntent.id,
      clientSecretRef: paymentIntent.client_secret,
      status,
      statusRaw: paymentIntent.status,
      requestId,
      idempotencyKey,
      metadata: {
        payment_order_id: String(order._id),
        job_id: String(order.jobId),
      },
    });

    return {
      provider: "stripe",
      providerPaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status,
    };
  },
});
