"use node";

import { ConvexError } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getStripeConnectReturnUrls, getStripeMarketDefaults } from "../integrations/stripe/config";
import {
  buildStripeIdentitySync,
  connectedAccountOnboardingSummaryValidator,
  createStripeAccountLink,
  createStripeAccountSession,
  ensureInstructorStripeConnectedAccount,
  retrieveStripeAccount,
  stripeAccountLinkSummaryValidator,
  stripeAccountSessionSummaryValidator,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "./actionShared";

export const ensureMyInstructorStripeConnectedAccount = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureInstructorStripeConnectedAccount(ctx);
  },
});

export const createMyInstructorStripeAccountLink = action({
  args: {},
  returns: stripeAccountLinkSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureInstructorStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const connectUrls = getStripeConnectReturnUrls();
    const link = await createStripeAccountLink({
      accountId: account.providerAccountId,
      refreshUrl: connectUrls.refreshUrl,
      returnUrl: connectUrls.returnUrl,
      configurations: ["recipient"],
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      onboardingUrl: link.url,
      ...(link.expires_at ? { expiresAt: link.expires_at } : {}),
    };
  },
});

export const createMyInstructorStripeEmbeddedSession = action({
  args: {},
  returns: stripeAccountSessionSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureInstructorStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const session = await createStripeAccountSession({
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

export const refreshMyInstructorStripeConnectedAccount = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const market = getStripeMarketDefaults();
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Unauthorized");
    }

    const existing = await ctx.runQuery(api.payments.core.getMyInstructorConnectedAccount, {});
    if (!existing?.providerAccountId || existing.provider !== "stripe") {
      throw new ConvexError("Stripe connected account not found");
    }

    const remote = await retrieveStripeAccount(existing.providerAccountId);
    const identity = await buildStripeIdentitySync(remote.id);
    const requirements = summarizeStripeRecipientRequirements(remote);
    return await ctx.runMutation(
      internal.payments.core.upsertInstructorConnectedAccountFromProvider,
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

export const ensureMyInstructorConnectedAccount = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureInstructorStripeConnectedAccount(ctx);
  },
});
