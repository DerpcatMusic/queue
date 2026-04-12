"use node";

import { StripeSubscriptions } from "@convex-dev/stripe";
import { ConvexError, v } from "convex/values";
import StripeSDK from "stripe";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { getStripeConnectReturnUrls, getStripeMarketDefaults } from "./integrations/stripe/config";
import {
  createStripeAccountLinkV2,
  createStripeAccountSessionV2,
  createStripeRecipientAccountV2,
  getStripeRepresentativeNameV2,
  retrieveStripeAccountV2,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "./integrations/stripe/connectV2";

const stripeCustomers = new StripeSubscriptions(components.stripe, {});

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
  customerId: v.optional(v.string()),
  providerCountry: v.string(),
  currency: v.string(),
  amountAgorot: v.number(),
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
  customerId?: string;
  providerCountry: string;
  currency: string;
  amountAgorot: number;
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

type StripeCustomerSheetSessionSummary = {
  provider: "stripe";
  customerId: string;
  customerSessionClientSecret: string;
  setupIntentClientSecret: string;
};

const stripeAccountLinkSummaryValidator = v.object({
  provider: v.literal("stripe"),
  accountId: v.string(),
  onboardingUrl: v.string(),
  expiresAt: v.optional(v.string()),
});

const stripeAccountSessionSummaryValidator = v.object({
  provider: v.literal("stripe"),
  accountId: v.string(),
  clientSecret: v.string(),
});

const stripeCustomerSheetSessionSummaryValidator = v.object({
  provider: v.literal("stripe"),
  customerId: v.string(),
  customerSessionClientSecret: v.string(),
  setupIntentClientSecret: v.string(),
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
    return await ctx.runMutation(
      internal.paymentsV2.upsertInstructorConnectedAccountFromProviderV2,
      {
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
      },
    );
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

    const connectUrls = getStripeConnectReturnUrls();
    const link = await createStripeAccountLinkV2({
      accountId: account.providerAccountId,
      refreshUrl: connectUrls.refreshUrl,
      returnUrl: connectUrls.returnUrl,
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      onboardingUrl: link.url,
      ...(link.expires_at ? { expiresAt: link.expires_at } : {}),
    };
  },
});

export const createMyInstructorStripeEmbeddedSessionV2 = action({
  args: {},
  returns: stripeAccountSessionSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureInstructorStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const session = await createStripeAccountSessionV2({
      accountId: account.providerAccountId,
      enableOnboarding: true,
      enablePayouts: true,
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      clientSecret: session.clientSecret,
    };
  },
});

export const createMyStudioStripeCustomerSheetSessionV2 = action({
  args: {},
  returns: stripeCustomerSheetSessionSummaryValidator,
  handler: async (ctx): Promise<StripeCustomerSheetSessionSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ConvexError("STRIPE_SECRET_KEY is not configured");
    }

    const customerArgs: {
      userId: string;
      email?: string;
      name?: string;
    } = {
      userId: String(currentUser._id),
    };
    const customerEmail = currentUser.email?.trim();
    if (customerEmail) {
      customerArgs.email = customerEmail;
    }
    const customerName = currentUser.name?.trim();
    if (customerName) {
      customerArgs.name = customerName;
    }
    const customer = await stripeCustomers.getOrCreateCustomer(ctx, customerArgs);
    const stripe = new StripeSDK(secretKey);

    const customerSession = await stripe.customerSessions.create({
      customer: customer.customerId,
      components: {
        customer_sheet: {
          enabled: true,
          features: {
            payment_method_remove: "enabled",
            payment_method_allow_redisplay_filters: ["always", "limited", "unspecified"],
          },
        },
      },
    });
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.customerId,
      usage: "off_session",
    });

    if (!customerSession.client_secret) {
      throw new ConvexError("Stripe did not return a CustomerSession client secret");
    }
    if (!setupIntent.client_secret) {
      throw new ConvexError("Stripe did not return a SetupIntent client secret");
    }

    return {
      provider: "stripe",
      customerId: customer.customerId,
      customerSessionClientSecret: customerSession.client_secret,
      setupIntentClientSecret: setupIntent.client_secret,
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
    return await ctx.runMutation(
      internal.paymentsV2.upsertInstructorConnectedAccountFromProviderV2,
      {
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
      },
    );
  },
});

export const ensureMyInstructorConnectedAccountV2 = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureInstructorStripeConnectedAccount(ctx);
  },
});

// ── Studio Stripe Connected Account ──────────────────────────────────

async function ensureStudioStripeConnectedAccount(
  ctx: any,
): Promise<ConnectedAccountOnboardingSummary> {
  const market = getStripeMarketDefaults();
  const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
  if (!currentUser || currentUser.role !== "studio") {
    throw new ConvexError("Unauthorized");
  }

  const existing: ConnectedAccountOnboardingSummary | null = await ctx.runQuery(
    api.paymentsV2.getMyStudioConnectedAccountV2,
    {},
  );

  if (existing?.provider === "stripe") {
    const remote = await retrieveStripeAccountV2(existing.providerAccountId);
    const identity = await buildStripeIdentitySync(remote.id);
    const requirements = summarizeStripeRecipientRequirements(remote);
    return await ctx.runMutation(
      internal.paymentsV2.upsertStudioConnectedAccountFromProviderV2,
      {
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
      },
    );
  }

  const account = await createStripeRecipientAccountV2({
    country: market.country,
    email: currentUser.email?.trim() || undefined,
    displayName: currentUser.name?.trim() || STRIPE_MERCHANT_DISPLAY_NAME,
    defaultCurrency: market.currency,
  });

  const identity = await buildStripeIdentitySync(account.id);
  const requirements = summarizeStripeRecipientRequirements(account);

  return await ctx.runMutation(
    internal.paymentsV2.upsertStudioConnectedAccountFromProviderV2,
    {
      provider: "stripe",
      providerAccountId: account.id,
      providerStatusRaw: summarizeStripeRecipientAccountStatus(account),
      country: market.country,
      currency: market.currency,
      ...identity,
      metadata: {
        dashboard: "express",
        ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
        blockingRequirementsCount: String(requirements.blockingCount),
      },
    },
  );
}

export const ensureMyStudioConnectedAccountV2 = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureStudioStripeConnectedAccount(ctx);
  },
});

export const createMyStudioStripeEmbeddedSessionV2 = action({
  args: {},
  returns: stripeAccountSessionSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureStudioStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const session = await createStripeAccountSessionV2({
      accountId: account.providerAccountId,
      enableOnboarding: true,
      enablePayouts: true,
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      clientSecret: session.clientSecret,
    };
  },
});

export const createMyStudioStripeAccountLinkV2 = action({
  args: {},
  returns: stripeAccountLinkSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureStudioStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const connectUrls = getStripeConnectReturnUrls();
    const link = await createStripeAccountLinkV2({
      accountId: account.providerAccountId,
      refreshUrl: connectUrls.refreshUrl,
      returnUrl: connectUrls.returnUrl,
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      onboardingUrl: link.url,
      ...(link.expires_at ? { expiresAt: link.expires_at } : {}),
    };
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
    const checkoutContext: Awaited<
      ReturnType<typeof ctx.runQuery<typeof api.paymentsV2.getPaymentCheckoutContextV2>>
    > = await ctx.runQuery(api.paymentsV2.getPaymentCheckoutContextV2, {
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

    if (
      attempt?.provider === "stripe" &&
      attempt.providerPaymentIntentId &&
      attempt.clientSecretRef
    ) {
      return {
        provider: "stripe",
        providerPaymentIntentId: attempt.providerPaymentIntentId,
        clientSecret: attempt.clientSecretRef,
        providerCountry: order.providerCountry,
        currency: order.currency,
        amountAgorot: order.pricing.studioChargeAmountAgorot,
        status: attempt.status,
      };
    }

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ConvexError("STRIPE_SECRET_KEY is not configured");
    }

    const customerArgs: {
      userId: string;
      email?: string;
      name?: string;
    } = {
      userId: String(currentUser._id),
    };
    const customerEmail = currentUser.email?.trim();
    if (customerEmail) {
      customerArgs.email = customerEmail;
    }
    const customerName = currentUser.name?.trim();
    if (customerName) {
      customerArgs.name = customerName;
    }
    const customer = await stripeCustomers.getOrCreateCustomer(ctx, customerArgs);
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
        customer: customer.customerId,
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
      customerId: customer.customerId,
      providerCountry: order.providerCountry,
      currency: order.currency,
      amountAgorot: order.pricing.studioChargeAmountAgorot,
      status,
    };
  },
});
