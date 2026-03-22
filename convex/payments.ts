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
import {
  normalizeCurrencyCode,
  normalizeIsoCountryCode,
  normalizeRapydExternalRecipientId,
  normalizeRapydPayoutMethodType,
} from "./integrations/rapyd/config";
import { buildCanonicalRapydPayload } from "./integrations/rapyd/payloads";
import { requireUserRole } from "./lib/auth";
import {
  buildPaymentOrderCorrelationToken,
  inferPayoutRailCategory,
  mapLegacyPaymentStatusToOrderStatus,
  normalizePayoutPreferenceMode,
  requirePositiveAgorot,
  summarizeLedgerBalances,
} from "./lib/marketplace";
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
const MANUAL_WITHDRAWAL_SCAN_BATCH_SIZE = 500;
const DEFAULT_PROVIDER_METHOD_CACHE_TTL_MS = 10 * 60 * 1000;

export const resolveRapydBeneficiaryWebhookState = (args: {
  eventType?: string;
  statusRaw?: string;
}): "verified" | "pending" | "failed" | "expired" => {
  const eventType = (args.eventType ?? "").trim().toLowerCase();
  const status = (args.statusRaw ?? "").trim().toLowerCase();
  const successSignals = ["success", "succeeded", "completed", "verified", "approved", "active"];
  const failureSignals = ["failed", "failure", "cancel", "rejected", "declined", "error"];
  const expirySignals = ["expired", "expire"];

  if (successSignals.some((signal) => status.includes(signal) || eventType.includes(signal))) {
    return "verified";
  }
  if (expirySignals.some((signal) => status.includes(signal) || eventType.includes(signal))) {
    return "expired";
  }
  if (failureSignals.some((signal) => status.includes(signal) || eventType.includes(signal))) {
    return "failed";
  }
  return "pending";
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

  await syncPaymentOrderFromLegacyPayment(ctx, {
    payment,
    nextStatus,
    providerPaymentId,
    providerCheckoutId,
  });

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

async function loadScheduledPaymentIdsForInstructor(
  ctx: MutationCtx,
  instructorUserId: Id<"users">,
): Promise<Set<string>> {
  const scheduledPaymentIds = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const page = await ctx.db
      .query("payouts")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", instructorUserId))
      .order("desc")
      .paginate({
        cursor,
        numItems: MANUAL_WITHDRAWAL_SCAN_BATCH_SIZE,
      });

    for (const payout of page.page) {
      scheduledPaymentIds.add(String(payout.paymentId));
    }

    if (page.isDone) {
      return scheduledPaymentIds;
    }
    cursor = page.continueCursor;
  }
}

export async function loadEligibleCapturedPaymentsForManualWithdrawal(
  ctx: MutationCtx,
  args: {
    instructorUserId: Id<"users">;
    maxPayments: number;
  },
): Promise<Doc<"payments">[]> {
  const scheduledPaymentIds = await loadScheduledPaymentIdsForInstructor(
    ctx,
    args.instructorUserId,
  );
  const eligiblePayments: Doc<"payments">[] = [];
  let cursor: string | null = null;

  while (eligiblePayments.length < args.maxPayments) {
    const page = await ctx.db
      .query("payments")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", args.instructorUserId))
      .order("asc")
      .paginate({
        cursor,
        numItems: MANUAL_WITHDRAWAL_SCAN_BATCH_SIZE,
      });

    for (const payment of page.page) {
      if (payment.status !== "captured") {
        continue;
      }
      if (scheduledPaymentIds.has(String(payment._id))) {
        continue;
      }
      eligiblePayments.push(payment);
      if (eligiblePayments.length >= args.maxPayments) {
        break;
      }
    }

    if (page.isDone) {
      break;
    }
    cursor = page.continueCursor;
  }

  return eligiblePayments;
}

async function upsertPaymentProviderLink(
  ctx: MutationCtx,
  args: {
    paymentOrderId: Id<"paymentOrders">;
    legacyPaymentId?: Id<"payments">;
    providerObjectType: "merchant_reference" | "checkout" | "payment";
    providerObjectId: string | undefined;
    correlationToken?: string;
  },
) {
  const providerObjectId = (args.providerObjectId ?? "").trim();
  if (!providerObjectId) return null;

  const existing = await ctx.db
    .query("paymentProviderLinks")
    .withIndex("by_provider_object", (q) =>
      q
        .eq("provider", RAPYD_PROVIDER)
        .eq("providerObjectType", args.providerObjectType)
        .eq("providerObjectId", providerObjectId),
    )
    .unique();
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      updatedAt: now,
      ...omitUndefined({
        legacyPaymentId: args.legacyPaymentId ?? existing.legacyPaymentId,
        correlationToken: args.correlationToken ?? existing.correlationToken,
      }),
    });
    return existing._id;
  }

  return await ctx.db.insert("paymentProviderLinks", {
    provider: RAPYD_PROVIDER,
    paymentOrderId: args.paymentOrderId,
    providerObjectType: args.providerObjectType,
    providerObjectId,
    createdAt: now,
    updatedAt: now,
    ...omitUndefined({
      legacyPaymentId: args.legacyPaymentId,
      correlationToken: args.correlationToken,
    }),
  });
}

async function getPaymentOrderForLegacyPayment(
  ctx: MutationCtx,
  payment: Doc<"payments">,
): Promise<Doc<"paymentOrders"> | null> {
  if (payment.paymentOrderId) {
    return (await ctx.db.get(payment.paymentOrderId)) ?? null;
  }

  const link = await ctx.db
    .query("paymentProviderLinks")
    .withIndex("by_legacy_payment", (q) => q.eq("legacyPaymentId", payment._id))
    .order("desc")
    .first();
  if (!link) return null;

  return (await ctx.db.get(link.paymentOrderId)) ?? null;
}

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
    .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", args.dedupeKey))
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

async function syncPaymentOrderFromLegacyPayment(
  ctx: MutationCtx,
  args: {
    payment: Doc<"payments">;
    nextStatus: PaymentStatus;
    providerPaymentId: string | undefined;
    providerCheckoutId: string | undefined;
  },
) {
  const paymentOrder = await getPaymentOrderForLegacyPayment(ctx, args.payment);
  if (!paymentOrder) return null;

  const now = Date.now();
  const nextOrderStatus = mapLegacyPaymentStatusToOrderStatus(args.nextStatus);

  await ctx.db.patch(paymentOrder._id, {
    status: nextOrderStatus,
    updatedAt: now,
    ...omitUndefined({
      providerPaymentId:
        args.providerPaymentId ?? args.payment.providerPaymentId ?? paymentOrder.providerPaymentId,
      providerCheckoutId:
        args.providerCheckoutId ??
        args.payment.providerCheckoutId ??
        paymentOrder.providerCheckoutId,
      capturedAt:
        nextOrderStatus === "captured"
          ? (paymentOrder.capturedAt ?? args.payment.capturedAt ?? now)
          : paymentOrder.capturedAt,
      latestError:
        args.nextStatus === "failed"
          ? (args.payment.lastError ?? paymentOrder.latestError)
          : paymentOrder.latestError,
    }),
  });

  await upsertPaymentProviderLink(ctx, {
    paymentOrderId: paymentOrder._id,
    legacyPaymentId: args.payment._id,
    providerObjectType: "merchant_reference",
    providerObjectId: paymentOrder.correlationToken,
    correlationToken: paymentOrder.correlationToken,
  });
  await upsertPaymentProviderLink(ctx, {
    paymentOrderId: paymentOrder._id,
    legacyPaymentId: args.payment._id,
    providerObjectType: "checkout",
    providerObjectId: args.providerCheckoutId ?? args.payment.providerCheckoutId,
    correlationToken: paymentOrder.correlationToken,
  });
  await upsertPaymentProviderLink(ctx, {
    paymentOrderId: paymentOrder._id,
    legacyPaymentId: args.payment._id,
    providerObjectType: "payment",
    providerObjectId: args.providerPaymentId ?? args.payment.providerPaymentId,
    correlationToken: paymentOrder.correlationToken,
  });

  if (args.payment.status !== "captured" && args.nextStatus === "captured") {
    await insertLedgerEntryIfMissing(ctx, {
      paymentOrderId: paymentOrder._id,
      jobId: paymentOrder.jobId,
      studioUserId: paymentOrder.studioUserId,
      instructorUserId: paymentOrder.instructorUserId,
      payoutScheduleId: undefined,
      payoutId: undefined,
      dedupeKey: `capture:${paymentOrder._id}:gross`,
      entryType: "charge_gross",
      balanceBucket: "provider_clearing",
      amountAgorot: requirePositiveAgorot(
        paymentOrder.studioChargeAmountAgorot,
        "studioChargeAmountAgorot",
      ),
      currency: paymentOrder.currency,
      referenceType: "payment_order",
      referenceId: String(paymentOrder._id),
      createdAt: now,
    });
    await insertLedgerEntryIfMissing(ctx, {
      paymentOrderId: paymentOrder._id,
      jobId: paymentOrder.jobId,
      studioUserId: paymentOrder.studioUserId,
      instructorUserId: paymentOrder.instructorUserId,
      payoutScheduleId: undefined,
      payoutId: undefined,
      dedupeKey: `capture:${paymentOrder._id}:platform_fee`,
      entryType: "platform_fee",
      balanceBucket: "platform_available",
      amountAgorot: paymentOrder.platformFeeAmountAgorot,
      currency: paymentOrder.currency,
      referenceType: "payment_order",
      referenceId: String(paymentOrder._id),
      createdAt: now,
    });
    await insertLedgerEntryIfMissing(ctx, {
      paymentOrderId: paymentOrder._id,
      jobId: paymentOrder.jobId,
      studioUserId: paymentOrder.studioUserId,
      instructorUserId: paymentOrder.instructorUserId,
      payoutScheduleId: undefined,
      payoutId: undefined,
      dedupeKey: `capture:${paymentOrder._id}:instructor_gross`,
      entryType: "instructor_gross",
      balanceBucket: "instructor_held",
      amountAgorot: paymentOrder.instructorGrossAmountAgorot,
      currency: paymentOrder.currency,
      referenceType: "payment_order",
      referenceId: String(paymentOrder._id),
      createdAt: now,
    });
  }

  if (args.payment.status !== "refunded" && args.nextStatus === "refunded") {
    const existingEntries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", paymentOrder._id))
      .collect();
    const balances = summarizeLedgerBalances(existingEntries);
    const instructorRefundBucket =
      balances.instructor_available > 0
        ? "instructor_available"
        : balances.instructor_held > 0
          ? "instructor_held"
          : "adjustments";

    await insertLedgerEntryIfMissing(ctx, {
      paymentOrderId: paymentOrder._id,
      jobId: paymentOrder.jobId,
      studioUserId: paymentOrder.studioUserId,
      instructorUserId: paymentOrder.instructorUserId,
      payoutScheduleId: undefined,
      payoutId: undefined,
      dedupeKey: `refund:${paymentOrder._id}:gross`,
      entryType: "refund",
      balanceBucket: "provider_clearing",
      amountAgorot: -paymentOrder.studioChargeAmountAgorot,
      currency: paymentOrder.currency,
      referenceType: "refund",
      referenceId: String(paymentOrder._id),
      createdAt: now,
    });
    await insertLedgerEntryIfMissing(ctx, {
      paymentOrderId: paymentOrder._id,
      jobId: paymentOrder.jobId,
      studioUserId: paymentOrder.studioUserId,
      instructorUserId: paymentOrder.instructorUserId,
      payoutScheduleId: undefined,
      payoutId: undefined,
      dedupeKey: `refund:${paymentOrder._id}:platform_fee`,
      entryType: "refund_fee_impact",
      balanceBucket: "platform_available",
      amountAgorot: -paymentOrder.platformFeeAmountAgorot,
      currency: paymentOrder.currency,
      referenceType: "refund",
      referenceId: String(paymentOrder._id),
      createdAt: now,
    });
    await insertLedgerEntryIfMissing(ctx, {
      paymentOrderId: paymentOrder._id,
      jobId: paymentOrder.jobId,
      studioUserId: paymentOrder.studioUserId,
      instructorUserId: paymentOrder.instructorUserId,
      payoutScheduleId: undefined,
      payoutId: undefined,
      dedupeKey: `refund:${paymentOrder._id}:instructor`,
      entryType: "adjustment",
      balanceBucket: instructorRefundBucket,
      amountAgorot: -paymentOrder.instructorGrossAmountAgorot,
      currency: paymentOrder.currency,
      referenceType: "refund",
      referenceId: String(paymentOrder._id),
      createdAt: now,
    });
  }

  return paymentOrder._id;
}

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
    merchantReferenceId: v.optional(v.string()),
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

export const createPaymentOrder = internalMutation({
  args: {
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.optional(v.id("instructorProfiles")),
    instructorUserId: v.optional(v.id("users")),
    provider: v.literal("rapyd"),
    currency: v.string(),
    instructorGrossAmountAgorot: v.number(),
    platformFeeAmountAgorot: v.number(),
    studioChargeAmountAgorot: v.number(),
    platformFeeBps: v.number(),
  },
  handler: async (ctx, args) => {
    const existingOrders = await ctx.db
      .query("paymentOrders")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(25);
    const existingActive = existingOrders.find(
      (order) =>
        order.provider === args.provider &&
        order.studioUserId === args.studioUserId &&
        ["draft", "checkout_pending", "payment_pending", "authorized", "captured"].includes(
          order.status,
        ),
    );
    if (existingActive) {
      return existingActive;
    }

    const now = Date.now();
    const paymentOrderId = await ctx.db.insert("paymentOrders", {
      jobId: args.jobId,
      studioId: args.studioId,
      studioUserId: args.studioUserId,
      provider: args.provider,
      status: "draft",
      correlationToken: buildPaymentOrderCorrelationToken(String(args.studioUserId)),
      currency: normalizeCurrencyCode(args.currency, "currency"),
      instructorGrossAmountAgorot: requirePositiveAgorot(
        args.instructorGrossAmountAgorot,
        "instructorGrossAmountAgorot",
      ),
      platformFeeAmountAgorot: Math.max(0, Math.round(args.platformFeeAmountAgorot)),
      studioChargeAmountAgorot: requirePositiveAgorot(
        args.studioChargeAmountAgorot,
        "studioChargeAmountAgorot",
      ),
      platformFeeBps: Math.max(0, Math.round(args.platformFeeBps)),
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        instructorId: args.instructorId,
        instructorUserId: args.instructorUserId,
      }),
    });

    return await ctx.db.get(paymentOrderId);
  },
});

export const getProviderMethodCache = internalQuery({
  args: {
    kind: v.union(
      v.literal("payment_methods_country"),
      v.literal("payout_method_types"),
      v.literal("payout_required_fields"),
    ),
    cacheKey: v.string(),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("providerMethodCache")
      .withIndex("by_kind_cache_key", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("kind", args.kind).eq("cacheKey", args.cacheKey),
      )
      .unique(),
});

export const upsertProviderMethodCache = internalMutation({
  args: {
    kind: v.union(
      v.literal("payment_methods_country"),
      v.literal("payout_method_types"),
      v.literal("payout_required_fields"),
    ),
    cacheKey: v.string(),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    methods: v.optional(
      v.array(
        v.object({
          type: v.string(),
          category: v.optional(v.string()),
          paymentFlowType: v.optional(v.string()),
          payoutMethodType: v.optional(v.string()),
          name: v.optional(v.string()),
          status: v.optional(v.union(v.string(), v.number())),
          countries: v.optional(v.array(v.string())),
          currencies: v.optional(v.array(v.string())),
          supportedDigitalWalletProviders: v.optional(v.array(v.string())),
        }),
      ),
    ),
    requiredFields: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.optional(v.string()),
          required: v.optional(v.boolean()),
          description: v.optional(v.string()),
        }),
      ),
    ),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerMethodCache")
      .withIndex("by_kind_cache_key", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("kind", args.kind).eq("cacheKey", args.cacheKey),
      )
      .unique();
    const now = Date.now();
    const payload = omitUndefined({
      methods: args.methods,
      requiredFields: args.requiredFields,
    });
    const expiresAt = now + Math.max(60_000, args.ttlMs ?? DEFAULT_PROVIDER_METHOD_CACHE_TTL_MS);

    if (existing) {
      await ctx.db.patch(existing._id, {
        payload,
        expiresAt,
        updatedAt: now,
        ...omitUndefined({
          country: args.country ?? existing.country,
          currency: args.currency ?? existing.currency,
        }),
      });
      return await ctx.db.get(existing._id);
    }

    const cacheId = await ctx.db.insert("providerMethodCache", {
      provider: RAPYD_PROVIDER,
      kind: args.kind,
      cacheKey: args.cacheKey,
      payload,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        country: args.country,
        currency: args.currency,
      }),
    });
    return await ctx.db.get(cacheId);
  },
});

export const createPendingPayment = internalMutation({
  args: {
    paymentOrderId: v.optional(v.id("paymentOrders")),
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
    const paymentId = await ctx.db.insert(
      "payments",
      omitUndefined({
        paymentOrderId: args.paymentOrderId,
        jobId: args.jobId,
        studioId: args.studioId,
        studioUserId: args.studioUserId,
        provider: args.provider,
        status: "created" as const,
        currency: args.currency,
        instructorBaseAmountAgorot: args.instructorBaseAmountAgorot,
        platformMarkupAmountAgorot: args.platformMarkupAmountAgorot,
        studioChargeAmountAgorot: args.studioChargeAmountAgorot,
        platformMarkupBps: args.platformMarkupBps,
        idempotencyKey: args.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        instructorId: args.instructorId,
        instructorUserId: args.instructorUserId,
        metadata: args.metadata,
      }) as any,
    );

    if (args.paymentOrderId) {
      await upsertPaymentProviderLink(ctx, {
        paymentOrderId: args.paymentOrderId,
        legacyPaymentId: paymentId,
        providerObjectType: "merchant_reference",
        providerObjectId: (await ctx.db.get(args.paymentOrderId))?.correlationToken ?? "",
      });
    }

    return await ctx.db.get(paymentId);
  },
});

export const markCheckoutCreated = internalMutation({
  args: {
    paymentId: v.id("payments"),
    providerCheckoutId: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
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

    if (payment.paymentOrderId) {
      const paymentOrder = await ctx.db.get(payment.paymentOrderId);
      if (paymentOrder) {
        await ctx.db.patch(paymentOrder._id, {
          status: "checkout_pending",
          updatedAt: Date.now(),
          ...omitUndefined({
            latestCheckoutUrl: args.checkoutUrl ?? paymentOrder.latestCheckoutUrl,
            providerCheckoutId: args.providerCheckoutId ?? paymentOrder.providerCheckoutId,
            providerPaymentId: args.providerPaymentId ?? paymentOrder.providerPaymentId,
          }),
        });
        await upsertPaymentProviderLink(ctx, {
          paymentOrderId: paymentOrder._id,
          legacyPaymentId: payment._id,
          providerObjectType: "merchant_reference",
          providerObjectId: paymentOrder.correlationToken,
          correlationToken: paymentOrder.correlationToken,
        });
        await upsertPaymentProviderLink(ctx, {
          paymentOrderId: paymentOrder._id,
          legacyPaymentId: payment._id,
          providerObjectType: "checkout",
          providerObjectId: args.providerCheckoutId ?? payment.providerCheckoutId,
          correlationToken: paymentOrder.correlationToken,
        });
        await upsertPaymentProviderLink(ctx, {
          paymentOrderId: paymentOrder._id,
          legacyPaymentId: payment._id,
          providerObjectType: "payment",
          providerObjectId: args.providerPaymentId ?? payment.providerPaymentId,
          correlationToken: paymentOrder.correlationToken,
        });
      }
    }
  },
});

export const processRapydWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    providerCheckoutId: v.optional(v.string()),
    merchantReferenceId: v.optional(v.string()),
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
    const canonicalPayload = buildCanonicalRapydPayload(args.payload);
    const existingEvent = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existingEvent?.processed) {
      return { ignored: true, reason: "duplicate_event" as const };
    }

    const payment = await ctx.runQuery(
      internal.payments.getPaymentByProviderRefs,
      omitUndefined({
        providerPaymentId: args.providerPaymentId,
        providerCheckoutId: args.providerCheckoutId,
        merchantReferenceId: args.merchantReferenceId,
      }),
    );
    const now = Date.now();

    const eventId =
      existingEvent?._id ??
      (await ctx.db.insert("paymentEvents", {
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
      }));

    if (existingEvent) {
      await ctx.db.patch(eventId, {
        signatureValid: args.signatureValid,
        processed: false,
        payloadHash: args.payloadHash,
        payload: canonicalPayload,
        processingError: undefined,
        updatedAt: now,
        ...omitUndefined({
          eventType: args.eventType,
          paymentId: payment?._id,
          providerPaymentId: args.providerPaymentId,
          providerCheckoutId: args.providerCheckoutId,
          statusRaw: args.statusRaw,
        }),
      });
    }

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

export const finalizeChargeFromWebhook = internalMutation({
  args: {
    integrationEventId: v.id("integrationEvents"),
  },
  handler: async (
    ctx,
    { integrationEventId },
  ): Promise<
    | { ignored: true; reason: "integration_event_not_found" | "unsupported_integration_route" }
    | {
        ignored: boolean;
        reason?: "duplicate_event" | "invalid_signature" | "payment_not_found";
        processed?: boolean;
        eventId?: Id<"paymentEvents">;
        paymentId?: Id<"payments">;
      }
  > => {
    const integrationEvent = await ctx.db.get(integrationEventId);
    if (!integrationEvent) {
      return { ignored: true, reason: "integration_event_not_found" as const };
    }
    if (integrationEvent.provider !== "rapyd" || integrationEvent.route !== "payment") {
      return { ignored: true, reason: "unsupported_integration_route" as const };
    }

    const metadata =
      integrationEvent.metadata && typeof integrationEvent.metadata === "object"
        ? (integrationEvent.metadata as Record<string, unknown>)
        : {};
    const toOptionalString = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

    return await ctx.runMutation(internal.payments.processRapydWebhookEvent, {
      providerEventId: integrationEvent.providerEventId,
      signatureValid: integrationEvent.signatureValid,
      payloadHash: integrationEvent.payloadHash,
      payload: integrationEvent.payload,
      ...omitUndefined({
        eventType: integrationEvent.eventType,
        providerPaymentId: toOptionalString(metadata.providerPaymentId),
        providerCheckoutId: toOptionalString(metadata.providerCheckoutId),
        merchantReferenceId: toOptionalString(metadata.merchantReferenceId),
        statusRaw: toOptionalString(metadata.statusRaw),
      }),
    });
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    payoutReleaseMode: ReturnType<typeof readPayoutReleaseMode>;
    attemptedCount: number;
    scheduledCount: number;
    totalAmountAgorot: number;
    payoutScheduleIds: Id<"payoutSchedules">[];
  }> => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const kycApproved = await isInstructorKycApproved(ctx, user._id);
    if (!kycApproved) {
      throw new ConvexError(
        "Identity verification is required before payouts. Complete Didit verification first.",
      );
    }

    const destinations = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    const hasVerifiedDestination = destinations.some(
      (destination) => destination.status === "verified",
    );
    if (!hasVerifiedDestination) {
      throw new ConvexError(
        "No verified payout destination available. Add and verify a destination first.",
      );
    }

    const rawMaxPayments = Math.floor(args.maxPayments ?? 20);
    const maxPayments = Math.min(Math.max(rawMaxPayments, 1), 100);
    const relevantSchedules = await ctx.db
      .query("payoutSchedules")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
      .order("desc")
      .take(200);
    const availableSchedules = relevantSchedules
      .filter((schedule) => schedule.status === "available")
      .slice(0, maxPayments);

    const scheduleResult = await ctx.runMutation(internal.payouts.scheduleInstructorPayout, {
      instructorUserId: user._id,
      payoutPreference: "immediate_when_eligible",
    });

    let totalAmountAgorot = 0;
    for (const schedule of availableSchedules) {
      totalAmountAgorot += schedule.amountAgorot;
    }

    return {
      payoutReleaseMode: readPayoutReleaseMode(),
      attemptedCount: availableSchedules.length,
      scheduledCount: scheduleResult.scheduledCount,
      totalAmountAgorot,
      payoutScheduleIds: scheduleResult.payoutScheduleIds,
    };
  },
});

export const upsertMyPayoutPreference = mutation({
  args: {
    preferenceMode: v.union(
      v.literal("immediate_when_eligible"),
      v.literal("scheduled_date"),
      v.literal("manual_hold"),
    ),
    scheduledDate: v.optional(v.number()),
    destinationId: v.optional(v.id("payoutDestinations")),
  },
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const normalizedPreferenceMode = normalizePayoutPreferenceMode(args.preferenceMode);
    const now = Date.now();
    const scheduledDate =
      normalizedPreferenceMode === "scheduled_date" ? args.scheduledDate : undefined;

    if (normalizedPreferenceMode === "scheduled_date") {
      if (!Number.isFinite(scheduledDate) || !scheduledDate) {
        throw new ConvexError("A scheduled payout date is required");
      }
      if (scheduledDate <= now) {
        throw new ConvexError("Scheduled payout date must be in the future");
      }
    }

    if (args.destinationId) {
      const destination = await ctx.db.get(args.destinationId);
      if (!destination || destination.userId !== user._id) {
        throw new ConvexError("Payout destination not found");
      }
    }

    const existing = await ctx.db
      .query("payoutReleaseRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        preferenceMode: normalizedPreferenceMode,
        scheduledDate,
        destinationId: args.destinationId ?? existing.destinationId,
        updatedAt: now,
      });
      const updatedRule = await ctx.db.get(existing._id);

      if (normalizedPreferenceMode === "manual_hold") {
        const scheduledRows = await ctx.db
          .query("payoutSchedules")
          .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
          .order("desc")
          .take(200);
        await Promise.all(
          scheduledRows
            .filter((schedule) => schedule.status === "scheduled")
            .map((schedule) =>
              ctx.db.patch(schedule._id, {
                status: "available",
                readyAt: undefined,
                releaseAfter: undefined,
                failureReason: undefined,
                updatedAt: now,
              }),
            ),
        );
      } else {
        await ctx.runMutation(internal.payouts.scheduleInstructorPayout, {
          instructorUserId: user._id,
          payoutPreference: normalizedPreferenceMode,
          ...omitUndefined({
            scheduledDate,
          }),
        });
      }

      return updatedRule;
    }

    const ruleId = await ctx.db.insert(
      "payoutReleaseRules",
      omitUndefined({
        userId: user._id,
        preferenceMode: normalizedPreferenceMode,
        scheduledDate,
        destinationId: args.destinationId,
        createdAt: now,
        updatedAt: now,
      }) as any,
    );
    const createdRule = await ctx.db.get(ruleId);

    if (normalizedPreferenceMode !== "manual_hold") {
      await ctx.runMutation(internal.payouts.scheduleInstructorPayout, {
        instructorUserId: user._id,
        payoutPreference: normalizedPreferenceMode,
        ...omitUndefined({
          scheduledDate,
        }),
      });
    }

    return createdRule;
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
    await requireUserRole(ctx, ["instructor"]);
    normalizeRapydPayoutMethodType(args.type, "type");
    normalizeRapydExternalRecipientId(args.externalRecipientId, "externalRecipientId");
    if (args.country) {
      normalizeIsoCountryCode(args.country, "country");
    }
    if (args.currency) {
      normalizeCurrencyCode(args.currency, "currency");
    }
    throw new ConvexError(
      "Direct payout destination upserts are disabled. Use verified Rapyd beneficiary onboarding instead.",
    );
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
    statusRaw: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const canonicalPayload = buildCanonicalRapydPayload(args.payload);
    const existing = await ctx.db
      .query("payoutDestinationEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existing?.processed) {
      return { ignored: true, reason: "duplicate_event" as const };
    }

    const now = Date.now();
    const eventId =
      existing?._id ??
      (await ctx.db.insert("payoutDestinationEvents", {
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
      }));
    if (existing) {
      await ctx.db.patch(eventId, {
        signatureValid: args.signatureValid,
        processed: false,
        payloadHash: args.payloadHash,
        payload: canonicalPayload,
        processingError: undefined,
        updatedAt: now,
        ...omitUndefined({
          eventType: args.eventType,
          merchantReferenceId: args.merchantReferenceId,
          beneficiaryId: args.beneficiaryId,
          payoutMethodType: args.payoutMethodType,
        }),
      });
    }

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

    const onboardingState = resolveRapydBeneficiaryWebhookState(
      omitUndefined({
        eventType: args.eventType,
        statusRaw: args.statusRaw,
      }),
    );
    if (onboardingState !== "verified") {
      await ctx.db.patch(session._id, {
        ...(onboardingState === "pending"
          ? {}
          : {
              status: onboardingState,
              lastError:
                "Rapyd beneficiary webhook reported " +
                (args.statusRaw ?? args.eventType ?? "pending"),
            }),
        updatedAt: now,
      });
      await ctx.db.patch(eventId, {
        processingError: `beneficiary_${onboardingState}`,
        onboardingId: session._id,
        userId: session.userId,
        updatedAt: now,
      });
      return {
        ignored: false,
        processed: false,
        reason: `beneficiary_${onboardingState}` as const,
      };
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

    const beneficiaryId = normalizeRapydExternalRecipientId(args.beneficiaryId, "beneficiaryId");
    const payoutMethodType = normalizeRapydPayoutMethodType(
      args.payoutMethodType ??
        process.env.RAPYD_DEFAULT_BANK_PAYOUT_METHOD_TYPE ??
        "il_general_bank",
      "payoutMethodType",
    );

    const existingDestination = await ctx.db
      .query("payoutDestinations")
      .withIndex("by_user_provider_external", (q) =>
        q
          .eq("userId", session.userId)
          .eq("provider", RAPYD_PROVIDER)
          .eq("externalRecipientId", beneficiaryId),
      )
      .unique();

    let destinationId: Id<"payoutDestinations">;
    if (existingDestination) {
      destinationId = existingDestination._id;
      await ctx.db.patch(existingDestination._id, {
        railCategory: inferPayoutRailCategory(payoutMethodType),
        type: payoutMethodType,
        status: "verified",
        isDefault: true,
        country: session.beneficiaryCountry,
        currency: session.payoutCurrency,
        beneficiaryEntityType: session.beneficiaryEntityType,
        senderProfileId:
          process.env.RAPYD_MERCHANT_ID?.trim() || existingDestination.senderProfileId,
        verifiedAt: now,
        lastProviderSyncState: "verified",
        updatedAt: now,
      });
    } else {
      destinationId = await ctx.db.insert(
        "payoutDestinations",
        omitUndefined({
          userId: session.userId,
          provider: RAPYD_PROVIDER,
          railCategory: inferPayoutRailCategory(payoutMethodType),
          type: payoutMethodType,
          externalRecipientId: beneficiaryId,
          label: "Bank account",
          country: session.beneficiaryCountry,
          currency: session.payoutCurrency,
          isDefault: true,
          status: "verified" as const,
          beneficiaryEntityType: session.beneficiaryEntityType,
          senderProfileId: process.env.RAPYD_MERCHANT_ID?.trim() || undefined,
          verifiedAt: now,
          lastProviderSyncState: "verified" as const,
          createdAt: now,
          updatedAt: now,
        }) as any,
      );
    }

    await ctx.db.patch(session._id, {
      status: "completed",
      beneficiaryId,
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

    normalizeRapydPayoutMethodType(destination.type, "destination.type");
    normalizeRapydExternalRecipientId(
      destination.externalRecipientId,
      "destination.externalRecipientId",
    );
    if (destination.country) {
      normalizeIsoCountryCode(destination.country, "destination.country");
    }
    if (destination.currency) {
      normalizeCurrencyCode(destination.currency, "destination.currency");
    }

    await ctx.db.patch(destination._id, {
      status: "verified",
      verifiedAt: Date.now(),
      lastProviderSyncState: "verified",
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
