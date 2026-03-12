import { describe, expect, it } from "bun:test";

import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  finalizeChargeFromWebhook,
  processRapydWebhookEvent,
} from "../../convex/payments";
import { getPaymentByProviderRefsRead } from "../../convex/paymentsRead";
import {
  ingestIntegrationEvent,
  processIntegrationEvent,
  rapydWebhook,
} from "../../convex/webhooks";
import {
  createMutationCtx,
  InMemoryConvexDb,
  type ScheduledCall,
} from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

describe("integration event contracts", () => {
  it("ingests provider events once and schedules asynchronous processing", async () => {
    const db = new InMemoryConvexDb();
    const schedulerCalls: ScheduledCall[] = [];
    const ctx = createMutationCtx({ db, schedulerCalls });

    const args = {
      provider: "didit" as const,
      route: "kyc" as const,
      providerEventId: "didit-event-1",
      signatureValid: true,
      payloadHash: "payload-hash-1",
      payload: { event_id: "didit-event-1" },
      metadata: { sessionId: "sess-1" },
    };

    const first = await (ingestIntegrationEvent as any)._handler(ctx, args);
    const second = await (ingestIntegrationEvent as any)._handler(ctx, args);

    const rows = db.list("integrationEvents");
    expect(first.duplicate).toBe(false);
    expect(first.queued).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.queued).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.processingState).toBe("pending");
    expect(schedulerCalls).toHaveLength(1);
    expect(
      (schedulerCalls[0]?.args as { integrationEventId?: string } | undefined)
        ?.integrationEventId,
    ).toBe(first.integrationEventId);
  });

  it("processes queued Rapyd payment events through the canonical integration log", async () => {
    const restore = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const paymentId = (await db.insert("payments", {
        provider: "rapyd",
        jobId: "jobs:1",
        studioId: "studioProfiles:1",
        studioUserId: "users:1",
        status: "pending",
        currency: "ILS",
        instructorBaseAmountAgorot: 10000,
        platformMarkupAmountAgorot: 1500,
        studioChargeAmountAgorot: 11500,
        platformMarkupBps: 1500,
        idempotencyKey: "payment:1",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })) as Id<"payments">;

      const integrationEventId = (await db.insert("integrationEvents", {
        provider: "rapyd",
        route: "payment",
        providerEventId: "rapyd-event-1",
        eventType: "PAYMENT_COMPLETED",
        signatureValid: true,
        payloadHash: "payload-hash-2",
        payload: {
          id: "rapyd-event-1",
          data: {
            status: "CLO",
            merchant_reference_id: String(paymentId),
          },
        },
        metadata: {
          merchantReferenceId: String(paymentId),
          statusRaw: "CLO",
        },
        processingState: "pending",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })) as Id<"integrationEvents">;

      const schedulerCalls: ScheduledCall[] = [];
      const result = await (processIntegrationEvent as any)._handler(
        {
          db,
          scheduler: {
            runAfter: async (delayMs: number, fn: unknown, args: unknown) => {
              schedulerCalls.push({ delayMs, fn, args });
            },
          },
          runMutation: async (_fn: unknown, mutationArgs: unknown) =>
            await (finalizeChargeFromWebhook as any)._handler(
              {
                db,
                runMutation: async (_innerFn: unknown, innerArgs: unknown) =>
                  await (processRapydWebhookEvent as any)._handler(
                    {
                      db,
                      scheduler: {
                        runAfter: async (
                          delayMs: number,
                          scheduledFn: unknown,
                          scheduledArgs: unknown,
                        ) => {
                          schedulerCalls.push({
                            delayMs,
                            fn: scheduledFn,
                            args: scheduledArgs,
                          });
                        },
                      },
                      runMutation: async () => undefined,
                      runQuery: async (_queryFn: unknown, queryArgs: unknown) =>
                        await getPaymentByProviderRefsRead(
                          { db } as any,
                          queryArgs as any,
                        ),
                    },
                    innerArgs,
                  ),
              },
              mutationArgs,
            ),
        },
        { integrationEventId },
      );

      const payment = await db.get(paymentId);
      const integrationEvent = await db.get(integrationEventId);
      const paymentEvents = db.list("paymentEvents");

      expect(result.processed).toBe(true);
      expect(payment?.status).toBe("captured");
      expect(paymentEvents).toHaveLength(1);
      expect(paymentEvents[0]?.paymentId).toBe(paymentId);
      expect(integrationEvent?.processingState).toBe("processed");
      expect(integrationEvent?.sourceEventId).toBe(paymentEvents[0]?._id);
      expect(integrationEvent?.entityId).toBe(paymentId);
      expect(schedulerCalls).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it("enqueues Rapyd webhook payloads into the integration log instead of mutating payments directly", async () => {
    const runMutationCalls: Array<{ fn: unknown; args: unknown }> = [];
    const ctx = {
      runMutation: async (fn: unknown, args: unknown) => {
        runMutationCalls.push({ fn, args });
        if (fn === internal.webhookSecurity.checkInvalidSignatureThrottle) {
          return { blocked: false };
        }
        if (fn === internal.webhookSecurity.recordInvalidSignatureAttempt) {
          return { blocked: false };
        }
        return { queued: true, duplicate: false };
      },
    };

    const response = await (rapydWebhook as any)._handler(
      ctx,
      new Request("https://example.test/webhooks/rapyd", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          salt: "salt-1",
          timestamp: String(Math.floor(FIXED_NOW / 1000)),
          signature: "invalid",
          access_key: "invalid",
        },
        body: JSON.stringify({
          id: "rapyd-event-2",
          type: "PAYMENT_COMPLETED",
          data: {
            id: "payment-provider-1",
            status: "CLO",
            checkout: { id: "checkout-1" },
            metadata: { paymentId: "payments:123" },
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(runMutationCalls).toHaveLength(4);
    const enqueueCall = runMutationCalls[3] as {
      args: Record<string, unknown>;
    };
    expect(enqueueCall.args.provider).toBe("rapyd");
    expect(enqueueCall.args.route).toBe("payment");
    expect(enqueueCall.args.providerEventId).toBe("rapyd-event-2");
    expect(enqueueCall.args.payload).toEqual({
      id: "rapyd-event-2",
      type: "PAYMENT_COMPLETED",
      data: {
        id: "payment-provider-1",
        status: "CLO",
        checkout: { id: "checkout-1" },
        metadata: { paymentId: "payments:123" },
      },
    });
    expect(enqueueCall.args.metadata).toEqual({
      providerPaymentId: "payment-provider-1",
      providerCheckoutId: "checkout-1",
      merchantReferenceId: "payments:123",
      statusRaw: "CLO",
    });
  });
});
