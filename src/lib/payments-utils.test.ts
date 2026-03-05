import { describe, expect, it } from "bun:test";

import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getPayoutStatusLabel,
  getPayoutStatusTone,
} from "./payments-utils";

describe("payments-utils", () => {
  it("formats agorot currency", () => {
    const formatted = formatAgorotCurrency(12345, "en-US", "ILS");
    expect(formatted).toContain("123.45");
    expect(formatAgorotCurrency(0, "en-US", "USD")).toContain("0.00");
    expect(formatAgorotCurrency(-105, "en-US", "USD")).toContain("1.05");
  });

  it("maps payment statuses to labels and tones", () => {
    expect(getPaymentStatusLabel("created")).toBe("Created");
    expect(getPaymentStatusTone("created")).toBe("primary");
    expect(getPaymentStatusLabel("pending")).toBe("Pending");
    expect(getPaymentStatusTone("pending")).toBe("warning");
    expect(getPaymentStatusLabel("authorized")).toBe("Authorized");
    expect(getPaymentStatusTone("authorized")).toBe("warning");
    expect(getPaymentStatusLabel("captured")).toBe("Captured");
    expect(getPaymentStatusTone("captured")).toBe("success");
    expect(getPaymentStatusLabel("failed")).toBe("Failed");
    expect(getPaymentStatusTone("failed")).toBe("danger");
    expect(getPaymentStatusLabel("cancelled")).toBe("Cancelled");
    expect(getPaymentStatusTone("cancelled")).toBe("danger");
    expect(getPaymentStatusLabel("refunded")).toBe("Refunded");
    expect(getPaymentStatusTone("refunded")).toBe("danger");
  });

  it("maps payout statuses to labels and tones", () => {
    expect(getPayoutStatusLabel("queued")).toBe("Queued");
    expect(getPayoutStatusTone("queued")).toBe("warning");
    expect(getPayoutStatusLabel("processing")).toBe("Processing");
    expect(getPayoutStatusTone("processing")).toBe("warning");
    expect(getPayoutStatusLabel("pending_provider")).toBe("Pending provider");
    expect(getPayoutStatusTone("pending_provider")).toBe("warning");
    expect(getPayoutStatusLabel("paid")).toBe("Paid out");
    expect(getPayoutStatusTone("paid")).toBe("success");
    expect(getPayoutStatusLabel("failed")).toBe("Failed");
    expect(getPayoutStatusTone("failed")).toBe("danger");
    expect(getPayoutStatusLabel("cancelled")).toBe("Cancelled");
    expect(getPayoutStatusTone("cancelled")).toBe("danger");
    expect(getPayoutStatusLabel("needs_attention")).toBe("Needs attention");
    expect(getPayoutStatusTone("needs_attention")).toBe("danger");
  });

  it("falls back safely for unknown payment and payout statuses", () => {
    expect(getPaymentStatusLabel("unknown" as never)).toBe("Unknown");
    expect(getPaymentStatusTone("unknown" as never)).toBe("muted");
    expect(getPayoutStatusLabel("unknown" as never)).toBe("Unknown");
    expect(getPayoutStatusTone("unknown" as never)).toBe("muted");
  });
});
