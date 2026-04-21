"use node";

import { StripeSubscriptions } from "@convex-dev/stripe";
import { ConvexError, v } from "convex/values";
import StripeSDK from "stripe";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getStripeMarketDefaults } from "../integrations/stripe/config";
import {
  createStripeAccountLink,
  createStripeAccountSession,
  createStripeRecipientAccount,
  getStripeRepresentativeName,
  retrieveStripeAccount,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "../integrations/stripe/connect";
import { diditVerificationStatusValidator } from "../lib/instructorCompliance";

export const stripeCustomers = new StripeSubscriptions(components.stripe, {});

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

export const connectedAccountOnboardingSummaryValidator = v.object({
  _id: v.id("connectedAccounts"),
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

export type ConnectedAccountOnboardingSummary = {
  _id: Id<"connectedAccounts">;
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

export type StripePaymentSheetSessionSummary = {
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

export type StripeCustomerSheetSessionSummary = {
  provider: "stripe";
  customerId: string;
  customerSessionClientSecret: string;
  setupIntentClientSecret: string;
};

export const studioStripePaymentProfileSyncSummaryValidator = v.object({
  provider: v.literal("stripe"),
  status: v.union(
    v.literal("missing"),
    v.literal("pending"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  customerId: v.string(),
  savedPaymentMethodCount: v.number(),
  defaultPaymentMethodType: v.optional(v.string()),
  supportedPaymentMethodTypes: v.array(v.string()),
});

export type StudioStripePaymentProfileSyncSummary = {
  provider: "stripe";
  status: "missing" | "pending" | "ready" | "failed";
  customerId: string;
  savedPaymentMethodCount: number;
  defaultPaymentMethodType?: string;
  supportedPaymentMethodTypes: string[];
};

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

export const mapStripePaymentIntentStatusToPaymentOrderStatus = (
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

export async function buildStripeIdentitySync(accountId: string) {
  const representative = await getStripeRepresentativeName(accountId);
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

export function getDiditBaseUrl() {
  return (process.env.DIDIT_BASE_URL?.trim() || DIDIT_BASE_URL).trim();
}

export function getDiditApiKey() {
  return (process.env.DIDIT_API_KEY ?? "").trim();
}

export function getDiditWorkflowId() {
  return (process.env.DIDIT_WORKFLOW_ID ?? "").trim();
}

export function getDiditCallbackUrl() {
  return (
    process.env.DIDIT_CALLBACK_URL?.trim() || "https://join-queue.com/studio/profile/compliance"
  ).trim();
}

export function getDiditVerificationUrl(sessionToken: string) {
  return `${DIDIT_VERIFICATION_HOST}/session/${encodeURIComponent(sessionToken)}`.trim();
}

export function normalizeDiditStatus(raw: string | undefined) {
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

export function getDiditString(source: Record<string, unknown> | undefined, keys: string[]) {
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

export function splitDiditName(fullName: string | undefined) {
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

export function extractDiditDecisionDetails(decision: unknown) {
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

export async function postDiditSession(payload: Record<string, unknown>) {
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

export async function getDiditSessionDetails(sessionId: string) {
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

export async function ensureInstructorStripeConnectedAccount(
  ctx: any,
): Promise<ConnectedAccountOnboardingSummary> {
  const market = getStripeMarketDefaults();
  const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
  if (!currentUser || currentUser.role !== "instructor") {
    throw new ConvexError("Unauthorized");
  }

  const existing: ConnectedAccountOnboardingSummary | null = await ctx.runQuery(
    api.payments.core.getMyInstructorConnectedAccount,
    {},
  );

  if (existing?.provider === "stripe") {
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
  }

  const email = currentUser.email?.trim();
  if (!email) {
    throw new ConvexError("Instructor email is required for Stripe onboarding");
  }

  const displayName = currentUser.name?.trim() || email;
  const account = await createStripeRecipientAccount({
    email,
    displayName,
    country: market.country,
    defaultCurrency: market.currency,
  });
  const identity = await buildStripeIdentitySync(account.id);
  const requirements = summarizeStripeRecipientRequirements(account);

  return await ctx.runMutation(
    internal.payments.core.upsertInstructorConnectedAccountFromProvider,
    {
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
    },
  );
}

export async function ensureStudioStripeConnectedAccount(
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
    api.payments.core.getMyStudioConnectedAccount,
    {},
  );

  if (existing?.provider === "stripe") {
    const remote = await retrieveStripeAccount(existing.providerAccountId);
    const hasSupportedStudioConfig =
      remote.dashboard === "full" && remote.configuration?.merchant?.applied === true;

    if (hasSupportedStudioConfig) {
      const identity = await buildStripeIdentitySync(remote.id);
      const requirements = summarizeStripeRecipientRequirements(remote);
      return await ctx.runMutation(
        internal.payments.core.upsertStudioConnectedAccountFromProvider,
        {
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
        },
      );
    }
  }

  const studioEmail = billingProfile?.billingEmail?.trim() || currentUser.email?.trim();
  if (!studioEmail) {
    throw new ConvexError("Studio email is required for Stripe onboarding");
  }
  const registeredName = billingProfile?.legalBusinessName?.trim();
  const displayName =
    studioSettings?.studioName?.trim() || registeredName || currentUser.name?.trim() || "Queue";
  const account = await createStripeRecipientAccount({
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

  return await ctx.runMutation(internal.payments.core.upsertStudioConnectedAccountFromProvider, {
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

export {
  createStripeAccountLink,
  createStripeAccountSession,
  retrieveStripeAccount,
  StripeSDK,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
};
