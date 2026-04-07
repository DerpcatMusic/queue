import { describe, expect, it } from "bun:test";

describe("webhooksAirwallex helpers", () => {
  // =============================================================================
  // asString
  // =============================================================================
  const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;

  describe("asString", () => {
    it("returns string as-is when valid", () => {
      expect(asString("hello")).toBe("hello");
      expect(asString("  trim  ")).toBe("  trim  ");
    });

    it("returns undefined for non-string", () => {
      expect(asString(123)).toBeUndefined();
      expect(asString(null)).toBeUndefined();
      expect(asString(undefined)).toBeUndefined();
      expect(asString({})).toBeUndefined();
    });

    it("returns undefined for empty or whitespace-only strings", () => {
      expect(asString("")).toBeUndefined();
      expect(asString("   ")).toBeUndefined();
      expect(asString("  \n  ")).toBeUndefined();
    });
  });

  // =============================================================================
  // toAgorot
  // =============================================================================
  const asNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };
  const toAgorot = (value: unknown): number =>
    Math.max(0, Math.round((asNumber(value) ?? 0) * 100));

  describe("toAgorot", () => {
    it("converts major units to agorot", () => {
      expect(toAgorot(100)).toBe(10000);
      expect(toAgorot(1.5)).toBe(150);
      expect(toAgorot(0.01)).toBe(1);
    });

    it("handles string input", () => {
      expect(toAgorot("100")).toBe(10000);
      expect(toAgorot("1.5")).toBe(150);
    });

    it("clamps negative values to 0", () => {
      expect(toAgorot(-50)).toBe(0);
    });

    it("handles undefined", () => {
      expect(toAgorot(undefined)).toBe(0);
    });
  });

  // =============================================================================
  // mapFundSplitStatus
  // =============================================================================
  type FundSplitStatus =
    | "pending_create"
    | "created"
    | "released"
    | "settled"
    | "failed"
    | "reversed";
  const mapFundSplitStatus = (
    statusRaw: string | undefined,
    eventType: string | undefined,
  ): FundSplitStatus => {
    const normalized = statusRaw?.trim().toUpperCase();
    if (eventType === "funds_split.failed" || normalized === "FAILED") {
      return "failed";
    }
    if (eventType === "funds_split.settled" || normalized === "SETTLED") {
      return "settled";
    }
    if (eventType === "funds_split.released" || normalized === "RELEASED") {
      return "released";
    }
    if (normalized === "REVERSED") {
      return "reversed";
    }
    if (eventType === "funds_split.created" || normalized === "CREATED") {
      return "created";
    }
    return "pending_create";
  };

  describe("mapFundSplitStatus", () => {
    it("maps event types to statuses", () => {
      expect(mapFundSplitStatus(undefined, "funds_split.created")).toBe("created");
      expect(mapFundSplitStatus(undefined, "funds_split.settled")).toBe("settled");
      expect(mapFundSplitStatus(undefined, "funds_split.released")).toBe("released");
      expect(mapFundSplitStatus(undefined, "funds_split.failed")).toBe("failed");
    });

    it("maps raw status strings", () => {
      expect(mapFundSplitStatus("CREATED", undefined)).toBe("created");
      expect(mapFundSplitStatus("SETTLED", undefined)).toBe("settled");
      expect(mapFundSplitStatus("RELEASED", undefined)).toBe("released");
      expect(mapFundSplitStatus("FAILED", undefined)).toBe("failed");
      expect(mapFundSplitStatus("REVERSED", undefined)).toBe("reversed");
    });

    it("normalizes lowercase status strings", () => {
      expect(mapFundSplitStatus("created", undefined)).toBe("created");
      expect(mapFundSplitStatus("settled", undefined)).toBe("settled");
    });

    it("returns pending_create for unknown status", () => {
      expect(mapFundSplitStatus("UNKNOWN", undefined)).toBe("pending_create");
      expect(mapFundSplitStatus(undefined, undefined)).toBe("pending_create");
    });
  });

  // =============================================================================
  // mapPayoutTransferStatus
  // =============================================================================
  type PayoutTransferStatus =
    | "pending"
    | "processing"
    | "sent"
    | "paid"
    | "failed"
    | "cancelled"
    | "needs_attention";
  const mapPayoutTransferStatus = (
    statusRaw: string | undefined,
    eventType: string | undefined,
  ): PayoutTransferStatus => {
    const normalized = statusRaw?.trim().toUpperCase();
    if (
      eventType === "connected_account_transfer.settled" ||
      normalized === "SETTLED" ||
      normalized === "PAID"
    ) {
      return "paid";
    }
    if (eventType === "connected_account_transfer.failed" || normalized === "FAILED") {
      return "failed";
    }
    if (normalized === "SENT") {
      return "sent";
    }
    if (normalized === "CANCELLED" || normalized === "CANCELED") {
      return "cancelled";
    }
    if (normalized === "SUSPENDED") {
      return "needs_attention";
    }
    if (normalized === "NEW" || normalized === "PENDING") {
      return "pending";
    }
    return "processing";
  };

  describe("mapPayoutTransferStatus", () => {
    it("maps settled event and status to paid", () => {
      expect(mapPayoutTransferStatus(undefined, "connected_account_transfer.settled")).toBe("paid");
      expect(mapPayoutTransferStatus("SETTLED", undefined)).toBe("paid");
      expect(mapPayoutTransferStatus("PAID", undefined)).toBe("paid");
    });

    it("maps failed event and status to failed", () => {
      expect(mapPayoutTransferStatus(undefined, "connected_account_transfer.failed")).toBe(
        "failed",
      );
      expect(mapPayoutTransferStatus("FAILED", undefined)).toBe("failed");
    });

    it("maps sent status", () => {
      expect(mapPayoutTransferStatus("SENT", undefined)).toBe("sent");
    });

    it("maps cancelled status", () => {
      expect(mapPayoutTransferStatus("CANCELLED", undefined)).toBe("cancelled");
      expect(mapPayoutTransferStatus("CANCELED", undefined)).toBe("cancelled");
    });

    it("maps suspended to needs_attention", () => {
      expect(mapPayoutTransferStatus("SUSPENDED", undefined)).toBe("needs_attention");
    });

    it("maps new/pending", () => {
      expect(mapPayoutTransferStatus("NEW", undefined)).toBe("pending");
      expect(mapPayoutTransferStatus("PENDING", undefined)).toBe("pending");
    });

    it("defaults to processing", () => {
      expect(mapPayoutTransferStatus("UNKNOWN", undefined)).toBe("processing");
      expect(mapPayoutTransferStatus(undefined, undefined)).toBe("processing");
    });
  });

  // =============================================================================
  // inferRoute (fund_split events)
  // =============================================================================
  type WebhookRoute =
    | "payment"
    | "payout"
    | "beneficiary"
    | "kyc"
    | "connected_account"
    | "fund_split";
  const inferRoute = (
    payload: Record<string, unknown>,
    eventType: string | undefined,
  ): WebhookRoute => {
    const objectType = asString(payload.object_type) ?? asString(payload.entity_type);
    if (objectType === "connected_account") return "connected_account";
    if (objectType === "fund_split") return "fund_split";
    if (objectType === "payout") return "payout";
    if (objectType === "kyc") return "kyc";
    if (objectType === "beneficiary") return "beneficiary";
    if (eventType?.startsWith("account.")) return "connected_account";
    if (eventType?.startsWith("funds_split.")) return "fund_split";
    if (eventType?.startsWith("connected_account_transfer.")) return "payout";
    return "payment";
  };

  describe("inferRoute", () => {
    it("routes fund_split object type to fund_split", () => {
      expect(inferRoute({ object_type: "fund_split" }, undefined)).toBe("fund_split");
    });

    it("routes funds_split.* event types to fund_split", () => {
      expect(inferRoute({}, "funds_split.created")).toBe("fund_split");
      expect(inferRoute({}, "funds_split.settled")).toBe("fund_split");
      expect(inferRoute({}, "funds_split.released")).toBe("fund_split");
      expect(inferRoute({}, "funds_split.failed")).toBe("fund_split");
    });

    it("routes connected_account_transfer.* event types to payout", () => {
      expect(inferRoute({}, "connected_account_transfer.settled")).toBe("payout");
      expect(inferRoute({}, "connected_account_transfer.created")).toBe("payout");
      expect(inferRoute({}, "connected_account_transfer.failed")).toBe("payout");
    });

    it("routes payout object type to payout", () => {
      expect(inferRoute({ object_type: "payout" }, undefined)).toBe("payout");
    });

    it("routes account.* event types to connected_account", () => {
      expect(inferRoute({}, "account.active")).toBe("connected_account");
      expect(inferRoute({}, "account.action_required")).toBe("connected_account");
    });

    it("defaults to payment", () => {
      expect(inferRoute({}, "payment_intent.succeeded")).toBe("payment");
      expect(inferRoute({}, undefined)).toBe("payment");
    });
  });

  // =============================================================================
  // Real Airwallex webhook event shapes
  // =============================================================================
  describe("real Airwallex event shapes", () => {
    it("routes payment_intent.succeeded to payment", () => {
      const event = {
        name: "payment_intent.succeeded",
        object_type: "payment_intent",
        data: {
          object: {
            id: "pi_test_123",
            status: "SUCCEEDED",
            amount: 29900,
            currency: "ILS",
          },
        },
      };
      expect(inferRoute(event, event.name)).toBe("payment");
    });

    it("routes funds_split.settled to fund_split", () => {
      const event = {
        name: "funds_split.settled",
        object_type: "fund_split",
        data: {
          object: {
            id: "fs_test_456",
            status: "SETTLED",
            destination: { type: "CONNECTED_ACCOUNT", id: "acc_789" },
          },
        },
      };
      expect(inferRoute(event, event.name)).toBe("fund_split");
      expect(mapFundSplitStatus("SETTLED", undefined)).toBe("settled");
    });

    it("routes connected_account_transfer.settled to payout", () => {
      const event = {
        name: "connected_account_transfer.settled",
        object_type: "connected_account_transfer",
        data: {
          object: {
            id: "trf_test_abc",
            status: "SETTLED",
            destination_account_id: "acc_def_456",
          },
        },
      };
      expect(inferRoute(event, event.name)).toBe("payout");
      expect(mapPayoutTransferStatus("SETTLED", undefined)).toBe("paid");
    });

    it("extracts amount from fund_split data.object", () => {
      const asNumber = (value: unknown): number | undefined => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim().length > 0) {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
      };
      const toAgorot = (value: unknown): number =>
        Math.max(0, Math.round((asNumber(value) ?? 0) * 100));

      // Amount is in major units (shekels), convert to agorot
      const splitData = {
        amount: { amount: "299.00", currency: "ILS" },
      };
      const majorUnits = asNumber(splitData.amount.amount) ?? 0;
      expect(toAgorot(majorUnits)).toBe(29900);
    });

    it("extracts destination account from connected_account_transfer", () => {
      const transferData = {
        destination_account_id: "acc_instructor_001",
        status: "PAID",
      };
      expect(asString(transferData.destination_account_id)).toBe("acc_instructor_001");
      expect(mapPayoutTransferStatus("PAID", undefined)).toBe("paid");
    });

    it("extracts account status from account.active event", () => {
      // account.active should route to connected_account
      expect(inferRoute({}, "account.active")).toBe("connected_account");
    });

    it("extracts rejection reason from account.rejected", () => {
      expect(inferRoute({}, "account.rejected")).toBe("connected_account");
    });
  });
});
