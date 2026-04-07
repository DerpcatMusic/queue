"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { mapAirwallexPaymentIntentStatus } from "./integrations/airwallex/adapters/checkout";
import {
  AIRWALLEX_ENDPOINTS,
  executeAirwallexPost,
  executeAirwallexRequest,
} from "./integrations/airwallex/client";
import { getRequiredEnv, resolveAirwallexEnvironment } from "./integrations/airwallex/config";
import { omitUndefined } from "./lib/validation";

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
  provider: v.literal("airwallex"),
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

const checkoutSessionSummaryValidator = v.object({
  provider: v.literal("airwallex"),
  providerPaymentIntentId: v.string(),
  clientSecret: v.optional(v.string()),
  status: paymentOrderStatusValidator,
  sdkEnvironment: v.union(v.literal("demo"), v.literal("production"), v.literal("staging")),
});

type ConnectedAccountOnboardingSummary = {
  _id: Id<"connectedAccountsV2">;
  provider: "airwallex";
  providerAccountId: string;
  accountCapability: "ledger" | "withdrawal" | "full";
  status: "pending" | "action_required" | "active" | "restricted" | "rejected" | "disabled";
  country: string;
  currency: string;
  createdAt: number;
  updatedAt: number;
  activatedAt?: number;
};

type CheckoutSessionSummary = {
  provider: "airwallex";
  providerPaymentIntentId: string;
  clientSecret?: string;
  status:
    | "draft"
    | "requires_payment_method"
    | "processing"
    | "succeeded"
    | "partially_refunded"
    | "refunded"
    | "failed"
    | "cancelled";
  sdkEnvironment: "demo" | "production" | "staging";
};

type FundSplitSummary = {
  _id: Id<"fundSplitsV2">;
  paymentOrderId: Id<"paymentOrdersV2">;
  paymentAttemptId: Id<"paymentAttemptsV2">;
  connectedAccountId: Id<"connectedAccountsV2">;
  provider: "airwallex";
  sourcePaymentIntentId: string;
  destinationAccountId: string;
  amountAgorot: number;
  currency: string;
  autoRelease: boolean;
  releaseMode: "automatic" | "manual" | "scheduled";
  status: "pending_create" | "created" | "released" | "settled" | "failed" | "reversed";
  requestId: string;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  providerFundsSplitId?: string;
  failureReason?: string;
  releasedAt?: number;
  settledAt?: number;
};

type EmbeddedOnboardingSessionSummary = {
  provider: "airwallex";
  providerAccountId: string;
  authCode: string;
  clientId: string;
  codeVerifier: string;
  sdkEnvironment: "demo" | "prod";
  locale: "en" | "fr" | "zh";
};

const embeddedOnboardingSessionSummaryValidator = v.object({
  provider: v.literal("airwallex"),
  providerAccountId: v.string(),
  authCode: v.string(),
  clientId: v.string(),
  codeVerifier: v.string(),
  sdkEnvironment: v.union(v.literal("demo"), v.literal("prod")),
  locale: v.union(v.literal("en"), v.literal("fr"), v.literal("zh")),
});

const mapCheckoutStatusToPaymentOrderStatus = (
  status: ReturnType<typeof mapAirwallexPaymentIntentStatus>,
): "draft" | "requires_payment_method" | "succeeded" | "failed" | "cancelled" => {
  switch (status) {
    case "created":
      return "draft";
    case "pending":
    case "requires_action":
      return "requires_payment_method";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "expired":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
};

const resolveAirwallexMobileSdkEnvironment = (): "demo" | "production" => {
  const env = resolveAirwallexEnvironment();
  return env === "production" ? "production" : "demo";
};

const resolveAirwallexComponentsEnvironment = (): "demo" | "prod" => {
  const env = resolveAirwallexEnvironment();
  return env === "production" ? "prod" : "demo";
};

const base64UrlEncode = (input: Uint8Array): string =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const createPkcePair = async (): Promise<{ codeVerifier: string; codeChallenge: string }> => {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const challengeBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)),
  );
  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(challengeBytes),
  };
};

const resolveEmbeddedOnboardingLocale = (locale: string | null | undefined): "en" | "fr" | "zh" => {
  const normalized = locale?.trim().toLowerCase();
  if (normalized?.startsWith("fr")) return "fr";
  if (normalized?.startsWith("zh")) return "zh";
  return "en";
};

async function ensureInstructorConnectedAccount(
  ctx: any,
): Promise<ConnectedAccountOnboardingSummary> {
  const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
  if (!currentUser || currentUser.role !== "instructor") {
    throw new ConvexError("Unauthorized");
  }

  const existing: ConnectedAccountOnboardingSummary | null = await ctx.runQuery(
    api.paymentsV2.getMyInstructorConnectedAccountV2,
    {},
  );
  if (existing) {
    return existing;
  }

  const email = currentUser.email?.trim();
  if (!email) {
    throw new ConvexError("Instructor email is required for Airwallex onboarding");
  }

  const requestBody = {
    account_details: {
      legal_entity_type: "INDIVIDUAL",
      individual_details: {
        // Required for INDIVIDUAL legal entity type; embedded KYC will fill in the rest
      },
    },
    customer_agreements: {
      agreed_to_data_usage: true,
      agreed_to_terms_and_conditions: true,
    },
    primary_contact: {
      email,
    },
    metadata: {
      role: "instructor",
      user_id: String(currentUser._id),
    },
  };

  const idempotencyKey = `airwallex:connected-account:${currentUser._id}`;
  const response = await executeAirwallexPost<{
    account_id: string;
    status: string;
  }>(AIRWALLEX_ENDPOINTS.ACCOUNTS_CREATE, requestBody, idempotencyKey);

  return await ctx.runMutation(internal.paymentsV2.upsertInstructorConnectedAccountFromProviderV2, {
    providerAccountId: response.data.account_id,
    providerStatusRaw: response.data.status,
  });
}

export const ensureMyInstructorConnectedAccountV2 = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<ConnectedAccountOnboardingSummary> => {
    return await ensureInstructorConnectedAccount(ctx);
  },
});

export const createMyInstructorEmbeddedOnboardingSessionV2 = action({
  args: {
    locale: v.optional(v.string()),
  },
  returns: embeddedOnboardingSessionSummaryValidator,
  handler: async (ctx, args): Promise<EmbeddedOnboardingSessionSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Unauthorized");
    }

    const connectedAccount = await ensureInstructorConnectedAccount(ctx);
    if (!connectedAccount.providerAccountId) {
      throw new ConvexError("Airwallex connected account is required");
    }

    const { codeVerifier, codeChallenge } = await createPkcePair();
    const response = await executeAirwallexRequest<{
      authorization_code: string;
    }>({
      method: "POST",
      path: AIRWALLEX_ENDPOINTS.AUTH_AUTHORIZE,
      body: {
        code_challenge: codeChallenge,
        scope: ["w:awx_action:onboarding"],
        identity: String(currentUser._id),
      },
      idempotencyKey: `airwallex:onboarding-auth:${connectedAccount._id}:${Date.now()}`,
      headers: {
        "x-on-behalf-of": connectedAccount.providerAccountId,
      },
    });

    return {
      provider: "airwallex",
      providerAccountId: connectedAccount.providerAccountId,
      authCode: response.data.authorization_code,
      clientId: getRequiredEnv("AIRWALLEX_CLIENT_ID"),
      codeVerifier,
      sdkEnvironment: resolveAirwallexComponentsEnvironment(),
      locale: resolveEmbeddedOnboardingLocale(args.locale),
    };
  },
});

export const createAirwallexCheckoutSessionForPaymentOrderV2 = action({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: checkoutSessionSummaryValidator,
  handler: async (ctx, args): Promise<CheckoutSessionSummary> => {
    const checkoutContext = await ctx.runQuery(api.paymentsV2.getPaymentCheckoutContextV2, {
      paymentOrderId: args.paymentOrderId,
    });
    if (!checkoutContext?.order) {
      throw new ConvexError("Payment order not found");
    }

    const { order, attempt, connectedAccount } = checkoutContext;
    if (!connectedAccount?.providerAccountId) {
      throw new ConvexError("Instructor Airwallex account is required before checkout");
    }
    if (connectedAccount.status === "rejected" || connectedAccount.status === "disabled") {
      throw new ConvexError("Instructor Airwallex account is not eligible for split settlement");
    }

    const sdkEnvironment = resolveAirwallexMobileSdkEnvironment();

    if (attempt?.providerPaymentIntentId && attempt.clientSecretRef) {
      return {
        provider: "airwallex" as const,
        providerPaymentIntentId: attempt.providerPaymentIntentId,
        clientSecret: attempt.clientSecretRef,
        status: attempt.status,
        sdkEnvironment,
      };
    }

    const requestId = crypto.randomUUID();
    const idempotencyKey = `airwallex:payment-intent:${order._id}`;
    const requestBody = {
      request_id: requestId,
      amount: Number((order.pricing.studioChargeAmountAgorot / 100).toFixed(2)),
      currency: order.currency,
      country_code: order.providerCountry,
      merchant_order_id: order.correlationKey,
      connected_account_id: connectedAccount.providerAccountId,
      metadata: {
        payment_order_id: String(order._id),
        job_id: String(order.jobId),
        instructor_user_id: String(order.instructorUserId),
        studio_user_id: String(order.studioUserId),
      },
    };

    const response = await executeAirwallexPost<{
      id: string;
      client_secret?: string;
      status: string;
    }>(AIRWALLEX_ENDPOINTS.PAYMENT_INTENTS_CREATE, requestBody, idempotencyKey);

    const status = mapCheckoutStatusToPaymentOrderStatus(
      mapAirwallexPaymentIntentStatus(response.data.status),
    );

    await ctx.runMutation(internal.paymentsV2.recordAirwallexCheckoutAttemptV2, {
      paymentOrderId: order._id,
      providerPaymentIntentId: response.data.id,
      status,
      statusRaw: response.data.status,
      requestId,
      idempotencyKey,
      ...omitUndefined({
        clientSecretRef: response.data.client_secret,
      }),
    });

    return {
      provider: "airwallex" as const,
      providerPaymentIntentId: response.data.id,
      status,
      sdkEnvironment,
      ...omitUndefined({
        clientSecret: response.data.client_secret,
      }),
    };
  },
});

export const ensureAirwallexFundSplitForPaymentOrderV2 = internalAction({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("fundSplitsV2"),
      paymentOrderId: v.id("paymentOrdersV2"),
      paymentAttemptId: v.id("paymentAttemptsV2"),
      connectedAccountId: v.id("connectedAccountsV2"),
      provider: v.literal("airwallex"),
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
    }),
  ),
  handler: async (ctx, args): Promise<FundSplitSummary | null> => {
    const context = await ctx.runQuery(internal.paymentsV2.getFundSplitCreationContextV2, {
      paymentOrderId: args.paymentOrderId,
    });
    if (!context) {
      return null;
    }

    const { order, attempt, connectedAccount, existingSplit } = context;
    if (order.status !== "succeeded") {
      return existingSplit;
    }
    if (connectedAccount.status === "rejected" || connectedAccount.status === "disabled") {
      throw new ConvexError("Instructor Airwallex account is not eligible for fund split");
    }
    if (existingSplit && existingSplit.status !== "failed" && existingSplit.status !== "reversed") {
      return existingSplit;
    }

    const requestId = crypto.randomUUID();
    const idempotencyKey = `airwallex:fund-split:${order._id}`;
    const amountFormatted = (order.pricing.instructorOfferAmountAgorot / 100).toFixed(2);
    const requestBody = {
      source_id: attempt.providerPaymentIntentId,
      source_type: "PAYMENT_INTENT",
      amount: {
        currency: order.currency,
        amount: amountFormatted,
      },
      destination: {
        type: "CONNECTED_ACCOUNT",
        id: connectedAccount.providerAccountId,
      },
      auto_release: false,
      type: "disbursement",
      metadata: {
        payment_order_id: String(order._id),
        payment_attempt_id: String(attempt._id),
        job_id: String(order.jobId),
        instructor_user_id: String(order.instructorUserId),
        studio_user_id: String(order.studioUserId),
      },
    };

    const response = await executeAirwallexPost<{
      id: string;
      status?: string;
    }>(AIRWALLEX_ENDPOINTS.FUNDS_SPLITS_CREATE, requestBody, idempotencyKey);

    return await ctx.runMutation(internal.paymentsV2.upsertFundSplitFromProviderV2, {
      paymentOrderId: order._id,
      paymentAttemptId: attempt._id,
      connectedAccountId: connectedAccount._id,
      providerFundsSplitId: response.data.id,
      sourcePaymentIntentId: attempt.providerPaymentIntentId,
      destinationAccountId: connectedAccount.providerAccountId,
      amountAgorot: order.pricing.instructorOfferAmountAgorot,
      currency: order.currency,
      autoRelease: false,
      releaseMode: "manual",
      status: response.data.status?.toUpperCase() === "FAILED" ? "failed" : "created",
      requestId,
      idempotencyKey,
    });
  },
});

export const releaseAirwallexFundSplitForPaymentOrderV2 = action({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("fundSplitsV2"),
      paymentOrderId: v.id("paymentOrdersV2"),
      paymentAttemptId: v.id("paymentAttemptsV2"),
      connectedAccountId: v.id("connectedAccountsV2"),
      provider: v.literal("airwallex"),
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
    }),
  ),
  handler: async (ctx, args): Promise<FundSplitSummary | null> => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }
    const context = await ctx.runQuery(internal.paymentsV2.getFundSplitCreationContextV2, {
      paymentOrderId: args.paymentOrderId,
    });
    if (!context) {
      return null;
    }
    const { order, existingSplit } = context;
    if (order.studioUserId !== currentUser._id) {
      throw new ConvexError("Unauthorized payment order");
    }
    if (!existingSplit?.providerFundsSplitId) {
      throw new ConvexError("Fund split has not been created yet");
    }
    if (existingSplit.status === "released" || existingSplit.status === "settled") {
      return existingSplit;
    }

    const requestId = crypto.randomUUID();
    await executeAirwallexPost(
      AIRWALLEX_ENDPOINTS.FUNDS_SPLITS_RELEASE(existingSplit.providerFundsSplitId),
      {},
      `airwallex:fund-split-release:${existingSplit._id}`,
    );

    return await ctx.runMutation(internal.paymentsV2.upsertFundSplitFromProviderV2, {
      paymentOrderId: existingSplit.paymentOrderId,
      paymentAttemptId: existingSplit.paymentAttemptId,
      connectedAccountId: existingSplit.connectedAccountId,
      providerFundsSplitId: existingSplit.providerFundsSplitId,
      sourcePaymentIntentId: existingSplit.sourcePaymentIntentId,
      destinationAccountId: existingSplit.destinationAccountId,
      amountAgorot: existingSplit.amountAgorot,
      currency: existingSplit.currency,
      autoRelease: existingSplit.autoRelease,
      releaseMode: existingSplit.releaseMode,
      status: "released",
      requestId,
      idempotencyKey: existingSplit.idempotencyKey,
      releasedAt: Date.now(),
    });
  },
});
