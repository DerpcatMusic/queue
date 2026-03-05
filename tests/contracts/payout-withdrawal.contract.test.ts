import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import { loadEligibleCapturedPaymentsForManualWithdrawal } from "../../convex/payments";
import { InMemoryConvexDb } from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

describe("payout withdrawal contracts", () => {
  it("finds old eligible captured payments beyond the newest 500 rows", async () => {
    const restore = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const instructorUserId = "users:1" as Id<"users">;
      const paymentIds: Id<"payments">[] = [];

      for (let index = 0; index < 501; index += 1) {
        const createdAt = FIXED_NOW - (501 - index) * 1_000;
        const paymentId = (await db.insert("payments", {
          provider: "rapyd",
          jobId: `jobs:${index + 1}`,
          studioId: "studioProfiles:1",
          studioUserId: "users:2",
          instructorUserId,
          status: "captured",
          currency: "ILS",
          instructorBaseAmountAgorot: 10_000 + index,
          platformMarkupAmountAgorot: 1_500,
          studioChargeAmountAgorot: 11_500 + index,
          platformMarkupBps: 1_500,
          idempotencyKey: `payment:${index + 1}`,
          createdAt,
          updatedAt: createdAt,
        })) as Id<"payments">;
        paymentIds.push(paymentId);
      }

      for (const paymentId of paymentIds.slice(1)) {
        await db.insert("payouts", {
          paymentId,
          jobId: "jobs:scheduled",
          studioId: "studioProfiles:1",
          studioUserId: "users:2",
          instructorId: "instructorProfiles:1",
          instructorUserId,
          provider: "rapyd",
          idempotencyKey: `payout:${paymentId}`,
          amountAgorot: 10_000,
          currency: "ILS",
          status: "paid",
          attemptCount: 1,
          maxAttempts: 3,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });
      }

      const eligible = await loadEligibleCapturedPaymentsForManualWithdrawal(
        { db } as any,
        {
          instructorUserId,
          maxPayments: 1,
        },
      );

      expect(eligible).toHaveLength(1);
      expect(eligible[0]?._id).toBe(paymentIds[0]);
    } finally {
      restore();
    }
  });
});
