"use node";

import { StripeSubscriptions } from "@convex-dev/stripe";
import { ConvexError, v } from "convex/values";
import StripeSDK from "stripe";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { getStripeConnectReturnUrls, getStripeMarketDefaults } from "../integrations/stripe/config";
import {
  createStripeAccountLinkV2,
  createStripeAccountSessionV2,
  createStripeRecipientAccountV2,
  getStripeRepresentativeNameV2,
  retrieveStripeAccountV2,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "../integrations/stripe/connectV2";
import { diditVerificationStatusValidator } from "../lib/instructorCompliance";

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

const diditVerificationSessionStatusValidator = diditVerificationStatusValidator;

const diditVerificationSessionSummaryValidator = v.object({
  provider: v.literal("didit"),
  sessionId: v.string(),
  sessionToken: v.string(),
  verificationUrl: v.string(),
  status: diditVerificationSessionStatusValidator,
});

const diditVerificationRefreshSummaryValidator = v.object({
  provider: v.literal("didit"),
  sessionId: v.string(),
  status: diditVerificationSessionStatusValidator,
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

const DIDIT_BASE_URL = "https://verification.didit.me";
const DIDIT_VERIFICATION_HOST = "https://verify.didit.me";

function getDiditBaseUrl() {
  return (process.env.DIDIT_BASE_URL?.trim() || DIDIT_BASE_URL).trim();
}

function getDiditApiKey() {
  return (process.env.DIDIT_API_KEY ?? "").trim();
}

function getDiditWorkflowId() {
  return (process.env.DIDIT_WORKFLOW_ID ?? "").trim();
}

function getDiditCallbackUrl() {
  return (
    process.env.DIDIT_CALLBACK_URL?.trim() || "https://join-queue.com/studio/profile/compliance"
  ).trim();
}

function getDiditVerificationUrl(sessionToken: string) {
  return `${DIDIT_VERIFICATION_HOST}/session/${encodeURIComponent(sessionToken)}`.trim();
}

function normalizeDiditStatus(raw: string | undefined) {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("approve")) return "approved" as const;
  if (value.includes("declin")) return "declined" as const;
  if (value.includes("abandon")) return "abandoned" as const;
  if (value.includes("expir")) return "expired" as const;
  if (value.includes("review")) return "in_review" as const;
  if (value.includes("pending")) return "pending" as const;
  if (value.includes("progress")) return "in_progress" as const;
  return "not_started" as const;
}

function normalizeDiditText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

function getDiditString(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function getDiditObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getDiditArrayItem(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return getDiditObject(value[0]);
}

function splitDiditName(fullName: string | undefined) {
  if (!fullName) {
    return {};
  }
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function extractDiditDecisionDetails(decision: unknown) {
  const root = getDiditObject(decision);
  const idVerification =
    getDiditArrayItem(root?.id_verifications) ?? getDiditObject(root?.id_verifications);
  const poaVerification =
    getDiditArrayItem(root?.poa_verifications) ?? getDiditObject(root?.poa_verifications);
  const idExtracted = getDiditObject(idVerification?.extracted_data);
  const poaExtracted = getDiditObject(poaVerification?.extracted_data);

  const fullName =
    normalizeDiditText(
      getDiditString(idExtracted, ["full_name", "formatted_name"]) ??
        getDiditString(idVerification, ["full_name", "formatted_name"]) ??
        getDiditString(root, ["full_name", "formatted_name"]),
    ) ?? undefined;
  const nameParts = splitDiditName(
    fullName ??
      normalizeDiditText(
        [
          getDiditString(idExtracted, ["first_name", "firstName"]),
          getDiditString(idExtracted, ["middle_name", "middleName"]),
          getDiditString(idExtracted, ["last_name", "lastName"]),
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),
      ),
  );

  const directAddress =
    getDiditString(poaExtracted, ["formatted_address", "address"]) ??
    getDiditString(idExtracted, ["formatted_address", "address"]) ??
    getDiditString(root, ["formatted_address", "address"]);
  const line1 =
    getDiditString(poaExtracted, ["line1", "street_address", "street1"]) ??
    getDiditString(idExtracted, ["line1", "street_address", "street1"]);
  const line2 =
    getDiditString(poaExtracted, ["line2", "street2", "address2"]) ??
    getDiditString(idExtracted, ["line2", "street2", "address2"]);
  const city =
    getDiditString(poaExtracted, ["city", "town"]) ?? getDiditString(idExtracted, ["city", "town"]);
  const state =
    getDiditString(poaExtracted, ["state", "province", "region"]) ??
    getDiditString(idExtracted, ["state", "province", "region"]);
  const postalCode =
    getDiditString(poaExtracted, ["postal_code", "postalCode", "zip"]) ??
    getDiditString(idExtracted, ["postal_code", "postalCode", "zip"]);
  const country =
    getDiditString(poaExtracted, ["country"]) ??
    getDiditString(idExtracted, ["country"]) ??
    getDiditString(root, ["country"]);

  const billingAddressStructured =
    line1 && city && postalCode
      ? {
          line1,
          ...(line2 ? { line2 } : {}),
          city,
          ...(state ? { state } : {}),
          postalCode,
          ...(country ? { country } : {}),
        }
      : undefined;

  return {
    ...(fullName ? { legalName: fullName } : {}),
    ...nameParts,
    ...(directAddress ? { billingAddress: directAddress } : {}),
    ...(billingAddressStructured ? { billingAddressStructured } : {}),
    ...(country ? { country } : {}),
  };
}

async function postDiditSession(payload: Record<string, unknown>) {
  const apiKey = getDiditApiKey();
  if (!apiKey) {
    throw new ConvexError("DIDIT_API_KEY is not configured");
  }
  const response = await fetch(new URL("/v3/session/", getDiditBaseUrl()).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ConvexError(`Didit session creation failed: ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

async function getDiditSessionDetails(sessionId: string) {
  const apiKey = getDiditApiKey();
  if (!apiKey) {
    throw new ConvexError("DIDIT_API_KEY is not configured");
  }
  const baseUrl = getDiditBaseUrl();
  const fetchJson = async (path: string) => {
    const response = await fetch(new URL(path, baseUrl).toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });
    if (!response.ok) {
      return undefined;
    }
    const payload = (await response.json()) as unknown;
    return payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : undefined;
  };

  const [decisionPayload, sessionPayload] = await Promise.all([
    fetchJson(`/v3/session/${sessionId}/decision/`),
    fetchJson(`/v3/session/${sessionId}/`),
  ]);

  const decisionData = getDiditObject(decisionPayload?.data) ?? decisionPayload ?? undefined;
  const sessionData = getDiditObject(sessionPayload?.data) ?? sessionPayload ?? undefined;
  const statusRaw =
    getDiditString(decisionData, ["status"]) ??
    getDiditString(sessionData, ["status"]) ??
    "not_started";

  return {
    statusRaw,
    status: normalizeDiditStatus(statusRaw),
    decision: decisionData ?? sessionData,
    parsed: extractDiditDecisionDetails(decisionData ?? sessionData),
  };
}

async function ensureInstructorStripeConnectedAccount(
  ctx: any,
): Promise<ConnectedAccountOnboardingSummary> {
  const market = getStripeMarketDefaults();
  const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
  if (!currentUser || currentUser.role !== "instructor") {
    throw new ConvexError("Unauthorized");
  }

  const existing: ConnectedAccountOnboardingSummary | null = await ctx.runQuery(
    api.payments.core.getMyInstructorConnectedAccountV2,
    {},
  );

  if (existing?.provider === "stripe") {
    const remote = await retrieveStripeAccountV2(existing.providerAccountId);
    const identity = await buildStripeIdentitySync(remote.id);
    const requirements = summarizeStripeRecipientRequirements(remote);
    return await ctx.runMutation(
      internal.payments.core.upsertInstructorConnectedAccountFromProviderV2,
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

  return await ctx.runMutation(internal.payments.core.upsertInstructorConnectedAccountFromProviderV2, {
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
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Unauthorized");
    }

    const existing = await ctx.runQuery(api.payments.core.getMyInstructorConnectedAccountV2, {});
    if (!existing?.providerAccountId || existing.provider !== "stripe") {
      throw new ConvexError("Stripe connected account not found");
    }

    const remote = await retrieveStripeAccountV2(existing.providerAccountId);
    const identity = await buildStripeIdentitySync(remote.id);
    const requirements = summarizeStripeRecipientRequirements(remote);
    return await ctx.runMutation(
      internal.payments.core.upsertInstructorConnectedAccountFromProviderV2,
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
  const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
  if (!currentUser || currentUser.role !== "studio") {
    throw new ConvexError("Unauthorized");
  }
  const [studioSettings, complianceDetails] = await Promise.all([
    ctx.runQuery(api.studios.settings.getMyStudioSettings, {}),
    ctx.runQuery(api.compliance.studio.getMyStudioComplianceDetails, {}),
  ]);
  const billingProfile = complianceDetails?.billingProfile ?? null;

  const existing: ConnectedAccountOnboardingSummary | null = await ctx.runQuery(
    api.payments.core.getMyStudioConnectedAccountV2,
    {},
  );

  if (existing?.provider === "stripe") {
    const remote = await retrieveStripeAccountV2(existing.providerAccountId);
    const hasSupportedStudioConfig =
      remote.dashboard === "full" && remote.configuration?.merchant?.applied === true;

    if (hasSupportedStudioConfig) {
      const identity = await buildStripeIdentitySync(remote.id);
      const requirements = summarizeStripeRecipientRequirements(remote);
      return await ctx.runMutation(internal.payments.core.upsertStudioConnectedAccountFromProviderV2, {
        provider: "stripe",
        providerAccountId: remote.id,
        providerStatusRaw: summarizeStripeRecipientAccountStatus(remote),
        country: remote.identity?.country?.toUpperCase() || market.country,
        currency: market.currency,
        ...identity,
        metadata: {
          dashboard: "full",
          ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
          blockingRequirementsCount: String(requirements.blockingCount),
        },
      });
    }
  }

  const studioEmail = billingProfile?.billingEmail?.trim() || currentUser.email?.trim();
  if (!studioEmail) {
    throw new ConvexError("Studio email is required for Stripe onboarding");
  }
  const registeredName = billingProfile?.legalBusinessName?.trim();
  const displayName =
    studioSettings?.studioName?.trim() || registeredName || currentUser.name?.trim() || "Queue";
  const account = await createStripeRecipientAccountV2({
    country: billingProfile?.country?.trim()?.toUpperCase() || market.country,
    email: studioEmail,
    displayName,
    defaultCurrency: market.currency,
    entityType: billingProfile?.legalEntityType === "company" ? "company" : "individual",
    dashboard: "full",
    configurations: ["merchant"],
    responsibilities: {
      feesCollector: "stripe",
      lossesCollector: "stripe",
    },
    ...(registeredName ? { registeredName } : {}),
  });

  const identity = await buildStripeIdentitySync(account.id);
  const requirements = summarizeStripeRecipientRequirements(account);

  return await ctx.runMutation(internal.payments.core.upsertStudioConnectedAccountFromProviderV2, {
    provider: "stripe",
    providerAccountId: account.id,
    providerStatusRaw: summarizeStripeRecipientAccountStatus(account),
    country: market.country,
    currency: market.currency,
    ...identity,
    metadata: {
      dashboard: "full",
      ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
      blockingRequirementsCount: String(requirements.blockingCount),
    },
  });
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

export const createMyStudioDiditVerificationSessionV2 = action({
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
      callback: getDiditCallbackUrl(),
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
            ...(getStripeMarketDefaults().country
              ? { country: getStripeMarketDefaults().country }
              : {}),
          }
        : undefined;
    await ctx.runMutation(internal.payments.core.syncStudioDiditVerificationV2, {
      userId: currentUser._id,
      sessionId,
      statusRaw,
      ...parsed,
      billingBusinessName: studioSettings.studioName,
      ...(currentUser.email?.trim() ? { billingEmail: currentUser.email.trim() } : {}),
      ...(currentUser.phoneE164?.trim() ? { billingPhone: currentUser.phoneE164.trim() } : {}),
      ...(studioSettings.address?.trim() ? { billingAddress: studioSettings.address.trim() } : {}),
      ...(billingAddressStructured ? { billingAddressStructured } : {}),
      ...(getStripeMarketDefaults().country ? { country: getStripeMarketDefaults().country } : {}),
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

export const refreshMyStudioDiditVerificationV2 = action({
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

    await ctx.runMutation(internal.payments.core.syncStudioDiditVerificationV2, {
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

export const createStripePaymentSheetForPaymentOrderV2 = action({
  args: {
    paymentOrderId: v.id("paymentOrdersV2"),
  },
  returns: stripePaymentSheetSessionSummaryValidator,
  handler: async (ctx, args): Promise<StripePaymentSheetSessionSummary> => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "studio") {
      throw new ConvexError("Unauthorized");
    }
    const checkoutContext: Awaited<
      ReturnType<typeof ctx.runQuery<typeof api.payments.core.getPaymentCheckoutContextV2>>
    > = await ctx.runQuery(api.payments.core.getPaymentCheckoutContextV2, {
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

    await ctx.runMutation(internal.payments.core.recordStripePaymentIntentAttemptV2, {
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
