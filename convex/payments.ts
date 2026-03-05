import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { requireUserRole } from "./lib/auth";
import { omitUndefined } from "./lib/validation";
import {
  getCheckoutContextRead,
  getMyPaymentDetailRead,
  getMyPaymentForJobRead,
  getMyPayoutOnboardingSessionRead,
  getMyPayoutSummaryRead,
  getOwnedStudioPaymentForReconciliationRead,
  getPaymentByProviderRefsRead,
  getPaymentForInvoicingRead,
  getPaymentsPreflightRead,
  isInstructorKycApproved,
  isSandboxDestinationSelfVerifyEnabled,
  listMyPaymentsRead,
  listMyPayoutDestinationsRead,
  readPayoutReleaseMode,
} from "./paymentsRead";

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

const TERMINAL_PAYMENT_STATUSES = new Set<PaymentStatus>(["failed", "cancelled", "refunded"]);

const CAPTURED_STICKY_STATUSES = new Set<MappedPaymentStatus>(["pending", "authorized"]);

const BLOCK_NEW_CHECKOUT_ACTIVE_STATUSES = new Set<PaymentStatus>([
  "created",
  "pending",
  "authorized",
]);

const DEFAULT_STALE_CHECKOUT_MS = 30 * 60 * 1000;

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeWebhookPayload = (payload: unknown): Record<string, unknown> => {
  const root = toRecord(payload) ?? {};
  const data = toRecord(root.data);
  const payment = toRecord(data?.payment);
  const payout = toRecord(data?.payout);
  const checkout = toRecord(data?.checkout);
  const metadata = toRecord(data?.metadata);

  return omitUndefined({
    id: toTrimmedString(root.id),
    type: toTrimmedString(root.type) ?? toTrimmedString(root.event),
    data: data
      ? omitUndefined({
          id: toTrimmedString(data.id),
          status: toTrimmedString(data.status),
          merchant_reference_id: toTrimmedString(data.merchant_reference_id),
          payout_method_type: toTrimmedString(data.payout_method_type),
          default_payout_method_type: toTrimmedString(data.default_payout_method_type),
          payment: payment
            ? omitUndefined({
                id: toTrimmedString(payment.id),
                status: toTrimmedString(payment.status),
              })
            : undefined,
          payout: payout
            ? omitUndefined({
                id: toTrimmedString(payout.id),
                status: toTrimmedString(payout.status),
              })
            : undefined,
          checkout: checkout
            ? omitUndefined({
                id: toTrimmedString(checkout.id),
              })
            : undefined,
          metadata: metadata
            ? omitUndefined({
                payoutId: toTrimmedString(metadata.payoutId),
                merchant_reference_id: toTrimmedString(metadata.merchant_reference_id),
              })
            : undefined,
        })
      : undefined,
  });
};

export const toRapydPaymentStatus = (rawStatus: string | undefined): MappedPaymentStatus => {
  const status = (rawStatus ?? "").trim().toUpperCase();
  if (["CLO", "CAPTURED", "SUCCESS", "COMPLETED", "DON"].includes(status)) {
    return "captured";
  }
  if (["AUTH", "AUTHORIZED"].includes(status)) {
    return "authorized";
  }
  if (["ACT", "NEW", "PENDING", "INIT", "OPEN"].includes(status)) {
    return "pending";
  }
  if (["CAN", "CANCELLED", "CANCELED", "EXP"].includes(status)) {
    return "cancelled";
  }
  if (["REV", "REFUNDED", "PARTIAL_REFUND"].includes(status)) {
    return "refunded";
  }
  if (["DEC", "ERROR", "FAILED"].includes(status)) {
    return "failed";
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

const applyResolvedPaymentStatus = async (
  ctx: MutationCtx,
  {
    payment,
    nextStatus,
    providerPaymentId,
    providerCheckoutId,
  }: {
    payment: Doc<"payments">;
    nextStatus: MappedPaymentStatus;
    providerPaymentId?: string;
    providerCheckoutId?: string;
  },
) => {
  const transitionedToCaptured = payment.status !== "captured" && nextStatus === "captured";
  const transitionedToRefunded = payment.status !== "refunded" && nextStatus === "refunded";

  await ctx.db.patch(payment._id, {
    status: nextStatus,
    providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
    providerCheckoutId: providerCheckoutId ?? payment.providerCheckoutId,
    capturedAt: nextStatus === "captured" ? (payment.capturedAt ?? Date.now()) : payment.capturedAt,
    updatedAt: Date.now(),
  });

  if (transitionedToCaptured && readPayoutReleaseMode() === "automatic") {
    await ctx.runMutation(internal.payouts.schedulePayoutForCapturedPayment, {
      paymentId: payment._id,
      reason: "captured_via_rapyd_status_sync",
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
      reason: "payment_refunded_via_rapyd_status_sync",
    });
  }
};

export const getCheckoutContext = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => await getCheckoutContextRead(ctx, args),
});

export const getPaymentByProviderRefs = internalQuery({
  args: {
    providerPaymentId: v.optional(v.string()),
    providerCheckoutId: v.optional(v.string()),
    paymentId: v.optional(v.id("payments")),
  },
  handler: async (ctx, args) => await getPaymentByProviderRefsRead(ctx, args),
});

export const getOwnedStudioPaymentForReconciliation = internalQuery({
  args: {
    paymentId: v.id("payments"),
    studioUserId: v.id("users"),
  },
  handler: async (ctx, args) => await getOwnedStudioPaymentForReconciliationRead(ctx, args),
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
    const canonicalPayload = sanitizeWebhookPayload(args.payload);
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
      payload: canonicalPayload,
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
    await applyResolvedPaymentStatus(ctx, {
      payment,
      nextStatus,
      ...omitUndefined({
        providerPaymentId: args.providerPaymentId,
        providerCheckoutId: args.providerCheckoutId,
      }),
    });

    await ctx.db.patch(eventId, {
      paymentId: payment._id,
      processed: true,
      updatedAt: Date.now(),
    });

    return { ignored: false, processed: true, eventId, paymentId: payment._id };
  },
});

export const reconcilePaymentFromCheckoutLookup = internalMutation({
  args: {
    paymentId: v.id("payments"),
    providerCheckoutId: v.string(),
    providerPaymentId: v.optional(v.string()),
    paymentStatusRaw: v.optional(v.string()),
    checkoutStatusRaw: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new ConvexError("Payment not found");
    }
    if (payment.provider !== RAPYD_PROVIDER) {
      throw new ConvexError("Unsupported payment provider");
    }

    const rawStatus = args.paymentStatusRaw ?? args.checkoutStatusRaw;
    const nextStatus = computeNextWebhookPaymentStatus(
      payment.status,
      toRapydPaymentStatus(rawStatus),
    );

    await applyResolvedPaymentStatus(ctx, {
      payment,
      nextStatus,
      ...omitUndefined({
        providerPaymentId: args.providerPaymentId,
        providerCheckoutId: args.providerCheckoutId,
      }),
    });

    return {
      paymentId: payment._id,
      paymentStatus: nextStatus,
      providerPaymentId: args.providerPaymentId ?? payment.providerPaymentId,
      providerCheckoutId: args.providerCheckoutId,
    };
  },
});

export const listMyPayments = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => await listMyPaymentsRead(ctx, args),
});

export const getMyPaymentForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => await getMyPaymentForJobRead(ctx, args),
});

export const getMyPaymentDetail = query({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => await getMyPaymentDetailRead(ctx, args),
});

export const listMyPayoutDestinations = query({
  args: {},
  handler: async (ctx) => await listMyPayoutDestinationsRead(ctx),
});

export const getMyPayoutSummary = query({
  args: {},
  handler: async (ctx) => await getMyPayoutSummaryRead(ctx),
});

export const getMyPayoutOnboardingSession = query({
  args: {
    sessionId: v.id("payoutDestinationOnboarding"),
  },
  handler: async (ctx, args) => await getMyPayoutOnboardingSessionRead(ctx, args),
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
    const canonicalPayload = sanitizeWebhookPayload(args.payload);
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
      payload: canonicalPayload,
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
  handler: async (ctx, args) => await getPaymentForInvoicingRead(ctx, args),
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
  handler: async (ctx) => await getPaymentsPreflightRead(ctx),
});
