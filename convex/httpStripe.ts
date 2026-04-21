import { registerRoutes as registerStripeComponentRoutes } from "@convex-dev/stripe";
import type Stripe from "stripe";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  getConnectedAccountIdForConnectEvent,
  getStripeConnectWebhookSecret,
  getStripeServer,
  mapStripePayoutStatus,
  syncStripeConnectedAccountFromWebhook,
} from "./httpShared";
import {
  validateWebhookSourceIp,
  sanitizeWebhookError,
  checkWebhookEventIdempotency,
  recordWebhookEventProcessing,
  markWebhookEventProcessed,
} from "./security/webhookSecurity";

/**
 * Extracts the event ID from a Stripe webhook event for idempotency tracking.
 */
function extractStripeEventId(event: Stripe.Event): string {
  return event.id;
}

// =============================================================================
// Development Mode IP Allowlist (Configure via environment variables)
// =============================================================================
// Set WEBHOOK_STRIPE_IPS to comma-separated IPs in production
// In development, unknown IPs trigger warnings but are allowed

export function registerStripeRoutes(http: { route: (...args: any[]) => void }) {
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

  registerStripeComponentRoutes(http, components.stripe, {
    webhookPath: "/stripe/webhook",
    events: {
      "payment_intent.succeeded": async (ctx, event: Stripe.PaymentIntentSucceededEvent) => {
        const paymentIntent = event.data.object;
        const stripe = getStripeServer();
        const charge =
          typeof paymentIntent.latest_charge === "string"
            ? await stripe.charges.retrieve(paymentIntent.latest_charge)
            : null;
        await ctx.runMutation(internal.payments.core.applyStripePaymentIntentWebhook, {
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
            internal.payments.core.syncStripeDestinationChargeFundSplit,
            fundSplitArgs,
          );
          if (fundSplit?._id) {
            await ctx.runMutation(
              internal.payments.core.ensureStripePendingPayoutTransferForFundSplit,
              {
                fundSplitId: fundSplit._id,
              },
            );
          }
        }
      },
      "payment_intent.processing": async (ctx, event: Stripe.PaymentIntentProcessingEvent) => {
        const paymentIntent = event.data.object;
        await ctx.runMutation(internal.payments.core.applyStripePaymentIntentWebhook, {
          providerPaymentIntentId: paymentIntent.id,
          status: "processing",
          statusRaw: paymentIntent.status,
        });
      },
      "payment_intent.payment_failed": async (
        ctx,
        event: Stripe.PaymentIntentPaymentFailedEvent,
      ) => {
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
        await ctx.runMutation(internal.payments.core.applyStripePaymentIntentWebhook, args);
      },
    },
  });

  http.route({
    path: "/stripe/connect-webhook",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      // ----------------------------------------------------------------
      // 1. Extract source IP for validation
      // ----------------------------------------------------------------
      const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("cf-connecting-ip")?.trim()
        ?? null;

      // ----------------------------------------------------------------
      // 2. Validate source IP (dev mode: log warning, production: block)
      // ----------------------------------------------------------------
      const ipValidation = await validateWebhookSourceIp(sourceIp, "stripe");
      if (ipValidation.shouldLog) {
        console.warn(
          `[StripeWebhook] Source IP validation: ip=${sourceIp ?? "unknown"}, provider=stripe`,
        );
      }
      if (!ipValidation.valid) {
        return new Response("Access denied", { status: 403 });
      }

      // ----------------------------------------------------------------
      // 3. Validate Stripe signature
      // ----------------------------------------------------------------
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response("Missing signature header", { status: 400 });
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
        // SECURE: Don't leak detailed error messages to client
        console.error(
          `[StripeWebhook] Signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return new Response("Signature verification failed", { status: 401 });
      }

      // ----------------------------------------------------------------
      // 4. Check for replay attacks using event idempotency
      // ----------------------------------------------------------------
      const eventId = extractStripeEventId(event);
      const idempotencyCheck = await ctx.runQuery(
        internal.security.webhookSecurity.checkWebhookEventIdempotency,
        {
          provider: "stripe",
          eventId,
        },
      );

      if (idempotencyCheck.isDuplicate) {
        console.info(
          `[StripeWebhook] Duplicate event rejected: type=${event.type}, id=${eventId}`,
        );
        // Return 200 to prevent Stripe from retrying
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Record that we're processing this event
      await ctx.runMutation(internal.security.webhookSecurity.recordWebhookEventProcessing, {
        provider: "stripe",
        eventId,
      });

      // ----------------------------------------------------------------
      // 5. Process the webhook event
      // ----------------------------------------------------------------
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
              await ctx.runMutation(internal.payments.core.reconcileStripePayoutWebhook, {
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

        // Mark event as successfully processed
        await ctx.runMutation(internal.security.webhookSecurity.markWebhookEventProcessed, {
          provider: "stripe",
          eventId,
          success: true,
        });
      } catch (error) {
        // Mark event as failed with error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        await ctx.runMutation(internal.security.webhookSecurity.markWebhookEventProcessed, {
          provider: "stripe",
          eventId,
          success: false,
          errorMessage,
        });

        // Use sanitized error response to prevent information leakage
        const sanitized = sanitizeWebhookError(error);
        console.error(
          `[StripeWebhook] Processing failed: type=${event.type}, error=${errorMessage}`,
        );
        return new Response(sanitized.message, { status: sanitized.statusCode });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}