"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getStripeMarketDefaults } from "../integrations/stripe/config";
import {
  connectedAccountOnboardingSummaryValidator,
  createStripeAccountLink,
  createStripeAccountSession,
  diditVerificationRefreshSummaryValidator,
  diditVerificationSessionSummaryValidator,
  ensureStudioStripeConnectedAccount,
  extractDiditDecisionDetails,
  getDiditSessionDetails,
  getDiditString,
  getDiditVerificationUrl,
  getDiditWorkflowId,
  normalizeDiditStatus,
  postDiditSession,
  type StripeCustomerSheetSessionSummary,
  StripeSDK,
  type StudioStripePaymentProfileSyncSummary,
  splitDiditName,
  stripeAccountLinkSummaryValidator,
  stripeAccountSessionSummaryValidator,
  stripeCustomerSheetSessionSummaryValidator,
  stripeCustomers,
  studioStripePaymentProfileSyncSummaryValidator,
} from "./actionShared";

export const createMyStudioStripeCustomerSheetSession = action({
  args: {},
  returns: stripeCustomerSheetSessionSummaryValidator,
  handler: async (ctx): Promise<StripeCustomerSheetSessionSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
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
    const studioSettings = await ctx.runQuery(api.studios.settings.getMyStudioSettings, {});
    if (studioSettings?.studioId) {
      await ctx.runMutation(internal.compliance.studio.applyStudioPaymentProfileSnapshot, {
        studioId: studioSettings.studioId,
        provider: "stripe",
        status: "pending",
        providerCustomerId: customer.customerId,
        chargesEnabled: false,
        savedPaymentMethodCount: 0,
        lastSyncedAt: Date.now(),
      });
    }
    const stripe = new StripeSDK(secretKey);

    const customerSession = await stripe.customerSessions.create({
      customer: customer.customerId,
      components: {
        mobile_payment_element: {
          enabled: true,
          features: {
            payment_method_save: "enabled",
            payment_method_redisplay: "enabled",
            payment_method_remove: "enabled",
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

export const syncMyStudioStripePaymentProfile = action({
  args: {},
  returns: studioStripePaymentProfileSyncSummaryValidator,
  handler: async (ctx): Promise<StudioStripePaymentProfileSyncSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }

    const studioSettings = await ctx.runQuery(api.studios.settings.getMyStudioSettings, {});
    if (!studioSettings?.studioId) {
      throw new ConvexError("Studio profile not found");
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
    const candidateTypes = ["card", "sepa_debit", "bacs_debit", "us_bank_account"] as const;
    const paymentMethods = (
      await Promise.all(
        candidateTypes.map(async (type) => {
          const response = await stripe.paymentMethods.list({
            customer: customer.customerId,
            type,
            limit: 10,
          });
          return response.data.map((paymentMethod) => ({
            id: paymentMethod.id,
            type: paymentMethod.type,
          }));
        }),
      )
    ).flat();

    const uniqueTypes = [...new Set(paymentMethods.map((paymentMethod) => paymentMethod.type))];
    const remoteCustomer = await stripe.customers.retrieve(customer.customerId);
    const defaultPaymentMethodId =
      !("deleted" in remoteCustomer) &&
      typeof remoteCustomer.invoice_settings?.default_payment_method === "string"
        ? remoteCustomer.invoice_settings.default_payment_method
        : undefined;
    const defaultPaymentMethodType = defaultPaymentMethodId
      ? paymentMethods.find((paymentMethod) => paymentMethod.id === defaultPaymentMethodId)?.type
      : paymentMethods[0]?.type;
    const savedPaymentMethodCount = paymentMethods.length;
    const status = savedPaymentMethodCount > 0 ? "ready" : "missing";

    await ctx.runMutation(internal.compliance.studio.applyStudioPaymentProfileSnapshot, {
      studioId: studioSettings.studioId,
      provider: "stripe",
      status,
      providerCustomerId: customer.customerId,
      chargesEnabled: savedPaymentMethodCount > 0,
      savedPaymentMethodCount,
      defaultPaymentMethodType,
      supportedPaymentMethodTypes: uniqueTypes,
      readyForChargesAt: savedPaymentMethodCount > 0 ? Date.now() : undefined,
      lastPaymentMethodSyncedAt: Date.now(),
      lastSyncedAt: Date.now(),
    });

    return {
      provider: "stripe",
      status,
      customerId: customer.customerId,
      savedPaymentMethodCount,
      ...(defaultPaymentMethodType ? { defaultPaymentMethodType } : {}),
      supportedPaymentMethodTypes: uniqueTypes,
    };
  },
});

export const ensureMyStudioConnectedAccount = action({
  args: {},
  returns: connectedAccountOnboardingSummaryValidator,
  handler: async (ctx): Promise<any> => {
    return await ensureStudioStripeConnectedAccount(ctx);
  },
});

export const createMyStudioStripeEmbeddedSession = action({
  args: {},
  returns: stripeAccountSessionSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureStudioStripeConnectedAccount(ctx);
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

export const createMyStudioStripeAccountLink = action({
  args: {},
  returns: stripeAccountLinkSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const account = await ensureStudioStripeConnectedAccount(ctx);
    if (account.provider !== "stripe") {
      throw new ConvexError("Failed to initialize Stripe connected account");
    }

    const connectUrls = {
      refreshUrl:
        process.env.STRIPE_CONNECT_REFRESH_URL?.trim() || "queue://stripe-connect-refresh",
      returnUrl: process.env.STRIPE_CONNECT_RETURN_URL?.trim() || "queue://stripe-connect-return",
    };
    const link = await createStripeAccountLink({
      accountId: account.providerAccountId,
      refreshUrl: connectUrls.refreshUrl,
      returnUrl: connectUrls.returnUrl,
      configurations: ["merchant"],
    });

    return {
      provider: "stripe",
      accountId: account.providerAccountId,
      onboardingUrl: link.url,
      ...(link.expires_at ? { expiresAt: link.expires_at } : {}),
    };
  },
});

export const createMyStudioDiditVerificationSession = action({
  args: {},
  returns: diditVerificationSessionSummaryValidator,
  handler: async (ctx): Promise<any> => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }
    const studioSettings = await ctx.runQuery(api.studios.settings.getMyStudioSettings, {});

    if (!studioSettings) {
      throw new ConvexError("Studio profile not found");
    }

    const diditWorkflowId = getDiditWorkflowId();
    if (!diditWorkflowId) {
      throw new ConvexError("DIDIT_WORKFLOW_ID is not configured");
    }

    const expectedDetails = splitDiditName(currentUser.fullName?.trim());
    const payload = {
      workflow_id: diditWorkflowId,
      callback:
        process.env.DIDIT_CALLBACK_URL?.trim() ||
        "https://join-queue.com/studio/profile/compliance",
      vendor_data: String(currentUser._id),
      metadata: {
        userId: String(currentUser._id),
        studioId: String(studioSettings.studioId),
        studioName: studioSettings.studioName,
        role: "studio",
      },
      contact_details: {
        ...(currentUser.email?.trim() ? { email: currentUser.email.trim() } : {}),
        ...(currentUser.phoneE164?.trim() ? { phone: currentUser.phoneE164.trim() } : {}),
        send_notification_emails: false,
      },
      ...(Object.keys(expectedDetails).length > 0 ? { expected_details: expectedDetails } : {}),
    };

    const session = await postDiditSession(payload);
    const sessionId = getDiditString(session, ["session_id"]);
    const sessionToken = getDiditString(session, ["session_token"]);
    const statusRaw = getDiditString(session, ["status"]) ?? "not_started";
    if (!sessionId || !sessionToken) {
      throw new ConvexError("Didit session did not return the expected fields");
    }
    const verificationUrl =
      getDiditString(session, ["verification_url", "url"]) ?? getDiditVerificationUrl(sessionToken);

    const parsed = extractDiditDecisionDetails(session);
    const studioCountryCode =
      ("addressCountryCode" in studioSettings && typeof studioSettings.addressCountryCode === "string"
        ? studioSettings.addressCountryCode
        : undefined) ?? getStripeMarketDefaults().country;
    const billingAddressStructured =
      studioSettings.addressStreet && studioSettings.addressCity && studioSettings.addressPostalCode
        ? {
            line1: [studioSettings.addressStreet, studioSettings.addressNumber]
              .filter(Boolean)
              .join(" ")
              .trim(),
            ...(studioSettings.addressFloor ? { line2: studioSettings.addressFloor } : {}),
            city: studioSettings.addressCity,
            postalCode: studioSettings.addressPostalCode,
            ...(studioCountryCode ? { country: studioCountryCode } : {}),
          }
        : undefined;
    await ctx.runMutation(internal.payments.core.syncStudioDiditVerification, {
      userId: currentUser._id,
      sessionId,
      statusRaw,
      ...parsed,
      billingBusinessName: studioSettings.studioName,
      ...(currentUser.email?.trim() ? { billingEmail: currentUser.email.trim() } : {}),
      ...(currentUser.phoneE164?.trim() ? { billingPhone: currentUser.phoneE164.trim() } : {}),
      ...(studioSettings.address?.trim() ? { billingAddress: studioSettings.address.trim() } : {}),
      ...(billingAddressStructured ? { billingAddressStructured } : {}),
      ...(studioCountryCode ? { country: studioCountryCode } : {}),
    });

    return {
      provider: "didit",
      sessionId,
      sessionToken,
      verificationUrl,
      status: normalizeDiditStatus(statusRaw),
    };
  },
});

export const refreshMyStudioDiditVerification = action({
  args: {
    sessionId: v.string(),
  },
  returns: diditVerificationRefreshSummaryValidator,
  handler: async (ctx, args): Promise<any> => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }
    const session = await getDiditSessionDetails(args.sessionId);

    await ctx.runMutation(internal.payments.core.syncStudioDiditVerification, {
      userId: currentUser._id,
      sessionId: args.sessionId,
      statusRaw: session.statusRaw,
      ...session.parsed,
    });

    return {
      provider: "didit",
      sessionId: args.sessionId,
      status: session.status,
    };
  },
});
