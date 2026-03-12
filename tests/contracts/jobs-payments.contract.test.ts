import { describe, expect, it, mock } from "bun:test";
import type { PaymentStatus, PayoutStatus } from "../../src/lib/payments-utils";

mock.module("@/i18n", () => ({
  default: {
    t(key: string) {
      return (
        (
          {
            "jobsTab.checkout.paymentStatus.created": "Created",
            "jobsTab.checkout.paymentStatus.pending": "Pending",
            "jobsTab.checkout.paymentStatus.authorized": "Authorized",
            "jobsTab.checkout.paymentStatus.captured": "Captured",
            "jobsTab.checkout.paymentStatus.failed": "Failed",
            "jobsTab.checkout.paymentStatus.cancelled": "Cancelled",
            "jobsTab.checkout.paymentStatus.refunded": "Refunded",
            "jobsTab.checkout.payoutStatus.queued": "Queued",
            "jobsTab.checkout.payoutStatus.processing": "Processing",
            "jobsTab.checkout.payoutStatus.pendingProvider": "Pending provider",
            "jobsTab.checkout.payoutStatus.paid": "Paid out",
            "jobsTab.checkout.payoutStatus.failed": "Failed",
            "jobsTab.checkout.payoutStatus.cancelled": "Cancelled",
            "jobsTab.checkout.payoutStatus.needsAttention": "Needs attention",
            "profile.roles.unknown": "Unknown",
          } as const satisfies Record<string, string>
        )[key] ?? key
      );
    },
  },
}));

const {
  APPLICATION_STATUS_TRANSLATION_KEYS,
  JOB_STATUS_TRANSLATION_KEYS,
  getApplicationStatusTranslationKey,
  getJobStatusTone,
} = await import("../../src/lib/jobs-utils");

const {
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getPayoutStatusLabel,
  getPayoutStatusTone,
} = await import("../../src/lib/payments-utils");

const PAYMENT_LABEL_BY_STATUS = {
  created: "Created",
  pending: "Pending",
  authorized: "Authorized",
  captured: "Captured",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
} as const satisfies Record<PaymentStatus, string>;

const PAYMENT_TONE_BY_STATUS = {
  created: "primary",
  pending: "warning",
  authorized: "warning",
  captured: "success",
  failed: "danger",
  cancelled: "danger",
  refunded: "danger",
} as const satisfies Record<PaymentStatus, string>;

const PAYOUT_LABEL_BY_STATUS = {
  queued: "Queued",
  processing: "Processing",
  pending_provider: "Pending provider",
  paid: "Paid out",
  failed: "Failed",
  cancelled: "Cancelled",
  needs_attention: "Needs attention",
} as const satisfies Record<PayoutStatus, string>;

const PAYOUT_TONE_BY_STATUS = {
  queued: "warning",
  processing: "warning",
  pending_provider: "warning",
  paid: "success",
  failed: "danger",
  cancelled: "danger",
  needs_attention: "danger",
} as const satisfies Record<PayoutStatus, string>;

describe("jobs/payments contracts", () => {
  it("keeps application status translation key contract stable", () => {
    for (const [status, key] of Object.entries(
      APPLICATION_STATUS_TRANSLATION_KEYS,
    )) {
      expect(getApplicationStatusTranslationKey(status)).toBe(key);
    }
    expect(getApplicationStatusTranslationKey("not_a_status")).toBe(
      APPLICATION_STATUS_TRANSLATION_KEYS.pending,
    );
  });

  it("keeps job status tone contract stable", () => {
    expect(getJobStatusTone("open")).toBe("primary");
    expect(getJobStatusTone("filled")).toBe("success");
    expect(getJobStatusTone("completed")).toBe("success");
    expect(getJobStatusTone("cancelled")).toBe("muted");
    expect(Object.keys(JOB_STATUS_TRANSLATION_KEYS).sort()).toEqual([
      "cancelled",
      "completed",
      "filled",
      "open",
    ]);
  });

  it("keeps payment status label/tone mappings exhaustive and stable", () => {
    for (const [status, expectedLabel] of Object.entries(
      PAYMENT_LABEL_BY_STATUS,
    )) {
      expect(getPaymentStatusLabel(status as PaymentStatus)).toBe(
        expectedLabel,
      );
    }
    for (const [status, expectedTone] of Object.entries(
      PAYMENT_TONE_BY_STATUS,
    )) {
      expect(getPaymentStatusTone(status as PaymentStatus)).toBe(expectedTone);
    }
    expect(getPaymentStatusLabel("unmapped" as never)).toBe("Unknown");
    expect(getPaymentStatusTone("unmapped" as never)).toBe("muted");
  });

  it("keeps payout status label/tone mappings exhaustive and stable", () => {
    for (const [status, expectedLabel] of Object.entries(
      PAYOUT_LABEL_BY_STATUS,
    )) {
      expect(getPayoutStatusLabel(status as PayoutStatus)).toBe(expectedLabel);
    }
    for (const [status, expectedTone] of Object.entries(
      PAYOUT_TONE_BY_STATUS,
    )) {
      expect(getPayoutStatusTone(status as PayoutStatus)).toBe(expectedTone);
    }
    expect(getPayoutStatusLabel("unmapped" as never)).toBe("Unknown");
    expect(getPayoutStatusTone("unmapped" as never)).toBe("muted");
  });
});
