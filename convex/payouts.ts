import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { executeRapydSignedPost } from "./integrations/rapyd/client";
import {
  getOptionalEnv,
  normalizeIsoCountryCode,
  normalizeRapydExternalRecipientId,
  normalizeRapydPayoutMethodType,
  resolveRapydBaseUrl,
} from "./integrations/rapyd/config";
import {
  buildPayoutCorrelationToken,
  normalizePayoutPreferenceMode,
  summarizeLedgerBalances,
} from "./lib/marketplace";
import { omitUndefined } from "./lib/validation";
import { isInstructorKycApproved } from "./paymentsRead";

const RAPYD_PROVIDER = "rapyd" as const;

type PayoutStatus =
  | "queued"
  | "processing"
  | "pending_provider"
  | "paid"
  | "failed"
  | "cancelled"
  | "needs_attention";

const TERMINAL_PAYOUT_STATUSES = new Set<PayoutStatus>([
  "paid",
  "failed",
  "cancelled",
  "needs_attention",
]);

const DEFAULT_MAX_ATTEMPTS = 6;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 30 * 60 * 1000;

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(value)));

const computeRetryDelayMs = (attempt: number): number => {
  const backoff = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** (attempt - 1));
  const jitter = Math.min(5_000, attempt * 250);
  return backoff + jitter;
};

const isRetryableHttpFailure = (statusCode: number): boolean =>
  statusCode === 429 || statusCode >= 500;

const isLikelyPermanentRapydError = (errorCode: string | undefined): boolean => {
  const code = (errorCode ?? "").toUpperCase();
  return (
    code.includes("INVALID") ||
    code.includes("NOT_FOUND") ||
    code.includes("UNAUTHORIZED") ||
    code.includes("PERMISSION") ||
    code.includes("INSUFFICIENT_FUNDS")
  );
};

export const normalizeRapydPayoutStatus = (
  rawStatus: string | undefined,
): { status: PayoutStatus; terminal: boolean } => {
  const status = (rawStatus ?? "").toUpperCase().trim();
  if (status === "CLO" || status === "PAID" || status === "COMPLETED" || status === "SUCCESS") {
    return { status: "paid", terminal: true };
  }
  if (status === "CAN" || status === "CANCELLED" || status === "CANCELED") {
    return { status: "cancelled", terminal: true };
  }
  if (
    status === "ERR" ||
    status === "ERROR" ||
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "DECLINED" ||
    status === "REV" ||
    status === "REVERSED" ||
    status === "EXPIRED"
  ) {
    return { status: "failed", terminal: true };
  }
  return { status: "pending_provider", terminal: false };
};

export const computeNextPayoutWebhookStatus = (
  currentStatus: PayoutStatus,
  webhookStatus: PayoutStatus,
): PayoutStatus => {
  if (TERMINAL_PAYOUT_STATUSES.has(currentStatus)) return currentStatus;
  if (webhookStatus === "queued" || webhookStatus === "processing") {
    return "pending_provider";
  }
  return webhookStatus;
};

async function insertLedgerEntryIfMissing(
  ctx: MutationCtx,
  args: {
    paymentOrderId: Id<"paymentOrders">;
    jobId: Id<"jobs">;
    studioUserId: Id<"users">;
    instructorUserId: Id<"users"> | undefined;
    payoutScheduleId: Id<"payoutSchedules"> | undefined;
    payoutId: Id<"payouts"> | undefined;
    dedupeKey: string;
    entryType: Doc<"ledgerEntries">["entryType"];
    balanceBucket: Doc<"ledgerEntries">["balanceBucket"];
    amountAgorot: number;
    currency: string;
    referenceType: Doc<"ledgerEntries">["referenceType"];
    referenceId: string;
    createdAt: number;
  },
) {
  const existing = await ctx.db
    .query("ledgerEntries")
    .withIndex("by_dedupe_key", (q: any) => q.eq("dedupeKey", args.dedupeKey))
    .unique();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert(
    "ledgerEntries",
    omitUndefined({
      paymentOrderId: args.paymentOrderId,
      jobId: args.jobId,
      studioUserId: args.studioUserId,
      instructorUserId: args.instructorUserId,
      payoutScheduleId: args.payoutScheduleId,
      payoutId: args.payoutId,
      dedupeKey: args.dedupeKey,
      entryType: args.entryType,
      balanceBucket: args.balanceBucket,
      amountAgorot: args.amountAgorot,
      currency: args.currency,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      createdAt: args.createdAt,
    }) as any,
  );
}

async function readLatestPayoutRule(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"payoutReleaseRules"> | null> {
  return (
    (await ctx.db
      .query("payoutReleaseRules")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .unique()) ?? null
  );
}

async function readOrCreateScheduleForOrder(
  ctx: MutationCtx,
  args: {
    paymentOrder: Doc<"paymentOrders">;
    sourcePaymentId?: Id<"payments">;
  },
) {
  const existing = await ctx.db
    .query("payoutSchedules")
    .withIndex("by_payment_order", (q: any) => q.eq("paymentOrderId", args.paymentOrder._id))
    .order("desc")
    .first();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const scheduleId = await ctx.db.insert(
    "payoutSchedules",
    omitUndefined({
      paymentOrderId: args.paymentOrder._id,
      sourcePaymentId: args.sourcePaymentId,
      jobId: args.paymentOrder.jobId,
      studioId: args.paymentOrder.studioId,
      studioUserId: args.paymentOrder.studioUserId,
      instructorId: args.paymentOrder.instructorId as Id<"instructorProfiles">,
      instructorUserId: args.paymentOrder.instructorUserId as Id<"users">,
      status: "pending_eligibility" as const,
      amountAgorot: args.paymentOrder.instructorGrossAmountAgorot,
      currency: args.paymentOrder.currency,
      createdAt: now,
      updatedAt: now,
    }) as any,
  );
  return await ctx.db.get(scheduleId);
}

async function reserveScheduleFunds(
  ctx: MutationCtx,
  args: {
    schedule: Doc<"payoutSchedules">;
    paymentOrder: Doc<"paymentOrders">;
    payoutId: Id<"payouts">;
  },
) {
  const now = Date.now();
  await insertLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.schedule.instructorUserId,
    payoutScheduleId: args.schedule._id,
    payoutId: args.payoutId,
    dedupeKey: `reserve:${args.schedule._id}:available`,
    entryType: "payout_reserved",
    balanceBucket: "instructor_available",
    amountAgorot: -args.schedule.amountAgorot,
    currency: args.schedule.currency,
    referenceType: "payout_schedule",
    referenceId: String(args.schedule._id),
    createdAt: now,
  });
  await insertLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.schedule.instructorUserId,
    payoutScheduleId: args.schedule._id,
    payoutId: args.payoutId,
    dedupeKey: `reserve:${args.schedule._id}:reserved`,
    entryType: "payout_reserved",
    balanceBucket: "instructor_reserved",
    amountAgorot: args.schedule.amountAgorot,
    currency: args.schedule.currency,
    referenceType: "payout_schedule",
    referenceId: String(args.schedule._id),
    createdAt: now,
  });
}

export const evaluatePayoutEligibility = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      return { evaluatedCount: 0, releasedCount: 0, reason: "job_missing" as const };
    }

    const paymentOrders = await ctx.db
      .query("paymentOrders")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .order("desc")
      .collect();
    let releasedCount = 0;

    for (const paymentOrder of paymentOrders) {
      if (
        paymentOrder.status !== "captured" ||
        !paymentOrder.instructorId ||
        !paymentOrder.instructorUserId
      ) {
        continue;
      }

      const sourcePayment = await ctx.db
        .query("payments")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", paymentOrder._id))
        .order("desc")
        .first();
      const scheduleArgs: {
        paymentOrder: Doc<"paymentOrders">;
        sourcePaymentId?: Id<"payments">;
      } = { paymentOrder };
      if (sourcePayment?._id) {
        scheduleArgs.sourcePaymentId = sourcePayment._id;
      }
      const schedule = await readOrCreateScheduleForOrder(ctx, scheduleArgs);
      if (!schedule) continue;

      if (job.status !== "completed") {
        await ctx.db.patch(schedule._id, {
          status: "blocked",
          failureReason: "Job is not completed yet",
          updatedAt: Date.now(),
        });
        continue;
      }

      const kycApproved = await isInstructorKycApproved(ctx, paymentOrder.instructorUserId);
      if (!kycApproved) {
        await ctx.db.patch(schedule._id, {
          status: "blocked",
          failureReason: "Instructor identity verification is required",
          updatedAt: Date.now(),
        });
        continue;
      }

      const release = await ctx.runMutation(internal.payouts.releaseInstructorFunds, {
        jobId,
        paymentOrderId: paymentOrder._id,
      });
      if (release.released) {
        releasedCount += 1;
      }
    }

    return {
      evaluatedCount: paymentOrders.length,
      releasedCount,
      reason: releasedCount > 0 ? "released" : ("no_eligible_orders" as const),
    };
  },
});

export const releaseInstructorFunds = internalMutation({
  args: {
    jobId: v.id("jobs"),
    paymentOrderId: v.optional(v.id("paymentOrders")),
  },
  handler: async (ctx, { jobId, paymentOrderId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "completed") {
      return { released: false, reason: "job_not_completed" as const };
    }

    const paymentOrders = paymentOrderId
      ? [await ctx.db.get(paymentOrderId)].filter((value): value is Doc<"paymentOrders"> => Boolean(value))
      : await ctx.db
          .query("paymentOrders")
          .withIndex("by_job", (q) => q.eq("jobId", jobId))
          .order("desc")
          .collect();

    let releasedCount = 0;
    for (const paymentOrder of paymentOrders) {
      if (
        paymentOrder.status !== "captured" ||
        !paymentOrder.instructorId ||
        !paymentOrder.instructorUserId
      ) {
        continue;
      }

      const kycApproved = await isInstructorKycApproved(ctx, paymentOrder.instructorUserId);
      if (!kycApproved) {
        continue;
      }

      const sourcePayment = await ctx.db
        .query("payments")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", paymentOrder._id))
        .order("desc")
        .first();
      const scheduleArgs: {
        paymentOrder: Doc<"paymentOrders">;
        sourcePaymentId?: Id<"payments">;
      } = { paymentOrder };
      if (sourcePayment?._id) {
        scheduleArgs.sourcePaymentId = sourcePayment._id;
      }
      const schedule = await readOrCreateScheduleForOrder(ctx, scheduleArgs);
      if (!schedule) continue;

      const ledgerEntries = await ctx.db
        .query("ledgerEntries")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", paymentOrder._id))
        .collect();
      const balances = summarizeLedgerBalances(ledgerEntries);
      if (balances.instructor_available > 0 || paymentOrder.releasedAt) {
        if (schedule.status === "pending_eligibility" || schedule.status === "blocked") {
          await ctx.db.patch(schedule._id, {
            status: "available",
            failureReason: undefined,
            updatedAt: Date.now(),
          });
        }
        continue;
      }
      if (balances.instructor_held <= 0) {
        continue;
      }

      const now = Date.now();
      await insertLedgerEntryIfMissing(ctx, {
        paymentOrderId: paymentOrder._id,
        jobId: paymentOrder.jobId,
        studioUserId: paymentOrder.studioUserId,
        instructorUserId: paymentOrder.instructorUserId,
        payoutScheduleId: schedule._id,
        payoutId: undefined,
        dedupeKey: `release:${paymentOrder._id}:held`,
        entryType: "adjustment",
        balanceBucket: "instructor_held",
        amountAgorot: -paymentOrder.instructorGrossAmountAgorot,
        currency: paymentOrder.currency,
        referenceType: "job_completion",
        referenceId: String(jobId),
        createdAt: now,
      });
      await insertLedgerEntryIfMissing(ctx, {
        paymentOrderId: paymentOrder._id,
        jobId: paymentOrder.jobId,
        studioUserId: paymentOrder.studioUserId,
        instructorUserId: paymentOrder.instructorUserId,
        payoutScheduleId: schedule._id,
        payoutId: undefined,
        dedupeKey: `release:${paymentOrder._id}:available`,
        entryType: "adjustment",
        balanceBucket: "instructor_available",
        amountAgorot: paymentOrder.instructorGrossAmountAgorot,
        currency: paymentOrder.currency,
        referenceType: "job_completion",
        referenceId: String(jobId),
        createdAt: now,
      });
      await ctx.db.patch(paymentOrder._id, {
        releasedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(schedule._id, {
        status: "available",
        failureReason: undefined,
        updatedAt: now,
      });
      releasedCount += 1;

      const rule = await readLatestPayoutRule(ctx, paymentOrder.instructorUserId);
      const preferenceMode = normalizePayoutPreferenceMode(rule?.preferenceMode);
      if (preferenceMode !== "manual_hold") {
        const scheduleArgs: {
          paymentOrderId: Id<"paymentOrders">;
          instructorUserId: Id<"users">;
          payoutPreference: "immediate_when_eligible" | "scheduled_date" | "manual_hold";
          scheduledDate?: number;
        } = {
          paymentOrderId: paymentOrder._id,
          instructorUserId: paymentOrder.instructorUserId,
          payoutPreference: preferenceMode,
        };
        if (rule?.scheduledDate) {
          scheduleArgs.scheduledDate = rule.scheduledDate;
        }
        await ctx.runMutation(internal.payouts.scheduleInstructorPayout, scheduleArgs);
      }
    }

    return {
      released: releasedCount > 0,
      releasedCount,
    };
  },
});

export const scheduleInstructorPayout = internalMutation({
  args: {
    paymentOrderId: v.optional(v.id("paymentOrders")),
    instructorUserId: v.id("users"),
    payoutPreference: v.optional(
      v.union(
        v.literal("immediate_when_eligible"),
        v.literal("scheduled_date"),
        v.literal("manual_hold"),
      ),
    ),
    scheduledDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const schedules = args.paymentOrderId
      ? (
          await ctx.db
            .query("payoutSchedules")
            .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", args.paymentOrderId!))
            .order("desc")
            .take(10)
        ).filter((schedule) => schedule.instructorUserId === args.instructorUserId)
      : await ctx.db
          .query("payoutSchedules")
          .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", args.instructorUserId))
          .order("desc")
          .take(100);

    const preferenceMode = normalizePayoutPreferenceMode(args.payoutPreference);
    let scheduledCount = 0;
    const scheduledIds: Id<"payoutSchedules">[] = [];

    for (const schedule of schedules) {
      if (!["available", "blocked", "pending_eligibility"].includes(schedule.status)) {
        continue;
      }
      if (schedule.status !== "available") {
        continue;
      }

      const now = Date.now();
      const readyAt =
        preferenceMode === "scheduled_date" && args.scheduledDate && args.scheduledDate > now
          ? args.scheduledDate
          : now;
      const nextStatus = preferenceMode === "manual_hold" ? "available" : "scheduled";

      await ctx.db.patch(schedule._id, {
        status: nextStatus,
        releaseAfter: preferenceMode === "scheduled_date" ? readyAt : undefined,
        readyAt,
        updatedAt: now,
      });
      if (nextStatus === "scheduled") {
        scheduledCount += 1;
        scheduledIds.push(schedule._id);
        await ctx.scheduler.runAfter(Math.max(0, readyAt - now), internal.payouts.executeScheduledPayout, {
          scheduleId: schedule._id,
        });
      }
    }

    return {
      scheduledCount,
      payoutScheduleIds: scheduledIds,
      payoutPreference: preferenceMode,
    };
  },
});

export const executeScheduledPayout = internalMutation({
  args: {
    scheduleId: v.id("payoutSchedules"),
  },
  handler: async (ctx, { scheduleId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) {
      return { started: false, reason: "schedule_missing" as const };
    }
    if (!["scheduled", "processing"].includes(schedule.status)) {
      return { started: false, reason: "schedule_not_ready" as const };
    }
    if (schedule.readyAt && schedule.readyAt > Date.now()) {
      await ctx.scheduler.runAfter(
        schedule.readyAt - Date.now(),
        internal.payouts.executeScheduledPayout,
        { scheduleId },
      );
      return { started: false, reason: "schedule_not_due" as const };
    }

    const paymentOrder = await ctx.db.get(schedule.paymentOrderId);
    if (!paymentOrder) {
      await ctx.db.patch(scheduleId, {
        status: "needs_attention",
        failureReason: "Payment order missing for payout schedule",
        updatedAt: Date.now(),
      });
      return { started: false, reason: "payment_order_missing" as const };
    }

    const destination =
      (schedule.destinationId ? await ctx.db.get(schedule.destinationId) : null) ??
      (await ctx.db
        .query("payoutDestinations")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", schedule.instructorUserId).eq("isDefault", true),
        )
        .order("desc")
        .first()) ??
      null;
    if (!destination || destination.status !== "verified") {
      await ctx.db.patch(scheduleId, {
        status: "needs_attention",
        failureReason: "Verified payout destination missing",
        updatedAt: Date.now(),
      });
      return { started: false, reason: "missing_destination" as const };
    }
    if (!schedule.sourcePaymentId) {
      await ctx.db.patch(scheduleId, {
        status: "needs_attention",
        failureReason: "Legacy payment reference missing for payout schedule",
        updatedAt: Date.now(),
      });
      return { started: false, reason: "source_payment_missing" as const };
    }

    const existingPayout =
      schedule.payoutId ? await ctx.db.get(schedule.payoutId) : null;
    const payout =
      existingPayout ??
      (schedule.sourcePaymentId
        ? await ctx.db
            .query("payouts")
            .withIndex("by_schedule", (q) => q.eq("payoutScheduleId", scheduleId))
            .order("desc")
            .first()
        : null);

    let payoutId = payout?._id;
    if (!payoutId) {
      const now = Date.now();
      payoutId = await ctx.db.insert("payouts", {
        paymentOrderId: paymentOrder._id,
        payoutScheduleId: scheduleId,
        paymentId: schedule.sourcePaymentId,
        jobId: schedule.jobId,
        studioId: schedule.studioId,
        studioUserId: schedule.studioUserId,
        instructorId: schedule.instructorId,
        instructorUserId: schedule.instructorUserId,
        destinationId: destination._id,
        provider: RAPYD_PROVIDER,
        idempotencyKey: `payout:${scheduleId}`,
        amountAgorot: schedule.amountAgorot,
        currency: schedule.currency,
        status: "queued",
        attemptCount: 0,
        maxAttempts: clampInt(
          Number.parseInt(process.env.PAYOUT_MAX_ATTEMPTS ?? "", 10) || DEFAULT_MAX_ATTEMPTS,
          1,
          20,
        ),
        createdAt: now,
        updatedAt: now,
      });
      await reserveScheduleFunds(ctx, {
        schedule,
        paymentOrder,
        payoutId,
      });
      await ctx.db.patch(scheduleId, {
        payoutId,
        destinationId: destination._id,
        status: "processing",
        updatedAt: now,
      });
      await ctx.db.insert("payoutProviderLinks", {
        provider: RAPYD_PROVIDER,
        payoutScheduleId: scheduleId,
        payoutId,
        merchantReferenceId: buildPayoutCorrelationToken(String(schedule.instructorUserId)),
        correlationToken: String(scheduleId),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(scheduleId, {
        status: "processing",
        destinationId: destination._id,
        updatedAt: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.payouts.runPayoutAttempt, {
      payoutId,
    });
    return { started: true, payoutId };
  },
});

export const schedulePayoutForCapturedPayment = internalMutation({
  args: {
    paymentId: v.id("payments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { paymentId, reason }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) return { scheduled: false, reason: "payment_missing" as const };
    if (payment.status !== "captured") {
      return { scheduled: false, reason: "payment_not_captured" as const };
    }
    if (!payment.instructorId || !payment.instructorUserId) {
      return { scheduled: false, reason: "missing_instructor" as const };
    }

    const idempotencyKey = `payout:${payment._id}`;
    const existing = await ctx.db
      .query("payouts")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existing) {
      return {
        scheduled: false,
        reason: "already_exists" as const,
        payoutId: existing._id,
      };
    }

    const now = Date.now();
    const configuredMaxAttempts = clampInt(
      Number.parseInt(process.env.PAYOUT_MAX_ATTEMPTS ?? "", 10) || DEFAULT_MAX_ATTEMPTS,
      1,
      20,
    );

    const payoutId = await ctx.db.insert("payouts", {
      paymentId: payment._id,
      jobId: payment.jobId,
      studioId: payment.studioId,
      studioUserId: payment.studioUserId,
      instructorId: payment.instructorId,
      instructorUserId: payment.instructorUserId,
      provider: payment.provider,
      idempotencyKey,
      amountAgorot: payment.instructorBaseAmountAgorot,
      currency: payment.currency,
      status: "queued",
      attemptCount: 0,
      maxAttempts: configuredMaxAttempts,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("payoutEvents", {
      payoutId,
      paymentId: payment._id,
      provider: payment.provider,
      eventType: "status_update",
      attempt: 0,
      mappedStatus: "queued",
      message: reason ?? "scheduled_from_payment_capture",
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.payouts.runPayoutAttempt, {
      payoutId,
    });

    return { scheduled: true, payoutId };
  },
});

export const runPayoutAttempt = internalMutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout) return { started: false, reason: "missing" as const };
    if (TERMINAL_PAYOUT_STATUSES.has(payout.status)) {
      return { started: false, reason: "terminal" as const };
    }
    if (payout.status === "processing") {
      return { started: false, reason: "already_processing" as const };
    }

    const now = Date.now();
    if (payout.nextRetryAt && payout.nextRetryAt > now) {
      await ctx.scheduler.runAfter(payout.nextRetryAt - now, internal.payouts.runPayoutAttempt, {
        payoutId,
      });
      return { started: false, reason: "not_due" as const };
    }

    const payment = await ctx.db.get(payout.paymentId);
    if (!payment) {
      await ctx.db.patch(payoutId, {
        status: "needs_attention",
        lastError: "Missing source payment",
        terminalAt: now,
        updatedAt: now,
      });
      return { started: false, reason: "payment_missing" as const };
    }

    if (payment.status !== "captured") {
      const cancelled = ["cancelled", "failed", "refunded"].includes(payment.status);
      const nextStatus: PayoutStatus = cancelled ? "cancelled" : "needs_attention";
      await ctx.db.patch(payoutId, {
        status: nextStatus,
        lastError: `Payment status is ${payment.status}; payout halted`,
        terminalAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("payoutEvents", {
        payoutId,
        paymentId: payout.paymentId,
        provider: payout.provider,
        eventType: "terminal_failure",
        attempt: payout.attemptCount,
        statusRaw: payment.status,
        mappedStatus: nextStatus,
        message: "Payment left captured state",
        createdAt: now,
      });
      return { started: false, reason: "payment_not_captured" as const };
    }

    const attempt = payout.attemptCount + 1;
    await ctx.db.patch(payoutId, {
      status: "processing",
      attemptCount: attempt,
      lastAttemptAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("payoutEvents", {
      payoutId,
      paymentId: payout.paymentId,
      provider: payout.provider,
      eventType: "attempt_started",
      attempt,
      mappedStatus: "processing",
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.payouts.executePayoutAttemptAction, {
      payoutId,
      attempt,
    });

    return { started: true, attempt };
  },
});

export const getPayoutExecutionContext = internalQuery({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout) return null;

    const payment = await ctx.db.get(payout.paymentId);
    if (!payment) return null;

    const explicitDestination = payout.destinationId ? await ctx.db.get(payout.destinationId) : null;
    const defaultDestinations = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", payout.instructorUserId).eq("isDefault", true),
      )
      .order("desc")
      .take(10);
    const verifiedDefaultDestination =
      defaultDestinations.find((destination) => destination.status === "verified") ?? null;

    const userDestinations = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user", (q) => q.eq("userId", payout.instructorUserId))
      .order("desc")
      .take(50);
    const verifiedDestination =
      userDestinations.find((destination) => destination.status === "verified") ?? null;
    const destination =
      explicitDestination?.status === "verified"
        ? explicitDestination
        : verifiedDefaultDestination ?? verifiedDestination;
    const providerLink = await ctx.db
      .query("payoutProviderLinks")
      .withIndex("by_payout", (q) => q.eq("payoutId", payout._id))
      .order("desc")
      .first();

    return {
      payout,
      payment,
      destination: destination ?? null,
      providerLink: providerLink ?? null,
    };
  },
});

export const getPayoutByProviderRefs = internalQuery({
  args: {
    providerPayoutId: v.optional(v.string()),
    merchantReferenceId: v.optional(v.string()),
  },
  handler: async (ctx, { providerPayoutId, merchantReferenceId }) => {
    if (providerPayoutId) {
      const direct = await ctx.db
        .query("payouts")
        .withIndex("by_provider_payoutId", (q) =>
          q.eq("provider", RAPYD_PROVIDER).eq("providerPayoutId", providerPayoutId),
        )
        .unique();
      if (direct) return direct;
      const linked = await ctx.db
        .query("payoutProviderLinks")
        .withIndex("by_provider_payout", (q) =>
          q.eq("provider", RAPYD_PROVIDER).eq("providerPayoutId", providerPayoutId),
        )
        .unique();
      if (linked?.payoutId) {
        return await ctx.db.get(linked.payoutId);
      }
    }
    if (merchantReferenceId) {
      const linked = await ctx.db
        .query("payoutProviderLinks")
        .withIndex("by_merchant_reference", (q) =>
          q.eq("provider", RAPYD_PROVIDER).eq("merchantReferenceId", merchantReferenceId),
        )
        .unique();
      if (linked?.payoutId) {
        return await ctx.db.get(linked.payoutId);
      }
    }
    return null;
  },
});

export const executePayoutAttemptAction = internalAction({
  args: {
    payoutId: v.id("payouts"),
    attempt: v.number(),
  },
  handler: async (ctx, { payoutId, attempt }) => {
    const context = await ctx.runQuery(internal.payouts.getPayoutExecutionContext, {
      payoutId,
    });
    if (!context) return;

    const { payout, payment, destination, providerLink } = context;
    if (payout.status !== "processing" || payout.attemptCount !== attempt) return;

    if (payment.status !== "captured") {
      await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
        payoutId,
        attempt,
        mappedStatus: "cancelled",
        retryable: false,
        message: `Payment status changed to ${payment.status}`,
      });
      return;
    }

    if (!destination) {
      await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
        payoutId,
        attempt,
        mappedStatus: "queued",
        retryable: true,
        errorCode: "missing_destination",
        message: "Instructor verified payout destination is not configured",
      });
      return;
    }

    const accessKey = getOptionalEnv("RAPYD_ACCESS_KEY") ?? "";
    const secretKey = getOptionalEnv("RAPYD_SECRET_KEY") ?? "";
    const ewalletId = getOptionalEnv("RAPYD_EWALLET") ?? "";
    let payoutMethodType = "";
    let beneficiaryId = "";
    let rapydBaseUrl = "";
    let beneficiaryCountry = "";
    let senderCountry = "";
    try {
      payoutMethodType = destination.type
        ? normalizeRapydPayoutMethodType(destination.type, "destination.type")
        : "";
      beneficiaryId = destination.externalRecipientId
        ? normalizeRapydExternalRecipientId(
            destination.externalRecipientId,
            "destination.externalRecipientId",
          )
        : "";
      rapydBaseUrl = resolveRapydBaseUrl();
      beneficiaryCountry = normalizeIsoCountryCode(
        destination.country ?? process.env.RAPYD_COUNTRY ?? "IL",
        "destination.country",
      );
      senderCountry = normalizeIsoCountryCode(
        process.env.RAPYD_SENDER_COUNTRY ?? process.env.RAPYD_COUNTRY ?? "IL",
        "RAPYD_SENDER_COUNTRY",
      );
    } catch (error) {
      await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
        payoutId,
        attempt,
        mappedStatus: "needs_attention",
        retryable: false,
        errorCode: "configuration_error",
        message: error instanceof Error ? error.message : "Invalid Rapyd payout configuration",
      });
      return;
    }
    if (!accessKey || !secretKey || !ewalletId || !beneficiaryId || !payoutMethodType) {
      await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
        payoutId,
        attempt,
        mappedStatus: "needs_attention",
        retryable: false,
        errorCode: "configuration_error",
        message: "Missing Rapyd payout credentials, ewallet, or destination details",
      });
      return;
    }
    const requestPath = "/v1/payouts";

    const bodyPayload: Record<string, unknown> = {
      beneficiary: beneficiaryId,
      beneficiary_country: beneficiaryCountry,
      beneficiary_entity_type: destination.beneficiaryEntityType ?? "individual",
      confirm_automatically: true,
      description: `QuickFit payout for payment ${payment._id}`,
      ewallet: ewalletId,
      merchant_reference_id: providerLink?.merchantReferenceId ?? buildPayoutCorrelationToken(String(payout.instructorUserId)),
      payout_amount: Number((payout.amountAgorot / 100).toFixed(2)),
      payout_currency: payout.currency,
      payout_method_type: payoutMethodType,
      sender_country: senderCountry,
      sender_currency: payout.currency,
      sender_entity_type: "company",
      metadata: {
        payoutId: payout._id,
        paymentId: payment._id,
        instructorUserId: payout.instructorUserId,
        payoutScheduleId: payout.payoutScheduleId,
      },
    };
    const senderId = getOptionalEnv("RAPYD_MERCHANT_ID");
    if (senderId) {
      bodyPayload.sender = senderId;
    }

    const body = JSON.stringify(bodyPayload);
    try {
      const requestUrl = new URL(requestPath, `${rapydBaseUrl}/`);
      const { response, responseText, signatureEncoding } = await executeRapydSignedPost({
        url: requestUrl.toString(),
        path: requestUrl.pathname,
        accessKey,
        secretKey,
        idempotency: payout.idempotencyKey,
        body,
      });

      if (!response.ok) {
        await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
          payoutId,
          attempt,
          mappedStatus: "queued",
          retryable: isRetryableHttpFailure(response.status),
          httpStatus: response.status,
          message: `Rapyd payout HTTP ${response.status} [${signatureEncoding}]: ${responseText.slice(0, 500)}`,
        });
        return;
      }

      let payload: {
        status?: { status?: string; error_code?: string; message?: string };
        data?: { id?: string; status?: string };
      };
      try {
        payload = JSON.parse(responseText) as {
          status?: { status?: string; error_code?: string; message?: string };
          data?: { id?: string; status?: string };
        };
      } catch {
        await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
          payoutId,
          attempt,
          mappedStatus: "queued",
          retryable: true,
          errorCode: "invalid_json",
          message: "Rapyd payout response was not valid JSON",
        });
        return;
      }

      const operationStatus = (payload.status?.status ?? "").toUpperCase();
      const operationErrorCode = payload.status?.error_code;
      const operationMessage = payload.status?.message;
      if (operationStatus && operationStatus !== "SUCCESS") {
        await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
          payoutId,
          attempt,
          mappedStatus: "queued",
          retryable: !isLikelyPermanentRapydError(operationErrorCode),
          ...omitUndefined({
            errorCode: operationErrorCode,
            message: operationMessage ?? "Rapyd payout request rejected",
            payload,
          }),
        });
        return;
      }

      const rawProviderStatus = payload.data?.status;
      const mapped = normalizeRapydPayoutStatus(rawProviderStatus);
      await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
        payoutId,
        attempt,
        mappedStatus: mapped.status,
        retryable: false,
        ...omitUndefined({
          providerPayoutId: payload.data?.id,
          providerStatusRaw: rawProviderStatus,
          message: mapped.terminal
            ? "Payout reached terminal status from provider response"
            : "Payout accepted by provider and pending settlement",
          payload,
        }),
      });
    } catch (error) {
      await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
        payoutId,
        attempt,
        mappedStatus: "queued",
        retryable: true,
        errorCode: "request_exception",
        message: error instanceof Error ? error.message : "Unknown payout request error",
      });
    }
  },
});

export const recordPayoutAttemptResult = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    attempt: v.number(),
    mappedStatus: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("pending_provider"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("needs_attention"),
    ),
    retryable: v.boolean(),
    providerPayoutId: v.optional(v.string()),
    providerStatusRaw: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    message: v.optional(v.string()),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) return { applied: false, reason: "missing" as const };
    if (payout.attemptCount !== args.attempt) {
      return { applied: false, reason: "stale_attempt" as const };
    }
    if (TERMINAL_PAYOUT_STATUSES.has(payout.status)) {
      return { applied: false, reason: "already_terminal" as const };
    }

    const now = Date.now();
    let nextStatus: PayoutStatus = args.mappedStatus;
    let nextRetryAt: number | undefined;
    let terminalAt: number | undefined;
    let shouldScheduleRetry = false;

    if (args.retryable) {
      if (args.attempt >= payout.maxAttempts) {
        nextStatus = "needs_attention";
        terminalAt = now;
      } else {
        nextStatus = "queued";
        nextRetryAt = now + computeRetryDelayMs(args.attempt);
        shouldScheduleRetry = true;
      }
    } else if (TERMINAL_PAYOUT_STATUSES.has(nextStatus)) {
      terminalAt = now;
    } else if (nextStatus === "processing") {
      nextStatus = "queued";
      nextRetryAt = now + computeRetryDelayMs(args.attempt);
      shouldScheduleRetry = true;
    }

    await ctx.db.patch(args.payoutId, {
      status: nextStatus,
      providerPayoutId: args.providerPayoutId ?? payout.providerPayoutId,
      providerStatusRaw: args.providerStatusRaw ?? payout.providerStatusRaw,
      updatedAt: now,
      ...omitUndefined({
        lastError: args.message,
        nextRetryAt,
        terminalAt: terminalAt ?? payout.terminalAt,
      }),
    });

    if (payout.payoutScheduleId) {
      const schedule = await ctx.db.get(payout.payoutScheduleId);
      const paymentOrder = payout.paymentOrderId ? await ctx.db.get(payout.paymentOrderId) : null;

      if (schedule) {
        await ctx.db.patch(schedule._id, {
          payoutId: payout._id,
          status:
            nextStatus === "pending_provider" || nextStatus === "processing"
              ? "processing"
              : nextStatus === "paid"
                ? "paid"
                : nextStatus === "queued"
                  ? "scheduled"
                  : nextStatus,
          executedAt: nextStatus === "paid" ? now : schedule.executedAt,
          updatedAt: now,
          ...omitUndefined({
            failureReason:
              nextStatus === "failed" ||
              nextStatus === "cancelled" ||
              nextStatus === "needs_attention"
                ? args.message
                : undefined,
          }),
        });
      }

      const existingLink = await ctx.db
        .query("payoutProviderLinks")
        .withIndex("by_payout", (q) => q.eq("payoutId", payout._id))
        .order("desc")
        .first();
      if (existingLink) {
        await ctx.db.patch(existingLink._id, {
          updatedAt: now,
          ...omitUndefined({
            providerPayoutId: args.providerPayoutId ?? existingLink.providerPayoutId,
          }),
        });
      }

      if (schedule && paymentOrder) {
        if (nextStatus === "paid") {
          await insertLedgerEntryIfMissing(ctx, {
            paymentOrderId: paymentOrder._id,
            jobId: paymentOrder.jobId,
            studioUserId: paymentOrder.studioUserId,
            instructorUserId: schedule.instructorUserId,
            payoutScheduleId: schedule._id,
            payoutId: payout._id,
            dedupeKey: `paid:${schedule._id}:reserved`,
            entryType: "payout_sent",
            balanceBucket: "instructor_reserved",
            amountAgorot: -schedule.amountAgorot,
            currency: schedule.currency,
            referenceType: "payout",
            referenceId: String(payout._id),
            createdAt: now,
          });
          await insertLedgerEntryIfMissing(ctx, {
            paymentOrderId: paymentOrder._id,
            jobId: paymentOrder.jobId,
            studioUserId: paymentOrder.studioUserId,
            instructorUserId: schedule.instructorUserId,
            payoutScheduleId: schedule._id,
            payoutId: payout._id,
            dedupeKey: `paid:${schedule._id}:paid`,
            entryType: "payout_sent",
            balanceBucket: "instructor_paid",
            amountAgorot: schedule.amountAgorot,
            currency: schedule.currency,
            referenceType: "payout",
            referenceId: String(payout._id),
            createdAt: now,
          });
        }

        if (nextStatus === "failed" || nextStatus === "cancelled" || nextStatus === "needs_attention") {
          await insertLedgerEntryIfMissing(ctx, {
            paymentOrderId: paymentOrder._id,
            jobId: paymentOrder.jobId,
            studioUserId: paymentOrder.studioUserId,
            instructorUserId: schedule.instructorUserId,
            payoutScheduleId: schedule._id,
            payoutId: payout._id,
            dedupeKey: `failed:${schedule._id}:reserved`,
            entryType: "payout_failed",
            balanceBucket: "instructor_reserved",
            amountAgorot: -schedule.amountAgorot,
            currency: schedule.currency,
            referenceType: "payout",
            referenceId: String(payout._id),
            createdAt: now,
          });
          await insertLedgerEntryIfMissing(ctx, {
            paymentOrderId: paymentOrder._id,
            jobId: paymentOrder.jobId,
            studioUserId: paymentOrder.studioUserId,
            instructorUserId: schedule.instructorUserId,
            payoutScheduleId: schedule._id,
            payoutId: payout._id,
            dedupeKey: `failed:${schedule._id}:available`,
            entryType: "payout_failed",
            balanceBucket: "instructor_available",
            amountAgorot: schedule.amountAgorot,
            currency: schedule.currency,
            referenceType: "payout",
            referenceId: String(payout._id),
            createdAt: now,
          });
        }
      }
    }

    await ctx.db.insert("payoutEvents", {
      payoutId: args.payoutId,
      paymentId: payout.paymentId,
      provider: payout.provider,
      eventType: "provider_response",
      createdAt: now,
      ...omitUndefined({
        attempt: args.attempt,
        providerPayoutId: args.providerPayoutId,
        statusRaw: args.providerStatusRaw,
        mappedStatus: nextStatus,
        retryable: args.retryable,
        httpStatus: args.httpStatus,
        errorCode: args.errorCode,
        message: args.message,
        payload: args.payload,
      }),
    });

    if (shouldScheduleRetry && nextRetryAt) {
      await ctx.db.insert("payoutEvents", {
        payoutId: args.payoutId,
        paymentId: payout.paymentId,
        provider: payout.provider,
        eventType: "retry_scheduled",
        attempt: args.attempt,
        mappedStatus: nextStatus,
        retryable: true,
        message: `Retry scheduled in ${nextRetryAt - now}ms`,
        createdAt: now,
      });
      await ctx.scheduler.runAfter(nextRetryAt - now, internal.payouts.runPayoutAttempt, {
        payoutId: args.payoutId,
      });
    }

    if (nextStatus === "failed" || nextStatus === "cancelled" || nextStatus === "needs_attention") {
      await ctx.db.insert("payoutEvents", {
        payoutId: args.payoutId,
        paymentId: payout.paymentId,
        provider: payout.provider,
        eventType: "terminal_failure",
        attempt: args.attempt,
        mappedStatus: nextStatus,
        message: args.message ?? "Payout moved to terminal state",
        createdAt: now,
      });
    }

    return {
      applied: true,
      status: nextStatus,
      retryScheduled: shouldScheduleRetry,
      nextRetryAt,
    };
  },
});

export const flagPayoutNeedsAttentionForRefund = internalMutation({
  args: {
    paymentId: v.id("payments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { paymentId, reason }) => {
    const payout = await ctx.db
      .query("payouts")
      .withIndex("by_payment", (q) => q.eq("paymentId", paymentId))
      .order("desc")
      .first();
    if (!payout) {
      return { updated: false, reason: "payout_not_found" as const };
    }

    const now = Date.now();
    const terminal = TERMINAL_PAYOUT_STATUSES.has(payout.status);
    const nextStatus: PayoutStatus =
      payout.status === "failed" || payout.status === "cancelled"
        ? payout.status
        : "needs_attention";

    await ctx.db.patch(payout._id, {
      status: nextStatus,
      terminalAt: terminal ? payout.terminalAt : now,
      lastError: reason ?? "Payment moved to refunded; payout requires manual reconciliation",
      updatedAt: now,
    });

    await ctx.db.insert("payoutEvents", {
      payoutId: payout._id,
      paymentId: payout.paymentId,
      provider: payout.provider,
      eventType: "terminal_failure",
      attempt: payout.attemptCount,
      mappedStatus: nextStatus,
      message: reason ?? "Payment refund detected; payout flagged for manual reconciliation",
      createdAt: now,
    });

    return { updated: true, payoutId: payout._id, status: nextStatus };
  },
});

export const processRapydPayoutWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    providerPayoutId: v.optional(v.string()),
    merchantReferenceId: v.optional(v.string()),
    payoutId: v.optional(v.id("payouts")),
    statusRaw: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.any(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ignored: boolean;
    processed?: boolean;
    reason?: "duplicate_event" | "payout_not_found" | "invalid_signature";
    eventId?: Id<"payoutEvents">;
    payoutId?: Id<"payouts">;
    status?: PayoutStatus;
  }> => {
    const existingEvent = await ctx.db
      .query("payoutEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existingEvent?.mappedStatus && TERMINAL_PAYOUT_STATUSES.has(existingEvent.mappedStatus)) {
      return { ignored: true, reason: "duplicate_event" as const };
    }

    const payoutByProviderId = args.providerPayoutId
      ? await ctx.runQuery(internal.payouts.getPayoutByProviderRefs, {
          ...omitUndefined({
            providerPayoutId: args.providerPayoutId,
            merchantReferenceId: args.merchantReferenceId,
          }),
        })
      : null;
    const payout =
      payoutByProviderId ??
      (args.payoutId ? await ctx.db.get(args.payoutId) : null) ??
      (args.merchantReferenceId
        ? await ctx.runQuery(internal.payouts.getPayoutByProviderRefs, {
            merchantReferenceId: args.merchantReferenceId,
          })
        : null);
    if (!payout) {
      return {
        ignored: false,
        processed: false,
        reason: "payout_not_found" as const,
      };
    }

    const now = Date.now();
    if (!args.signatureValid) {
      const eventId =
        existingEvent?._id ??
        (await ctx.db.insert("payoutEvents", {
          payoutId: payout._id,
          paymentId: payout.paymentId,
          provider: RAPYD_PROVIDER,
          eventType: "status_update",
          createdAt: now,
          ...omitUndefined({
            attempt: payout.attemptCount,
            providerEventId: args.providerEventId,
            providerPayoutId: args.providerPayoutId ?? payout.providerPayoutId,
            statusRaw: args.statusRaw,
            mappedStatus: payout.status,
            retryable: false,
            errorCode: "invalid_signature",
            message: "Ignored Rapyd payout webhook due to invalid signature",
          }),
        }));
      if (existingEvent) {
        await ctx.db.patch(eventId, {
          createdAt: existingEvent.createdAt,
          ...omitUndefined({
            providerPayoutId: args.providerPayoutId ?? payout.providerPayoutId,
            statusRaw: args.statusRaw,
            mappedStatus: payout.status,
            retryable: false,
            errorCode: "invalid_signature",
            message: "Ignored Rapyd payout webhook due to invalid signature",
          }),
        });
      }
      return { ignored: true, reason: "invalid_signature" as const, eventId };
    }

    const mapped = normalizeRapydPayoutStatus(args.statusRaw);
    const nextStatus = computeNextPayoutWebhookStatus(payout.status, mapped.status);
    const attemptResult = await ctx.runMutation(internal.payouts.recordPayoutAttemptResult, {
      payoutId: payout._id,
      attempt: payout.attemptCount,
      mappedStatus: nextStatus,
      retryable: false,
      ...omitUndefined({
        providerPayoutId: args.providerPayoutId,
        providerStatusRaw: args.statusRaw,
        message:
          nextStatus === "failed" || nextStatus === "cancelled" || nextStatus === "needs_attention"
            ? `Rapyd payout webhook reported ${args.statusRaw ?? "unknown"}`
            : "Payout status updated via Rapyd webhook",
      }),
    });

    const eventId =
      existingEvent?._id ??
      (await ctx.db.insert("payoutEvents", {
        payoutId: payout._id,
        paymentId: payout.paymentId,
        provider: RAPYD_PROVIDER,
        eventType: "status_update",
        createdAt: now,
        ...omitUndefined({
          attempt: payout.attemptCount,
          providerEventId: args.providerEventId,
          providerPayoutId: args.providerPayoutId ?? payout.providerPayoutId,
          statusRaw: args.statusRaw,
          mappedStatus: attemptResult.status ?? nextStatus,
          retryable: false,
          message:
            nextStatus === "failed" || nextStatus === "cancelled" || nextStatus === "needs_attention"
              ? "Payout moved to terminal state via Rapyd webhook"
              : "Payout status updated via Rapyd webhook",
        }),
      }));
    if (existingEvent) {
      await ctx.db.patch(eventId, {
        ...omitUndefined({
          providerPayoutId: args.providerPayoutId ?? payout.providerPayoutId,
          statusRaw: args.statusRaw,
          mappedStatus: attemptResult.status ?? nextStatus,
          retryable: false,
          message:
            nextStatus === "failed" || nextStatus === "cancelled" || nextStatus === "needs_attention"
              ? "Payout moved to terminal state via Rapyd webhook"
              : "Payout status updated via Rapyd webhook",
        }),
      });
    }

    return {
      ignored: false,
      processed: attemptResult.applied !== false,
      eventId,
      payoutId: payout._id,
      status: (attemptResult.status ?? nextStatus) as PayoutStatus,
    };
  },
});
