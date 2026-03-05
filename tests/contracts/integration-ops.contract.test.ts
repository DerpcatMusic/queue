import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import {
  listFailedIntegrationEvents,
  replayFailedIntegrationEvents,
  replayIntegrationEvent,
} from "../../convex/webhooks";
import {
  createMutationCtx,
  InMemoryConvexDb,
  type ScheduledCall,
} from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;
const ACCESS_TOKEN = "integration-ops-secret";

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

describe("integration event operator contracts", () => {
  it("requires the configured operator access token to list failures", async () => {
    const originalToken = process.env.INTEGRATION_EVENTS_ACCESS_TOKEN;
    process.env.INTEGRATION_EVENTS_ACCESS_TOKEN = ACCESS_TOKEN;
    try {
      const db = new InMemoryConvexDb();
      await db.insert("integrationEvents", {
        provider: "rapyd",
        route: "payment",
        providerEventId: "evt-1",
        signatureValid: true,
        payloadHash: "hash-1",
        payload: { secret: "should-not-leak" },
        processingState: "failed",
        processingError: "payment_not_found",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      await expect(
        (listFailedIntegrationEvents as any)._handler(
          { db },
          { accessToken: undefined, limit: 10 },
        ),
      ).rejects.toThrow("Unauthorized integration-events operation");

      const rows = await (listFailedIntegrationEvents as any)._handler(
        { db },
        { accessToken: ACCESS_TOKEN, limit: 10 },
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.providerEventId).toBe("evt-1");
      expect("payload" in rows[0]).toBe(false);
    } finally {
      process.env.INTEGRATION_EVENTS_ACCESS_TOKEN = originalToken;
    }
  });

  it("replays a failed integration event by resetting state and scheduling processing", async () => {
    const restore = freezeNow(FIXED_NOW);
    const originalToken = process.env.INTEGRATION_EVENTS_ACCESS_TOKEN;
    process.env.INTEGRATION_EVENTS_ACCESS_TOKEN = ACCESS_TOKEN;
    try {
      const db = new InMemoryConvexDb();
      const integrationEventId = (await db.insert("integrationEvents", {
        provider: "rapyd",
        route: "payment",
        providerEventId: "evt-retry-1",
        signatureValid: true,
        payloadHash: "hash-retry-1",
        payload: {},
        processingState: "failed",
        processingError: "payment_not_found",
        processedAt: FIXED_NOW - 10_000,
        createdAt: FIXED_NOW - 20_000,
        updatedAt: FIXED_NOW - 10_000,
      })) as Id<"integrationEvents">;
      const schedulerCalls: ScheduledCall[] = [];
      const ctx = createMutationCtx({ db, schedulerCalls });

      const result = await (replayIntegrationEvent as any)._handler(ctx, {
        integrationEventId,
        accessToken: ACCESS_TOKEN,
      });

      const row = await db.get(integrationEventId);
      expect(result.replayed).toBe(true);
      expect(row?.processingState).toBe("pending");
      expect(row?.processingError).toBeUndefined();
      expect(row?.processedAt).toBeUndefined();
      expect(schedulerCalls).toHaveLength(1);
      expect((schedulerCalls[0]?.args as { integrationEventId?: string } | undefined)?.integrationEventId)
        .toBe(integrationEventId);
    } finally {
      restore();
      process.env.INTEGRATION_EVENTS_ACCESS_TOKEN = originalToken;
    }
  });

  it("bulk replays only the selected failed events", async () => {
    const restore = freezeNow(FIXED_NOW);
    const originalToken = process.env.INTEGRATION_EVENTS_ACCESS_TOKEN;
    process.env.INTEGRATION_EVENTS_ACCESS_TOKEN = ACCESS_TOKEN;
    try {
      const db = new InMemoryConvexDb();
      const failedRapyd = (await db.insert("integrationEvents", {
        provider: "rapyd",
        route: "payment",
        providerEventId: "evt-bulk-1",
        signatureValid: true,
        payloadHash: "hash-bulk-1",
        payload: {},
        processingState: "failed",
        processingError: "payment_not_found",
        createdAt: FIXED_NOW - 3_000,
        updatedAt: FIXED_NOW - 3_000,
      })) as Id<"integrationEvents">;
      await db.insert("integrationEvents", {
        provider: "didit",
        route: "kyc",
        providerEventId: "evt-bulk-2",
        signatureValid: true,
        payloadHash: "hash-bulk-2",
        payload: {},
        processingState: "failed",
        processingError: "instructor_not_found",
        createdAt: FIXED_NOW - 2_000,
        updatedAt: FIXED_NOW - 2_000,
      });
      await db.insert("integrationEvents", {
        provider: "rapyd",
        route: "payment",
        providerEventId: "evt-bulk-3",
        signatureValid: true,
        payloadHash: "hash-bulk-3",
        payload: {},
        processingState: "processed",
        createdAt: FIXED_NOW - 1_000,
        updatedAt: FIXED_NOW - 1_000,
      });

      const schedulerCalls: ScheduledCall[] = [];
      const ctx = createMutationCtx({ db, schedulerCalls });
      const result = await (replayFailedIntegrationEvents as any)._handler(ctx, {
        accessToken: ACCESS_TOKEN,
        provider: "rapyd",
        route: "payment",
        limit: 10,
      });

      const failedRow = await db.get(failedRapyd);
      expect(result.replayedCount).toBe(1);
      expect(result.integrationEventIds).toEqual([failedRapyd]);
      expect(failedRow?.processingState).toBe("pending");
      expect(schedulerCalls).toHaveLength(1);
    } finally {
      restore();
      process.env.INTEGRATION_EVENTS_ACCESS_TOKEN = originalToken;
    }
  });
});
