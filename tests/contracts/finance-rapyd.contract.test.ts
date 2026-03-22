import { describe, expect, it } from "bun:test";

import { processRapydBeneficiaryWebhookEvent, resolveRapydBeneficiaryWebhookState } from "../../convex/payments";
import {
  getPaymentByProviderRefsRead,
  getPaymentIdFromMerchantReferenceId,
} from "../../convex/paymentsRead";
import type { Id } from "../../convex/_generated/dataModel";
import { InMemoryConvexDb } from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

describe("finance rapyd contracts", () => {
  it("resolves payment ids from merchant reference ids", () => {
    expect(getPaymentIdFromMerchantReferenceId(undefined)).toBeUndefined();
    expect(getPaymentIdFromMerchantReferenceId("   ")).toBeUndefined();
    expect(getPaymentIdFromMerchantReferenceId("payments:123")).toBe("payments:123" as Id<"payments">);
  });

  it("resolves a payment by provider link instead of raw merchant reference casting", async () => {
    const db = new InMemoryConvexDb();
    const paymentOrderId = (await db.insert("paymentOrders", {
      provider: "rapyd",
      correlationToken: "payord:users:1:abc",
      jobId: "jobs:1",
      studioId: "studioProfiles:1",
      studioUserId: "users:1",
      status: "payment_pending",
      currency: "ILS",
      instructorGrossAmountAgorot: 10000,
      platformFeeAmountAgorot: 1500,
      studioChargeAmountAgorot: 11500,
      platformFeeBps: 1500,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"paymentOrders">;
    const paymentId = (await db.insert("payments", {
      paymentOrderId,
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
    await db.insert("paymentProviderLinks", {
      provider: "rapyd",
      paymentOrderId,
      legacyPaymentId: paymentId,
      providerObjectType: "merchant_reference",
      providerObjectId: "payord:users:1:abc",
      correlationToken: "payord:users:1:abc",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });

    const payment = await getPaymentByProviderRefsRead(
      { db } as any,
      { merchantReferenceId: "payord:users:1:abc" },
    );

    expect(payment?._id).toBe(paymentId);
  });

  it("keeps beneficiary onboarding pending until the webhook indicates success", async () => {
    const restore = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const userId = "users:1" as Id<"users">;
      await db.insert("payoutDestinationOnboarding", {
        userId,
        provider: "rapyd",
        merchantReferenceId: "beneficiary:users:1:abc",
        status: "pending",
        category: "bank",
        beneficiaryCountry: "IL",
        beneficiaryEntityType: "individual",
        payoutCurrency: "ILS",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      const result = await (processRapydBeneficiaryWebhookEvent as any)._handler(
        { db },
        {
          providerEventId: "evt-pending",
          eventType: "beneficiary.updated",
          merchantReferenceId: "beneficiary:users:1:abc",
          beneficiaryId: "beneficiary-1",
          payoutMethodType: "il_bank",
          statusRaw: "PENDING",
          signatureValid: true,
          payloadHash: "hash-1",
          payload: { data: { status: "PENDING" } },
        },
      );

      const session = db.list("payoutDestinationOnboarding")[0];
      expect(result.processed).toBe(false);
      expect(session?.status).toBe("pending");
      expect(db.list("payoutDestinations")).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it("marks beneficiary onboarding complete only on explicit success", async () => {
    const restore = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const userId = "users:1" as Id<"users">;
      await db.insert("payoutDestinationOnboarding", {
        userId,
        provider: "rapyd",
        merchantReferenceId: "beneficiary:users:1:done",
        status: "pending",
        category: "bank",
        beneficiaryCountry: "IL",
        beneficiaryEntityType: "individual",
        payoutCurrency: "ILS",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      const result = await (processRapydBeneficiaryWebhookEvent as any)._handler(
        { db },
        {
          providerEventId: "evt-success",
          eventType: "beneficiary.completed",
          merchantReferenceId: "beneficiary:users:1:done",
          beneficiaryId: "beneficiary-2",
          payoutMethodType: "il_bank",
          statusRaw: "SUCCESS",
          signatureValid: true,
          payloadHash: "hash-2",
          payload: { data: { status: "SUCCESS" } },
        },
      );

      const session = db.list("payoutDestinationOnboarding")[0];
      const destination = db.list("payoutDestinations")[0];
      expect(result.processed).toBe(true);
      expect(session?.status).toBe("completed");
      expect(destination?.status).toBe("verified");
    } finally {
      restore();
    }
  });

  it("classifies beneficiary webhook states conservatively", () => {
    expect(resolveRapydBeneficiaryWebhookState({ statusRaw: "SUCCESS" })).toBe("verified");
    expect(resolveRapydBeneficiaryWebhookState({ statusRaw: "FAILED" })).toBe("failed");
    expect(resolveRapydBeneficiaryWebhookState({ statusRaw: "EXPIRED" })).toBe("expired");
    expect(resolveRapydBeneficiaryWebhookState({ statusRaw: "PENDING" })).toBe("pending");
  });

  it("defaults to il_general_bank when webhook omits payoutMethodType", async () => {
    const restore = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const userId = "users:1" as Id<"users">;
      await db.insert("payoutDestinationOnboarding", {
        userId,
        provider: "rapyd",
        merchantReferenceId: "beneficiary:users:1:default_test",
        status: "pending",
        category: "bank",
        beneficiaryCountry: "IL",
        beneficiaryEntityType: "individual",
        payoutCurrency: "ILS",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      // Explicitly omit payoutMethodType to test default
      const result = await (processRapydBeneficiaryWebhookEvent as any)._handler(
        { db },
        {
          providerEventId: "evt-default",
          eventType: "beneficiary.completed",
          merchantReferenceId: "beneficiary:users:1:default_test",
          beneficiaryId: "beneficiary-default",
          payoutMethodType: undefined, // omitted
          statusRaw: "SUCCESS",
          signatureValid: true,
          payloadHash: "hash-default",
          payload: { data: { status: "SUCCESS" } },
        },
      );

      const session = db.list("payoutDestinationOnboarding")[0];
      const destination = db.list("payoutDestinations")[0];
      expect(result.processed).toBe(true);
      expect(session?.status).toBe("completed");
      expect(destination?.status).toBe("verified");
      // The key assertion: payoutMethodType should default to il_general_bank, NOT il_bank
      expect(destination?.type).toBe("il_general_bank");
    } finally {
      restore();
    }
  });

  it("respects explicit payoutMethodType from webhook over default", async () => {
    const restore = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const userId = "users:1" as Id<"users">;
      await db.insert("payoutDestinationOnboarding", {
        userId,
        provider: "rapyd",
        merchantReferenceId: "beneficiary:users:1:explicit_test",
        status: "pending",
        category: "bank",
        beneficiaryCountry: "IL",
        beneficiaryEntityType: "company",
        payoutCurrency: "ILS",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      // Explicitly pass a different payout method type
      const result = await (processRapydBeneficiaryWebhookEvent as any)._handler(
        { db },
        {
          providerEventId: "evt-explicit",
          eventType: "beneficiary.completed",
          merchantReferenceId: "beneficiary:users:1:explicit_test",
          beneficiaryId: "beneficiary-explicit",
          payoutMethodType: "il_general_bank", // explicit override
          statusRaw: "SUCCESS",
          signatureValid: true,
          payloadHash: "hash-explicit",
          payload: { data: { status: "SUCCESS" } },
        },
      );

      const session = db.list("payoutDestinationOnboarding")[0];
      const destination = db.list("payoutDestinations")[0];
      expect(result.processed).toBe(true);
      expect(session?.status).toBe("completed");
      expect(destination?.status).toBe("verified");
      // Explicit payoutMethodType should be preserved as-is
      expect(destination?.type).toBe("il_general_bank");
    } finally {
      restore();
    }
  });
});
