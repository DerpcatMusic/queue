import { registerRoutes as registerStripeRoutes } from "@convex-dev/stripe";
import { httpRouter } from "convex/server";
import type Stripe from "stripe";
import StripeSDK from "stripe";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { getStripeMarketDefaults } from "./integrations/stripe/config";
import {
  getStripeRepresentativeNameV2,
  retrieveStripeAccountV2,
  summarizeStripeRecipientAccountStatus,
  summarizeStripeRecipientRequirements,
} from "./integrations/stripe/connectV2";

const http = httpRouter();

function getStripeServer() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new StripeSDK(secretKey);
}

function getStripeConnectWebhookSecret() {
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured");
  }
  return webhookSecret;
}

function getDiditWebhookSecret() {
  const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("DIDIT_WEBHOOK_SECRET is not configured");
  }
  return webhookSecret;
}

function getWebCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new Error("Web Crypto is not available");
  }
  return webCrypto;
}

function normalizeHexSignature(signature: string) {
  return signature
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
}

async function hmacSha256Hex(secret: string, body: string) {
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

async function verifyDiditWebhookSignature(body: string, signature: string, timestamp: string) {
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

function mapStripePayoutStatus(
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

function getConnectedAccountIdForConnectEvent(event: Stripe.Event) {
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

async function syncStripeConnectedAccountFromWebhook(
  ctx: { runMutation: (...args: any[]) => Promise<any> },
  accountId: string,
) {
  const [account, representative] = await Promise.all([
    retrieveStripeAccountV2(accountId),
    getStripeRepresentativeNameV2(accountId),
  ]);
  const market = getStripeMarketDefaults();
  const requirements = summarizeStripeRecipientRequirements(account);
  await ctx.runMutation(internal.payments.core.syncStripeConnectedAccountWebhookV2, {
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

auth.addHttpRoutes(http);
http.route({
  path: "/stripe/connect-return",
  method: "GET",
  handler: httpAction(async () => new Response("Stripe connect return", { status: 200 })),
});
http.route({
  path: "/stripe/connect-refresh",
  method: "GET",
  handler: httpAction(async () => new Response("Stripe connect refresh", { status: 200 })),
});
http.route({
  path: "/didit/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature = req.headers.get("x-signature-v2");
    const timestamp = req.headers.get("x-timestamp");
    if (!signature || !timestamp) {
      return new Response("Missing signature headers", { status: 400 });
    }

    const body = await req.text();
    const signatureValid = await verifyDiditWebhookSignature(body, signature, timestamp);
    if (!signatureValid) {
      const fingerprint = Array.from(
        new Uint8Array(
          await getWebCrypto().subtle.digest("SHA-256", new TextEncoder().encode(body)),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      await ctx.runMutation(internal.security.webhookSecurity.recordInvalidSignatureAttempt, {
        provider: "didit",
        fingerprint,
      });
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const sessionId =
      (typeof payload.session_id === "string" && payload.session_id.trim()) ||
      (typeof payload.sessionId === "string" && payload.sessionId.trim());
    const statusRaw =
      (typeof payload.status === "string" && payload.status.trim()) || "not_started";
    const vendorData =
      typeof payload.vendor_data === "string"
        ? payload.vendor_data.trim()
        : typeof payload.vendorData === "string"
          ? payload.vendorData.trim()
          : undefined;
    const webhookType =
      typeof payload.webhook_type === "string"
        ? payload.webhook_type.trim()
        : typeof payload.webhookType === "string"
          ? payload.webhookType.trim()
          : undefined;
    const decision =
      payload.decision && typeof payload.decision === "object" ? payload.decision : undefined;
    const payloadHash = Array.from(
      new Uint8Array(await getWebCrypto().subtle.digest("SHA-256", new TextEncoder().encode(body))),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const providerEventId = `didit:${payloadHash}`;

    if (!sessionId) {
      return new Response("Missing session id", { status: 400 });
    }

    try {
      await ctx.runMutation(
        internal.payments.core.applyDiditStudioWebhookV2 as any,
        {
          providerEventId,
          sessionId,
          statusRaw,
          vendorData,
          webhookType,
          payload,
          payloadHash,
          signatureValid: true,
          ...(decision ? { decision } : {}),
        } as any,
      );
      await ctx.runMutation(internal.security.webhookSecurity.clearInvalidSignatureThrottle, {
        provider: "didit",
        fingerprint: payloadHash,
      });
    } catch (error) {
      console.error("❌ Error processing Didit webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});
registerStripeRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    "payment_intent.succeeded": async (ctx, event: Stripe.PaymentIntentSucceededEvent) => {
      const paymentIntent = event.data.object;
      const stripe = getStripeServer();
      const charge =
        typeof paymentIntent.latest_charge === "string"
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : null;
      await ctx.runMutation(internal.payments.core.applyStripePaymentIntentWebhookV2, {
        providerPaymentIntentId: paymentIntent.id,
        status: "succeeded",
        statusRaw: paymentIntent.status,
        ...(charge
          ? {
              metadata: {
                ...(charge.receipt_url ? { receipt_url: charge.receipt_url } : {}),
                ...(charge.receipt_number ? { receipt_number: charge.receipt_number } : {}),
                charge_id: charge.id,
              },
            }
          : {}),
      });
      const destinationAccountId =
        typeof paymentIntent.transfer_data?.destination === "string"
          ? paymentIntent.transfer_data.destination
          : paymentIntent.metadata.connected_account_id;
      if (destinationAccountId) {
        const fundSplitArgs: {
          providerPaymentIntentId: string;
          providerFundsSplitId?: string;
          destinationAccountId: string;
          settledAt: number;
        } = {
          providerPaymentIntentId: paymentIntent.id,
          destinationAccountId,
          settledAt: Date.now(),
          ...(typeof paymentIntent.latest_charge === "string"
            ? { providerFundsSplitId: paymentIntent.latest_charge }
            : {}),
        };
        const fundSplit = await ctx.runMutation(
          internal.payments.core.syncStripeDestinationChargeFundSplitV2,
          fundSplitArgs,
        );
        if (fundSplit?._id) {
          await ctx.runMutation(
            internal.payments.core.ensureStripePendingPayoutTransferForFundSplitV2,
            {
              fundSplitId: fundSplit._id,
            },
          );
        }
      }
    },
    "payment_intent.processing": async (ctx, event: Stripe.PaymentIntentProcessingEvent) => {
      const paymentIntent = event.data.object;
      await ctx.runMutation(internal.payments.core.applyStripePaymentIntentWebhookV2, {
        providerPaymentIntentId: paymentIntent.id,
        status: "processing",
        statusRaw: paymentIntent.status,
      });
    },
    "payment_intent.payment_failed": async (ctx, event: Stripe.PaymentIntentPaymentFailedEvent) => {
      const paymentIntent = event.data.object;
      const args: {
        providerPaymentIntentId: string;
        status: "failed";
        statusRaw: string;
        errorMessage?: string;
      } = {
        providerPaymentIntentId: paymentIntent.id,
        status: "failed",
        statusRaw: paymentIntent.status,
        ...(paymentIntent.last_payment_error?.message
          ? { errorMessage: paymentIntent.last_payment_error.message }
          : {}),
      };
      await ctx.runMutation(internal.payments.core.applyStripePaymentIntentWebhookV2, args);
    },
  },
});

http.route({
  path: "/stripe/connect-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature provided", { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = await getStripeServer().webhooks.constructEventAsync(
        body,
        signature,
        getStripeConnectWebhookSecret(),
      );
    } catch (error) {
      return new Response(
        `Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
        { status: 400 },
      );
    }

    try {
      switch (event.type) {
        case "account.updated":
        case "person.updated": {
          const accountId = getConnectedAccountIdForConnectEvent(event);
          if (accountId) {
            await syncStripeConnectedAccountFromWebhook(ctx, accountId);
          }
          break;
        }
        case "payout.created":
        case "payout.updated":
        case "payout.paid":
        case "payout.failed":
        case "payout.canceled": {
          const payout = event.data.object as Stripe.Payout;
          const accountId = getConnectedAccountIdForConnectEvent(event);
          if (accountId) {
            await ctx.runMutation(internal.payments.core.reconcileStripePayoutWebhookV2, {
              providerAccountId: accountId,
              providerPayoutId: payout.id,
              amountAgorot: payout.amount,
              currency: payout.currency.toUpperCase(),
              status: mapStripePayoutStatus(payout.status),
              ...(payout.status ? { statusRaw: payout.status } : {}),
              ...(payout.failure_message ? { failureReason: payout.failure_message } : {}),
              ...(payout.arrival_date ? { paidAt: payout.arrival_date * 1000 } : {}),
              metadata: {
                lastWebhookEventType: event.type,
                ...(payout.method ? { payoutMethod: payout.method } : {}),
              },
            });
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error("❌ Error processing Stripe Connect webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
