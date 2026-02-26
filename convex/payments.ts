import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireCurrentUser, requireUserRole } from "./lib/auth";
import { omitUndefined } from "./lib/validation";

const RAPYD_PROVIDER = "rapyd" as const;

type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";

type MappedPaymentStatus = Exclude<PaymentStatus, "created">;
type InvoiceStatus = "pending" | "issued" | "failed";

type InvoiceInput = {
  _id: Id<"invoices">;
  status: InvoiceStatus;
  externalInvoiceId?: string;
  externalInvoiceUrl?: string;
  issuedAt?: number;
} | null;

const TERMINAL_PAYMENT_STATUSES = new Set<PaymentStatus>(["failed", "cancelled", "refunded"]);

const CAPTURED_STICKY_STATUSES = new Set<MappedPaymentStatus>(["pending", "authorized"]);

const BLOCK_NEW_CHECKOUT_ACTIVE_STATUSES = new Set<PaymentStatus>([
  "created",
  "pending",
  "authorized",
]);

const DEFAULT_STALE_CHECKOUT_MS = 30 * 60 * 1000;

const MANUAL_PAYOUT_RELEASE_MODE = "manual";
const AUTOMATIC_PAYOUT_RELEASE_MODE = "automatic";

type PayoutReleaseMode = typeof MANUAL_PAYOUT_RELEASE_MODE | typeof AUTOMATIC_PAYOUT_RELEASE_MODE;

const isSandboxMode = (): boolean =>
  (process.env.RAPYD_MODE ?? "sandbox").trim().toLowerCase() !== "production";

const isSandboxDestinationSelfVerifyEnabled = (): boolean =>
  isSandboxMode() && (process.env.ALLOW_SANDBOX_DESTINATION_SELF_VERIFY ?? "0").trim() === "1";

const readPayoutReleaseMode = (): PayoutReleaseMode => {
  const rawMode = (process.env.PAYOUT_RELEASE_MODE ?? MANUAL_PAYOUT_RELEASE_MODE)
    .trim()
    .toLowerCase();
  return rawMode === AUTOMATIC_PAYOUT_RELEASE_MODE
    ? AUTOMATIC_PAYOUT_RELEASE_MODE
    : MANUAL_PAYOUT_RELEASE_MODE;
};

const toInvoiceSummary = (invoice: InvoiceInput) =>
  invoice
    ? {
        _id: invoice._id,
        status: invoice.status,
        externalInvoiceId: invoice.externalInvoiceId,
        externalInvoiceUrl: invoice.externalInvoiceUrl,
        issuedAt: invoice.issuedAt,
      }
    : null;

const isInstructorKycApproved = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> => {
  const profile = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
  if (!profile || profile.diditVerificationStatus !== "approved") {
    return false;
  }
  return Boolean(profile.diditLegalName?.trim());
};

export const toRapydPaymentStatus = (rawStatus: string | undefined): MappedPaymentStatus => {
  const status = (rawStatus ?? "").trim().toUpperCase();
  if (["CLO", "CAPTURED", "SUCCESS", "COMPLETED"].includes(status)) {
    return "captured";
  }
  if (["AUTH", "AUTHORIZED"].includes(status)) {
    return "authorized";
  }
  if (["ACT", "NEW", "PENDING", "INIT", "OPEN"].includes(status)) {
    return "pending";
  }
  if (["CAN", "CANCELLED", "CANCELED"].includes(status)) {
    return "cancelled";
  }
  if (["REV", "REFUNDED", "PARTIAL_REFUND"].includes(status)) {
    return "refunded";
  }
  return "failed";
};

const computeNextWebhookPaymentStatus = (
  currentStatus: PaymentStatus,
  mappedStatus: MappedPaymentStatus,
): MappedPaymentStatus => {
  if (TERMINAL_PAYMENT_STATUSES.has(currentStatus)) {
    return currentStatus as MappedPaymentStatus;
  }
  if (currentStatus === "captured" && CAPTURED_STICKY_STATUSES.has(mappedStatus)) {
    return "captured";
  }
  if (currentStatus === "authorized" && mappedStatus === "pending") {
    return "authorized";
  }
  return mappedStatus;
};

export const getCheckoutContext = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const studio = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!studio) return null;

    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (job.studioId !== studio._id) return null;

    const instructorProfile = job.filledByInstructorId
      ? await ctx.db.get(job.filledByInstructorId)
      : null;

    return {
      user,
      studio,
      job,
      instructorProfile: instructorProfile ?? null,
    };
  },
});

export const getPaymentByProviderRefs = internalQuery({
  args: {
    providerPaymentId: v.optional(v.string()),
    providerCheckoutId: v.optional(v.string()),
    paymentId: v.optional(v.id("payments")),
  },
  handler: async (ctx, args) => {
    if (args.paymentId) {
      const direct = await ctx.db.get(args.paymentId);
      if (direct && direct.provider === RAPYD_PROVIDER) return direct;
    }
    if (args.providerPaymentId) {
      const byPaymentId = await ctx.db
        .query("payments")
        .withIndex("by_provider_paymentId", (q) =>
          q.eq("provider", RAPYD_PROVIDER).eq("providerPaymentId", args.providerPaymentId),
        )
        .unique();
      if (byPaymentId) return byPaymentId;
    }
    if (args.providerCheckoutId) {
      return await ctx.db
        .query("payments")
        .withIndex("by_provider_checkoutId", (q) =>
          q.eq("provider", RAPYD_PROVIDER).eq("providerCheckoutId", args.providerCheckoutId),
        )
        .unique();
    }
    return null;
  },
});

export const createPendingPayment = internalMutation({
  args: {
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.optional(v.id("instructorProfiles")),
    instructorUserId: v.optional(v.id("users")),
    provider: v.literal("rapyd"),
    currency: v.string(),
    instructorBaseAmountAgorot: v.number(),
    platformMarkupAmountAgorot: v.number(),
    studioChargeAmountAgorot: v.number(),
    platformMarkupBps: v.number(),
    idempotencyKey: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const staleCheckoutMs = Math.min(
      24 * 60 * 60 * 1000,
      Math.max(
        60 * 1000,
        Number.parseInt(process.env.PAYMENT_CHECKOUT_STALE_MS ?? "", 10) ||
          DEFAULT_STALE_CHECKOUT_MS,
      ),
    );

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_studio_user_idempotency", (q) =>
        q.eq("studioUserId", args.studioUserId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      if (existing.jobId !== args.jobId || existing.provider !== args.provider) {
        throw new ConvexError("Idempotency key already exists with a different job/provider");
      }
      return existing;
    }

    const sameJobPayments = await ctx.db
      .query("payments")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(25);
    const latestSameStudioPayment = sameJobPayments.find(
      (row) => row.provider === args.provider && row.studioUserId === args.studioUserId,
    );
    if (latestSameStudioPayment) {
      if (BLOCK_NEW_CHECKOUT_ACTIVE_STATUSES.has(latestSameStudioPayment.status)) {
        const isStale = Date.now() - latestSameStudioPayment.updatedAt >= staleCheckoutMs;
        if (isStale) {
          await ctx.db.patch(latestSameStudioPayment._id, {
            status: "failed",
            lastError: latestSameStudioPayment.lastError ?? "Marked stale after checkout timeout",
            updatedAt: Date.now(),
          });
        } else {
          throw new ConvexError("A payment for this lesson is already processing");
        }
      }
      if (latestSameStudioPayment.status === "captured") {
        throw new ConvexError("This lesson already has a completed payment record");
      }
      if (latestSameStudioPayment.status === "refunded") {
        throw new ConvexError(
          "This lesson has a refunded payment record and cannot be recharged automatically",
        );
      }
    }

    const now = Date.now();
    const paymentId = await ctx.db.insert("payments", {
      jobId: args.jobId,
      studioId: args.studioId,
      studioUserId: args.studioUserId,
      provider: args.provider,
      status: "created",
      currency: args.currency,
      instructorBaseAmountAgorot: args.instructorBaseAmountAgorot,
      platformMarkupAmountAgorot: args.platformMarkupAmountAgorot,
      studioChargeAmountAgorot: args.studioChargeAmountAgorot,
      platformMarkupBps: args.platformMarkupBps,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        instructorId: args.instructorId,
        instructorUserId: args.instructorUserId,
        metadata: args.metadata,
      }),
    });

    return await ctx.db.get(paymentId);
  },
});

export const markCheckoutCreated = internalMutation({
  args: {
    paymentId: v.id("payments"),
    providerCheckoutId: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new ConvexError("Payment not found");
    }

    await ctx.db.patch(args.paymentId, {
      metadata: {
        ...(payment.metadata ?? {}),
        ...(args.metadata ?? {}),
      },
      status: payment.status === "created" ? "pending" : payment.status,
      updatedAt: Date.now(),
      ...omitUndefined({
        providerCheckoutId: args.providerCheckoutId ?? payment.providerCheckoutId,
        providerPaymentId: args.providerPaymentId ?? payment.providerPaymentId,
      }),
    });
  },
});

export const processRapydWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    providerCheckoutId: v.optional(v.string()),
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
    reason?: "duplicate_event" | "invalid_signature" | "payment_not_found";
    processed?: boolean;
    eventId?: Id<"paymentEvents">;
    paymentId?: Id<"payments">;
  }> => {
    const existingEvent = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existingEvent) {
      return { ignored: true, reason: "duplicate_event" as const };
    }

    const payment = await ctx.runQuery(
      internal.payments.getPaymentByProviderRefs,
      omitUndefined({
        providerPaymentId: args.providerPaymentId,
        providerCheckoutId: args.providerCheckoutId,
      }),
    );
    const now = Date.now();

    const eventId = await ctx.db.insert("paymentEvents", {
      provider: RAPYD_PROVIDER,
      providerEventId: args.providerEventId,
      signatureValid: args.signatureValid,
      processed: Boolean(payment && args.signatureValid),
      payloadHash: args.payloadHash,
      payload: args.payload,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        eventType: args.eventType,
        paymentId: payment?._id,
        providerPaymentId: args.providerPaymentId,
        providerCheckoutId: args.providerCheckoutId,
        statusRaw: args.statusRaw,
      }),
    });

    if (!args.signatureValid) {
      await ctx.db.patch(eventId, {
        processed: false,
        processingError: "invalid_signature",
        updatedAt: Date.now(),
      });
      return { ignored: true, reason: "invalid_signature" as const, eventId };
    }

    if (!payment) {
      await ctx.db.patch(eventId, {
        processed: false,
        processingError: "payment_not_found",
        updatedAt: Date.now(),
      });
      return {
        ignored: false,
        processed: false,
        reason: "payment_not_found" as const,
        eventId,
      };
    }

    const mappedStatus = toRapydPaymentStatus(args.statusRaw);
    const nextStatus = computeNextWebhookPaymentStatus(payment.status, mappedStatus);
    const transitionedToCaptured = payment.status !== "captured" && nextStatus === "captured";
    const transitionedToRefunded = payment.status !== "refunded" && nextStatus === "refunded";

    await ctx.db.patch(payment._id, {
      status: nextStatus,
      providerPaymentId: args.providerPaymentId ?? payment.providerPaymentId,
      providerCheckoutId: args.providerCheckoutId ?? payment.providerCheckoutId,
      capturedAt:
        nextStatus === "captured" ? (payment.capturedAt ?? Date.now()) : payment.capturedAt,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(eventId, {
      paymentId: payment._id,
      processed: true,
      updatedAt: Date.now(),
    });

    if (transitionedToCaptured && readPayoutReleaseMode() === AUTOMATIC_PAYOUT_RELEASE_MODE) {
      await ctx.runMutation(internal.payouts.schedulePayoutForCapturedPayment, {
        paymentId: payment._id,
        reason: "captured_via_rapyd_webhook",
      });
    }

    if (transitionedToCaptured) {
      await ctx.scheduler.runAfter(0, internal.invoicing.issueInvoiceForPayment, {
        paymentId: payment._id,
      });
    }

    if (transitionedToRefunded) {
      await ctx.runMutation(internal.payouts.flagPayoutNeedsAttentionForRefund, {
        paymentId: payment._id,
        reason: "payment_refunded_via_rapyd_webhook",
      });
    }

    return { ignored: false, processed: true, eventId, paymentId: payment._id };
  },
});

export const listMyPayments = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const rawLimit = Math.floor(args.limit ?? 20);
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    let rows: Doc<"payments">[] = [];

    if (user.role === "studio") {
      rows = await ctx.db
        .query("payments")
        .withIndex("by_studio_user", (q) => q.eq("studioUserId", user._id))
        .order("desc")
        .take(limit);
    } else if (user.role === "instructor") {
      rows = await ctx.db
        .query("payments")
        .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
        .order("desc")
        .take(limit);
    }

    if (rows.length === 0) {
      return [] as {
        payment: Doc<"payments">;
        payout: { status: Doc<"payouts">["status"]; settledAt?: number } | null;
        invoice: {
          _id: Id<"invoices">;
          status: "pending" | "issued" | "failed";
          externalInvoiceId?: string;
          externalInvoiceUrl?: string;
          issuedAt?: number;
        } | null;
        job: {
          _id: Id<"jobs">;
          sport: string;
          startTime: number;
          status: Doc<"jobs">["status"];
        } | null;
      }[];
    }

    return await Promise.all(
      rows.map(async (payment) => {
        const [payout, job, invoice] = await Promise.all([
          ctx.db
            .query("payouts")
            .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
            .order("desc")
            .first(),
          ctx.db.get(payment.jobId),
          ctx.db
            .query("invoices")
            .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
            .order("desc")
            .first(),
        ]);

        return {
          payment,
          payout: payout
            ? {
                status: payout.status,
                ...omitUndefined({
                  settledAt: payout.terminalAt,
                }),
              }
            : null,
          job: job
            ? {
                _id: job._id,
                sport: job.sport,
                startTime: job.startTime,
                status: job.status,
              }
            : null,
          invoice: toInvoiceSummary(invoice),
        };
      }),
    );
  },
});

export const getMyPaymentForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .collect();

    const payment =
      user.role === "studio"
        ? rows.find((row) => row.studioUserId === user._id)
        : rows.find((row) => row.instructorUserId === user._id);
    return payment ?? null;
  },
});

export const getMyPaymentDetail = query({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return null;
    if (payment.studioUserId !== user._id && payment.instructorUserId !== user._id) {
      throw new ConvexError("Not authorized");
    }

    const [job, events, payout, invoice] = await Promise.all([
      ctx.db.get(payment.jobId),
      ctx.db
        .query("paymentEvents")
        .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
        .order("desc")
        .take(50),
      ctx.db
        .query("payouts")
        .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
        .order("desc")
        .first(),
      ctx.db
        .query("invoices")
        .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
        .order("desc")
        .first(),
    ]);

    return {
      payment,
      job,
      payout: payout
        ? {
            status: payout.status,
            settledAt: payout.terminalAt,
          }
        : null,
      invoice: toInvoiceSummary(invoice),
      timeline: events.map((event) => ({
        _id: event._id,
        createdAt: event.createdAt,
        title: event.eventType ?? "provider_event",
        description: event.statusRaw ?? "status_update",
        signatureValid: event.signatureValid,
        processed: event.processed,
      })),
    };
  },
});

export const listMyPayoutDestinations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    return await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getMyPayoutSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);

    const [payments, payouts, destinations, onboardingSessions, kycApproved] = await Promise.all([
      ctx.db
        .query("payments")
        .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
        .order("desc")
        .take(400),
      ctx.db
        .query("payouts")
        .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
        .order("desc")
        .take(400),
      ctx.db
        .query("payoutDestinations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("payoutDestinationOnboarding")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(5),
      isInstructorKycApproved(ctx, user._id),
    ]);

    const latestPayoutByPaymentId = new Map<string, Doc<"payouts">>();
    for (const payout of payouts) {
      const key = String(payout.paymentId);
      if (!latestPayoutByPaymentId.has(key)) {
        latestPayoutByPaymentId.set(key, payout);
      }
    }

    let availableAmountAgorot = 0;
    let pendingAmountAgorot = 0;
    let paidAmountAgorot = 0;
    let attentionAmountAgorot = 0;
    let availablePaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let paidPaymentsCount = 0;
    let attentionPaymentsCount = 0;
    const currency = payments[0]?.currency ?? process.env.PAYMENTS_CURRENCY ?? "ILS";

    for (const payment of payments) {
      if (payment.status !== "captured") continue;
      const latestPayout = latestPayoutByPaymentId.get(String(payment._id));
      if (!latestPayout) {
        availableAmountAgorot += payment.instructorBaseAmountAgorot;
        availablePaymentsCount += 1;
        continue;
      }

      if (latestPayout.status === "paid") {
        paidAmountAgorot += latestPayout.amountAgorot;
        paidPaymentsCount += 1;
        continue;
      }

      if (
        latestPayout.status === "queued" ||
        latestPayout.status === "processing" ||
        latestPayout.status === "pending_provider"
      ) {
        pendingAmountAgorot += latestPayout.amountAgorot;
        pendingPaymentsCount += 1;
        continue;
      }

      attentionAmountAgorot += latestPayout.amountAgorot;
      attentionPaymentsCount += 1;
    }

    const verifiedDefaultDestination =
      destinations.find(
        (destination) => destination.isDefault && destination.status === "verified",
      ) ??
      destinations.find((destination) => destination.status === "verified") ??
      null;
    const latestOnboardingSession = onboardingSessions[0] ?? null;

    return {
      payoutReleaseMode: readPayoutReleaseMode(),
      sandboxSelfVerifyEnabled: isSandboxDestinationSelfVerifyEnabled(),
      currency,
      hasVerifiedDestination: Boolean(verifiedDefaultDestination),
      isIdentityVerified: kycApproved,
      verifiedDestination: verifiedDefaultDestination
        ? {
            _id: verifiedDefaultDestination._id,
            type: verifiedDefaultDestination.type,
            label: verifiedDefaultDestination.label,
            country: verifiedDefaultDestination.country,
            currency: verifiedDefaultDestination.currency,
            last4: verifiedDefaultDestination.last4,
          }
        : null,
      availableAmountAgorot,
      pendingAmountAgorot,
      paidAmountAgorot,
      attentionAmountAgorot,
      availablePaymentsCount,
      pendingPaymentsCount,
      paidPaymentsCount,
      attentionPaymentsCount,
      onboardingStatus: latestOnboardingSession?.status ?? null,
      onboardingUpdatedAt: latestOnboardingSession?.updatedAt ?? null,
      onboardingLastError: latestOnboardingSession?.lastError ?? null,
    };
  },
});

export const requestMyPayoutWithdrawal = mutation({
  args: {
    maxPayments: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const kycApproved = await isInstructorKycApproved(ctx, user._id);
    if (!kycApproved) {
      throw new ConvexError(
        "Identity verification is required before payouts. Complete Didit verification first.",
      );
    }

    const rawMaxPayments = Math.floor(args.maxPayments ?? 20);
    const maxPayments = Math.min(Math.max(rawMaxPayments, 1), 100);

    const [destinations, payments, payouts] = await Promise.all([
      ctx.db
        .query("payoutDestinations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("payments")
        .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
        .order("desc")
        .take(500),
      ctx.db
        .query("payouts")
        .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
        .order("desc")
        .take(500),
    ]);

    const hasVerifiedDestination = destinations.some(
      (destination) => destination.status === "verified",
    );
    if (!hasVerifiedDestination) {
      throw new ConvexError(
        "No verified payout destination available. Add and verify a destination first.",
      );
    }

    const latestPayoutByPaymentId = new Map<string, Doc<"payouts">>();
    for (const payout of payouts) {
      const key = String(payout.paymentId);
      if (!latestPayoutByPaymentId.has(key)) {
        latestPayoutByPaymentId.set(key, payout);
      }
    }

    const eligiblePayments = payments
      .filter(
        (payment) =>
          payment.status === "captured" && !latestPayoutByPaymentId.has(String(payment._id)),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, maxPayments);

    let scheduledCount = 0;
    let totalAmountAgorot = 0;
    const payoutIds: Id<"payouts">[] = [];

    for (const payment of eligiblePayments) {
      const outcome = await ctx.runMutation(internal.payouts.schedulePayoutForCapturedPayment, {
        paymentId: payment._id,
        reason: "manual_withdrawal_requested_by_instructor",
      });

      if (!outcome.scheduled || !outcome.payoutId) continue;
      scheduledCount += 1;
      totalAmountAgorot += payment.instructorBaseAmountAgorot;
      payoutIds.push(outcome.payoutId);
    }

    return {
      payoutReleaseMode: readPayoutReleaseMode(),
      attemptedCount: eligiblePayments.length,
      scheduledCount,
      totalAmountAgorot,
      payoutIds,
    };
  },
});

export const upsertMyPayoutDestination = mutation({
  args: {
    provider: v.literal("rapyd"),
    type: v.string(),
    externalRecipientId: v.string(),
    label: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    last4: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const now = Date.now();
    const externalRecipientId = args.externalRecipientId.trim();
    if (!externalRecipientId) {
      throw new ConvexError("externalRecipientId is required");
    }

    const existing = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user_provider_external", (q) =>
        q
          .eq("userId", user._id)
          .eq("provider", args.provider)
          .eq("externalRecipientId", externalRecipientId),
      )
      .unique();

    if ((args.isDefault ?? true) === true) {
      const activeDefaults = await ctx.db
        .query("payoutDestinations")
        .withIndex("by_user_default", (q) => q.eq("userId", user._id).eq("isDefault", true))
        .collect();
      for (const row of activeDefaults) {
        if (!existing || row._id !== existing._id) {
          await ctx.db.patch(row._id, {
            isDefault: false,
            updatedAt: now,
          });
        }
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        label: args.label ?? existing.label,
        country: args.country ?? existing.country,
        currency: args.currency ?? existing.currency,
        last4: args.last4 ?? existing.last4,
        isDefault: args.isDefault ?? existing.isDefault,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const destinationId = await ctx.db.insert("payoutDestinations", {
      userId: user._id,
      provider: args.provider,
      type: args.type,
      externalRecipientId,
      isDefault: args.isDefault ?? true,
      status: "pending_verification",
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        label: args.label,
        country: args.country,
        currency: args.currency,
        last4: args.last4,
      }),
    });
    return await ctx.db.get(destinationId);
  },
});

export const createBeneficiaryOnboardingSession = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.literal("rapyd"),
    merchantReferenceId: v.string(),
    category: v.string(),
    beneficiaryCountry: v.string(),
    beneficiaryEntityType: v.union(v.literal("individual"), v.literal("company")),
    payoutCurrency: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("payoutDestinationOnboarding", {
      userId: args.userId,
      provider: args.provider,
      merchantReferenceId: args.merchantReferenceId,
      status: "pending",
      category: args.category,
      beneficiaryCountry: args.beneficiaryCountry,
      beneficiaryEntityType: args.beneficiaryEntityType,
      payoutCurrency: args.payoutCurrency,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(sessionId);
  },
});

export const markBeneficiaryOnboardingSessionPending = internalMutation({
  args: {
    sessionId: v.id("payoutDestinationOnboarding"),
    redirectUrl: v.string(),
  },
  handler: async (ctx, { sessionId, redirectUrl }) => {
    await ctx.db.patch(sessionId, {
      redirectUrl,
      status: "pending",
      updatedAt: Date.now(),
    });
  },
});

export const markBeneficiaryOnboardingSessionFailed = internalMutation({
  args: {
    sessionId: v.id("payoutDestinationOnboarding"),
    error: v.string(),
  },
  handler: async (ctx, { sessionId, error }) => {
    await ctx.db.patch(sessionId, {
      status: "failed",
      lastError: error,
      updatedAt: Date.now(),
    });
  },
});

export const processRapydBeneficiaryWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    merchantReferenceId: v.optional(v.string()),
    beneficiaryId: v.optional(v.string()),
    payoutMethodType: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payoutDestinationEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existing) {
      return { ignored: true, reason: "duplicate_event" as const };
    }

    const now = Date.now();
    const eventId = await ctx.db.insert("payoutDestinationEvents", {
      provider: RAPYD_PROVIDER,
      providerEventId: args.providerEventId,
      signatureValid: args.signatureValid,
      processed: false,
      payloadHash: args.payloadHash,
      payload: args.payload,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        eventType: args.eventType,
        merchantReferenceId: args.merchantReferenceId,
        beneficiaryId: args.beneficiaryId,
        payoutMethodType: args.payoutMethodType,
      }),
    });

    if (!args.signatureValid) {
      await ctx.db.patch(eventId, {
        processingError: "invalid_signature",
        updatedAt: Date.now(),
      });
      return { ignored: true, reason: "invalid_signature" as const };
    }

    if (!args.merchantReferenceId || !args.beneficiaryId) {
      await ctx.db.patch(eventId, {
        processingError: "invalid_payload",
        updatedAt: Date.now(),
      });
      return { ignored: true, reason: "invalid_payload" as const };
    }

    const session = await ctx.db
      .query("payoutDestinationOnboarding")
      .withIndex("by_provider_merchant_reference", (q) =>
        q
          .eq("provider", RAPYD_PROVIDER)
          .eq("merchantReferenceId", args.merchantReferenceId as string),
      )
      .unique();

    if (!session) {
      await ctx.db.patch(eventId, {
        processingError: "session_not_found",
        updatedAt: Date.now(),
      });
      return { ignored: true, reason: "session_not_found" as const };
    }

    const defaultRows = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user_default", (q) => q.eq("userId", session.userId).eq("isDefault", true))
      .collect();
    for (const row of defaultRows) {
      await ctx.db.patch(row._id, {
        isDefault: false,
        updatedAt: now,
      });
    }

    const payoutMethodType =
      args.payoutMethodType?.trim() ||
      (process.env.RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE ?? "il_bank").trim();

    const existingDestination = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user_provider_external", (q) =>
        q
          .eq("userId", session.userId)
          .eq("provider", RAPYD_PROVIDER)
          .eq("externalRecipientId", args.beneficiaryId as string),
      )
      .unique();

    let destinationId: Id<"payoutDestinations">;
    if (existingDestination) {
      destinationId = existingDestination._id;
      await ctx.db.patch(existingDestination._id, {
        type: payoutMethodType,
        status: "verified",
        isDefault: true,
        country: session.beneficiaryCountry,
        currency: session.payoutCurrency,
        updatedAt: now,
      });
    } else {
      destinationId = await ctx.db.insert("payoutDestinations", {
        userId: session.userId,
        provider: RAPYD_PROVIDER,
        type: payoutMethodType,
        externalRecipientId: args.beneficiaryId,
        label: "Bank account",
        country: session.beneficiaryCountry,
        currency: session.payoutCurrency,
        isDefault: true,
        status: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(session._id, {
      status: "completed",
      beneficiaryId: args.beneficiaryId,
      payoutMethodType,
      completedAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(eventId, {
      processed: true,
      onboardingId: session._id,
      userId: session.userId,
      destinationId,
      updatedAt: now,
    });

    return {
      ignored: false,
      processed: true,
      destinationId,
    };
  },
});

export const verifyMyPayoutDestinationForTesting = mutation({
  args: {
    destinationId: v.id("payoutDestinations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    if (!isSandboxDestinationSelfVerifyEnabled()) {
      throw new ConvexError("Sandbox destination self-verify is not enabled in this environment");
    }

    const destination = await ctx.db.get(args.destinationId);
    if (!destination || destination.userId !== user._id) {
      throw new ConvexError("Payout destination not found");
    }
    if (destination.provider !== RAPYD_PROVIDER) {
      throw new ConvexError("Unsupported payout destination provider");
    }

    await ctx.db.patch(destination._id, {
      status: "verified",
      updatedAt: Date.now(),
    });
    return await ctx.db.get(destination._id);
  },
});

export const getPaymentForInvoicing = internalQuery({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) return null;

    const [studioUser, job] = await Promise.all([
      ctx.db.get(payment.studioUserId),
      ctx.db.get(payment.jobId),
    ]);

    return {
      payment: {
        _id: payment._id,
        status: payment.status,
        currency: payment.currency,
        studioChargeAmountAgorot: payment.studioChargeAmountAgorot,
      },
      studioUser,
      job,
    };
  },
});

export const createInvoiceRecord = internalMutation({
  args: {
    paymentId: v.id("payments"),
    provider: v.union(v.literal("icount"), v.literal("morning")),
    currency: v.string(),
    amountAgorot: v.number(),
    vatRate: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
      .order("desc")
      .first();
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const invoiceId = await ctx.db.insert("invoices", {
      paymentId: args.paymentId,
      provider: args.provider,
      status: "pending",
      currency: args.currency,
      amountAgorot: args.amountAgorot,
      vatRate: args.vatRate,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(invoiceId);
  },
});

export const markInvoiceIssued = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    externalInvoiceId: v.string(),
    externalInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { invoiceId, externalInvoiceId, externalInvoiceUrl }) => {
    await ctx.db.patch(invoiceId, {
      status: "issued",
      externalInvoiceId,
      externalInvoiceUrl,
      issuedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markInvoiceFailed = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    error: v.string(),
  },
  handler: async (ctx, { invoiceId, error }) => {
    await ctx.db.patch(invoiceId, {
      status: "failed",
      error,
      updatedAt: Date.now(),
    });
  },
});

export const markPaymentError = internalMutation({
  args: {
    paymentId: v.id("payments"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      status: "failed",
      lastError: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const getPaymentsPreflight = query({
  args: {},
  handler: async () => {
    const requiredRapyd = [
      "RAPYD_ACCESS_KEY",
      "RAPYD_SECRET_KEY",
      "RAPYD_COUNTRY",
      "RAPYD_COMPLETE_CHECKOUT_URL",
      "RAPYD_CANCEL_CHECKOUT_URL",
      "RAPYD_EWALLET",
    ] as const;
    const optionalRapydOnboarding = [
      "RAPYD_BENEFICIARY_COMPLETE_URL",
      "RAPYD_BENEFICIARY_CANCEL_URL",
    ] as const;
    const requiredInvoice = ["INVOICE_PROVIDER"] as const;

    const rapyd = Object.fromEntries(
      requiredRapyd.map((name) => [name, Boolean(process.env[name]?.trim())]),
    ) as Record<(typeof requiredRapyd)[number], boolean>;
    const invoice = Object.fromEntries(
      requiredInvoice.map((name) => [name, Boolean(process.env[name]?.trim())]),
    ) as Record<(typeof requiredInvoice)[number], boolean>;
    const rapydOnboarding = Object.fromEntries(
      optionalRapydOnboarding.map((name) => [name, Boolean(process.env[name]?.trim())]),
    ) as Record<(typeof optionalRapydOnboarding)[number], boolean>;

    return {
      mode: (process.env.RAPYD_MODE ?? "sandbox").trim().toLowerCase(),
      payoutReleaseMode: readPayoutReleaseMode(),
      currency: (process.env.PAYMENTS_CURRENCY ?? "ILS").trim().toUpperCase(),
      webhookMaxSkewSeconds: Number.parseInt(
        (process.env.RAPYD_WEBHOOK_MAX_SKEW_SECONDS ?? "300").trim(),
        10,
      ),
      rapyd,
      rapydOnboarding,
      invoice,
      readyForCheckout: Object.values(rapyd).every(Boolean),
      readyForInvoicing: Object.values(invoice).every(Boolean),
    };
  },
});
