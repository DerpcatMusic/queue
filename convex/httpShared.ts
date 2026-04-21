import type Stripe from "stripe";
import StripeSDK from "stripe";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { getStripeMarketDefaults } from "./integrations/stripe/config";
import { ErrorCode } from "./lib/errors";
import {
  getStripeRepresentativeName,
  retrieveStripeAccount,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "./integrations/stripe/connect";

export function getStripeServer() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new ConvexError({
      code: ErrorCode.MISSING_CONFIGURATION,
      message: "STRIPE_SECRET_KEY is not configured",
    });
  }
  return new StripeSDK(secretKey);
}

export function getStripeConnectWebhookSecret() {
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new ConvexError({
      code: ErrorCode.MISSING_CONFIGURATION,
      message: "STRIPE_CONNECT_WEBHOOK_SECRET is not configured",
    });
  }
  return webhookSecret;
}

export function getDiditWebhookSecret() {
  const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new ConvexError({
      code: ErrorCode.MISSING_CONFIGURATION,
      message: "DIDIT_WEBHOOK_SECRET is not configured",
    });
  }
  return webhookSecret;
}

export function getWebCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new ConvexError({
      code: ErrorCode.INVALID_CONFIGURATION,
      message: "Web Crypto is not available",
    });
  }
  return webCrypto;
}

export function normalizeHexSignature(signature: string) {
  return signature
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
}

export async function hmacSha256Hex(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await getWebCrypto().subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await getWebCrypto().subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyDiditWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
) {
  const timestampSeconds = Number.parseInt(timestamp.trim(), 10);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > 300) {
    return false;
  }
  const expected = await hmacSha256Hex(getDiditWebhookSecret(), body);
  const received = normalizeHexSignature(signature);
  if (expected.length !== received.length) {
    return false;
  }
  return expected === received;
}

export function mapStripePayoutStatus(
  payoutStatus: string | null | undefined,
): "pending" | "processing" | "sent" | "paid" | "failed" | "cancelled" | "needs_attention" {
  switch (payoutStatus) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "cancelled";
    case "in_transit":
      return "sent";
    case "pending":
      return "processing";
    default:
      return "needs_attention";
  }
}

export function getConnectedAccountIdForConnectEvent(event: Stripe.Event) {
  if (typeof event.account === "string" && event.account.length > 0) {
    return event.account;
  }
  const object = event.data.object as { id?: string; account?: string; object?: string };
  if (typeof object.account === "string" && object.account.length > 0) {
    return object.account;
  }
  if (object.object === "account" && typeof object.id === "string" && object.id.length > 0) {
    return object.id;
  }
  return null;
}

export async function syncStripeConnectedAccountFromWebhook(
  ctx: { runMutation: (...args: any[]) => Promise<any> },
  accountId: string,
) {
  const [account, representative] = await Promise.all([
    retrieveStripeAccount(accountId),
    getStripeRepresentativeName(accountId),
  ]);
  const market = getStripeMarketDefaults();
  const requirements = summarizeStripeRecipientRequirements(account);
  await ctx.runMutation(internal.payments.core.syncStripeConnectedAccountWebhook, {
    providerAccountId: account.id,
    providerStatusRaw: summarizeStripeRecipientAccountStatus(account),
    country: account.identity?.country?.toUpperCase() || market.country,
    currency: market.currency,
    ...(representative?.legalName ? { legalName: representative.legalName } : {}),
    ...(representative?.firstName ? { legalFirstName: representative.firstName } : {}),
    ...(representative?.lastName ? { legalLastName: representative.lastName } : {}),
    metadata: {
      dashboard: "express",
      ...(requirements.summary ? { requirementsSummary: requirements.summary } : {}),
      blockingRequirementsCount: String(requirements.blockingCount),
      lastWebhookEventType: "account_sync",
    },
  });
}
