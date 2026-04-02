import { ConvexError } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getRapydEnvPresence,
  resolvePaymentsCurrency,
  resolveRapydMode,
} from "./integrations/rapyd/config";
import { requireCurrentUser, requireUserRole } from "./lib/auth";
import { resolveInternalAccessForUserId } from "./lib/internalAccess";
import { omitUndefined } from "./lib/validation";

const RAPYD_PROVIDER = "rapyd" as const;

type InvoiceStatus = "pending" | "issued" | "failed";

type InvoiceInput = {
  _id: Id<"invoices">;
  status: InvoiceStatus;
  externalInvoiceId?: string;
  externalInvoiceUrl?: string;
  issuedAt?: number;
} | null;

const MANUAL_PAYOUT_RELEASE_MODE = "manual";
const AUTOMATIC_PAYOUT_RELEASE_MODE = "automatic";
type PayoutReleaseMode = typeof MANUAL_PAYOUT_RELEASE_MODE | typeof AUTOMATIC_PAYOUT_RELEASE_MODE;
type PayoutSummaryAmounts = {
  currency: string;
  heldAmountAgorot: number;
  availableAmountAgorot: number;
  pendingAmountAgorot: number;
  paidAmountAgorot: number;
  attentionAmountAgorot: number;
  outstandingAmountAgorot: number;
  lifetimeEarnedAmountAgorot: number;
};

export const isSandboxMode = (): boolean => resolveRapydMode() !== "production";

export const isSandboxDestinationSelfVerifyEnabled = (): boolean =>
  isSandboxMode() && (process.env.ALLOW_SANDBOX_DESTINATION_SELF_VERIFY ?? "0").trim() === "1";

export const readPayoutReleaseMode = (): PayoutReleaseMode => {
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

function getUniqueIdsInOrder<T extends string>(ids: ReadonlyArray<T>) {
  return [...new Set(ids)];
}

async function sumInstructorLedgerBucket(
  ctx: QueryCtx,
  userId: Id<"users">,
  balanceBucket: Doc<"ledgerEntries">["balanceBucket"],
): Promise<number> {
  const entries = await ctx.db
    .query("ledgerEntries")
    .withIndex("by_instructor_bucket", (q) =>
      q.eq("instructorUserId", userId).eq("balanceBucket", balanceBucket),
    )
    .order("desc")
    .collect();

  return entries.reduce((total, entry) => total + entry.amountAgorot, 0);
}

async function readInstructorPayoutSummaryAmounts(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<PayoutSummaryAmounts> {
  const paymentOrders = await ctx.db
    .query("paymentOrders")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", userId))
    .order("desc")
    .collect();
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", userId))
    .order("desc")
    .collect();
  const payouts = await ctx.db
    .query("payouts")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", userId))
    .order("desc")
    .collect();
  const heldAmountAgorot = await sumInstructorLedgerBucket(ctx, userId, "instructor_held");
  const availableAmountAgorot = await sumInstructorLedgerBucket(
    ctx,
    userId,
    "instructor_available",
  );
  const pendingAmountAgorot = await sumInstructorLedgerBucket(ctx, userId, "instructor_reserved");
  const paidAmountAgorot = await sumInstructorLedgerBucket(ctx, userId, "instructor_paid");
  const adjustmentsAmountAgorot = await sumInstructorLedgerBucket(ctx, userId, "adjustments");

  const currency =
    paymentOrders[0]?.currency ?? payments[0]?.currency ?? process.env.PAYMENTS_CURRENCY ?? "ILS";

  if (paymentOrders.length > 0) {
    const outstandingAmountAgorot = Math.max(
      0,
      heldAmountAgorot + availableAmountAgorot + pendingAmountAgorot,
    );
    const lifetimeEarnedAmountAgorot = Math.max(0, paidAmountAgorot + outstandingAmountAgorot);

    return {
      currency,
      heldAmountAgorot: Math.max(0, heldAmountAgorot),
      availableAmountAgorot: Math.max(0, availableAmountAgorot),
      pendingAmountAgorot: Math.max(0, pendingAmountAgorot),
      paidAmountAgorot: Math.max(0, paidAmountAgorot),
      attentionAmountAgorot: Math.max(0, Math.abs(Math.min(adjustmentsAmountAgorot, 0))),
      outstandingAmountAgorot,
      lifetimeEarnedAmountAgorot,
    };
  }

  const latestPayoutByPaymentId = new Map<string, Doc<"payouts">>();
  for (const payout of payouts) {
    const key = String(payout.paymentId);
    if (!latestPayoutByPaymentId.has(key)) {
      latestPayoutByPaymentId.set(key, payout);
    }
  }

  let availableLegacyAmountAgorot = 0;
  let pendingLegacyAmountAgorot = 0;
  let paidLegacyAmountAgorot = 0;
  let attentionLegacyAmountAgorot = 0;

  for (const payment of payments) {
    if (payment.status !== "captured") {
      continue;
    }

    const latestPayout = latestPayoutByPaymentId.get(String(payment._id));
    if (!latestPayout) {
      availableLegacyAmountAgorot += payment.instructorBaseAmountAgorot;
      continue;
    }

    if (latestPayout.status === "paid") {
      paidLegacyAmountAgorot += latestPayout.amountAgorot;
      continue;
    }

    if (
      latestPayout.status === "queued" ||
      latestPayout.status === "processing" ||
      latestPayout.status === "pending_provider"
    ) {
      pendingLegacyAmountAgorot += latestPayout.amountAgorot;
      continue;
    }

    attentionLegacyAmountAgorot += latestPayout.amountAgorot;
  }

  const outstandingAmountAgorot = Math.max(
    0,
    availableLegacyAmountAgorot + pendingLegacyAmountAgorot,
  );

  return {
    currency,
    heldAmountAgorot: 0,
    availableAmountAgorot: availableLegacyAmountAgorot,
    pendingAmountAgorot: pendingLegacyAmountAgorot,
    paidAmountAgorot: paidLegacyAmountAgorot,
    attentionAmountAgorot: attentionLegacyAmountAgorot,
    outstandingAmountAgorot,
    lifetimeEarnedAmountAgorot: Math.max(0, paidLegacyAmountAgorot + outstandingAmountAgorot),
  };
}

export async function getMyInstructorPayoutSnapshotRead(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<PayoutSummaryAmounts> {
  return await readInstructorPayoutSummaryAmounts(ctx, userId);
}

async function loadPaymentListRelations(ctx: QueryCtx, payments: ReadonlyArray<Doc<"payments">>) {
  const jobIds = getUniqueIdsInOrder(payments.map((payment) => payment.jobId));
  const [jobs, payouts, invoices] = await Promise.all([
    Promise.all(jobIds.map((jobId) => ctx.db.get("jobs", jobId))),
    Promise.all(
      payments.map((payment) =>
        ctx.db
          .query("payouts")
          .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
          .order("desc")
          .first(),
      ),
    ),
    Promise.all(
      payments.map((payment) =>
        ctx.db
          .query("invoices")
          .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
          .order("desc")
          .first(),
      ),
    ),
  ]);

  const jobById = new Map<string, Doc<"jobs">>();
  for (let index = 0; index < jobIds.length; index += 1) {
    const jobId = jobIds[index];
    const job = jobs[index];
    if (job) {
      jobById.set(String(jobId), job);
    }
  }

  const latestPayoutByPaymentId = new Map<string, Doc<"payouts">>();
  for (let index = 0; index < payments.length; index += 1) {
    const payment = payments[index];
    const payout = payouts[index];
    if (payment && payout) {
      latestPayoutByPaymentId.set(String(payment._id), payout);
    }
  }

  const latestInvoiceByPaymentId = new Map<string, Exclude<InvoiceInput, null>>();
  for (let index = 0; index < payments.length; index += 1) {
    const payment = payments[index];
    const invoice = invoices[index];
    if (payment && invoice) {
      latestInvoiceByPaymentId.set(String(payment._id), invoice);
    }
  }

  return {
    jobById,
    latestPayoutByPaymentId,
    latestInvoiceByPaymentId,
  };
}

export const isInstructorKycApproved = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> => {
  const access = await resolveInternalAccessForUserId(ctx, userId);
  if (access.verificationBypass) {
    return true;
  }

  const profile = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
  if (!profile || profile.diditVerificationStatus !== "approved") {
    return false;
  }
  return Boolean(profile.diditLegalName?.trim());
};

export async function getCheckoutContextRead(ctx: QueryCtx, { jobId }: { jobId: Id<"jobs"> }) {
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
}

export function getPaymentIdFromMerchantReferenceId(
  merchantReferenceId: string | undefined,
): Id<"payments"> | undefined {
  const trimmed = merchantReferenceId?.trim();
  return trimmed ? (trimmed as Id<"payments">) : undefined;
}

export async function getPaymentByProviderRefsRead(
  ctx: QueryCtx,
  args: {
    providerPaymentId?: string;
    providerCheckoutId?: string;
    paymentId?: Id<"payments">;
    merchantReferenceId?: string;
  },
) {
  if (args.paymentId) {
    const direct = await ctx.db.get(args.paymentId);
    if (direct && direct.provider === RAPYD_PROVIDER) return direct;
  }
  const merchantReferencePaymentId = getPaymentIdFromMerchantReferenceId(args.merchantReferenceId);
  if (merchantReferencePaymentId) {
    const directFromMerchantReference = await ctx.db.get(merchantReferencePaymentId);
    if (directFromMerchantReference && directFromMerchantReference.provider === RAPYD_PROVIDER) {
      return directFromMerchantReference;
    }
  }
  const providerObjectCandidates = [
    args.providerPaymentId
      ? {
          providerObjectType: "payment" as const,
          providerObjectId: args.providerPaymentId,
        }
      : null,
    args.providerCheckoutId
      ? {
          providerObjectType: "checkout" as const,
          providerObjectId: args.providerCheckoutId,
        }
      : null,
    args.merchantReferenceId
      ? {
          providerObjectType: "merchant_reference" as const,
          providerObjectId: args.merchantReferenceId,
        }
      : null,
  ].filter((value): value is NonNullable<typeof value> => value !== null);

  for (const candidate of providerObjectCandidates) {
    const link = await ctx.db
      .query("paymentProviderLinks")
      .withIndex("by_provider_object", (q) =>
        q
          .eq("provider", RAPYD_PROVIDER)
          .eq("providerObjectType", candidate.providerObjectType)
          .eq("providerObjectId", candidate.providerObjectId),
      )
      .unique();
    if (link?.legacyPaymentId) {
      const payment = await ctx.db.get(link.legacyPaymentId);
      if (payment && payment.provider === RAPYD_PROVIDER) {
        return payment;
      }
    }
  }
  if (args.providerPaymentId) {
    const byPaymentId = await ctx.db
      .query("payments")
      .withIndex("by_provider_paymentId", (q) =>
        q.eq("provider", RAPYD_PROVIDER).eq("providerPaymentId", args.providerPaymentId as string),
      )
      .unique();
    if (byPaymentId) return byPaymentId;
  }
  if (args.providerCheckoutId) {
    return await ctx.db
      .query("payments")
      .withIndex("by_provider_checkoutId", (q) =>
        q
          .eq("provider", RAPYD_PROVIDER)
          .eq("providerCheckoutId", args.providerCheckoutId as string),
      )
      .unique();
  }
  return null;
}

export async function getOwnedStudioPaymentForReconciliationRead(
  ctx: QueryCtx,
  args: {
    paymentId: Id<"payments">;
    studioUserId: Id<"users">;
  },
) {
  const payment = await ctx.db.get(args.paymentId);
  if (!payment) return null;
  if (payment.provider !== RAPYD_PROVIDER || payment.studioUserId !== args.studioUserId) {
    return null;
  }
  return payment;
}

export async function listMyPaymentsRead(
  ctx: QueryCtx,
  args: {
    limit?: number;
  },
) {
  const user = await requireCurrentUser(ctx);
  const rawLimit = Math.floor(args.limit ?? 20);
  const limit = Math.min(Math.max(rawLimit, 1), 300);
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

  const { jobById, latestPayoutByPaymentId, latestInvoiceByPaymentId } =
    await loadPaymentListRelations(ctx, rows);

  return rows.map((payment) => {
    const payout = latestPayoutByPaymentId.get(String(payment._id));
    const job = jobById.get(String(payment.jobId));
    const invoice = latestInvoiceByPaymentId.get(String(payment._id)) ?? null;

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
  });
}

export async function getMyPaymentForJobRead(
  ctx: QueryCtx,
  args: {
    jobId: Id<"jobs">;
  },
) {
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
}

export async function getMyPaymentDetailRead(
  ctx: QueryCtx,
  args: {
    paymentId: Id<"payments">;
  },
) {
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
    payment: {
      _id: payment._id,
      status: payment.status,
      currency: payment.currency,
      studioChargeAmountAgorot: payment.studioChargeAmountAgorot,
      instructorBaseAmountAgorot: payment.instructorBaseAmountAgorot,
      platformMarkupAmountAgorot: payment.platformMarkupAmountAgorot,
      createdAt: payment.createdAt,
    },
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
}

export async function listMyPayoutDestinationsRead(ctx: QueryCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);
  return await ctx.db
    .query("payoutDestinations")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .order("desc")
    .collect();
}

export async function getMyPayoutSummaryRead(ctx: QueryCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);

  const amounts = await readInstructorPayoutSummaryAmounts(ctx, user._id);
  const payoutSchedules = await ctx.db
    .query("payoutSchedules")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
    .order("desc")
    .collect();
  const [payoutReleaseRule, destinations, onboardingSessions, kycApproved] = await Promise.all([
    ctx.db
      .query("payoutReleaseRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique(),
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

  let availablePaymentsCount = 0;
  let pendingPaymentsCount = 0;
  let paidPaymentsCount = 0;
  let attentionPaymentsCount = 0;

  const latestScheduleByOrderId = new Map<string, Doc<"payoutSchedules">>();
  for (const schedule of payoutSchedules) {
    const key = String(schedule.paymentOrderId);
    if (!latestScheduleByOrderId.has(key)) {
      latestScheduleByOrderId.set(key, schedule);
    }
  }

  for (const schedule of latestScheduleByOrderId.values()) {
    if (schedule.status === "available") {
      availablePaymentsCount += 1;
      continue;
    }
    if (
      schedule.status === "pending_eligibility" ||
      schedule.status === "blocked" ||
      schedule.status === "scheduled" ||
      schedule.status === "processing"
    ) {
      pendingPaymentsCount += 1;
      continue;
    }
    if (schedule.status === "paid") {
      paidPaymentsCount += 1;
      continue;
    }
    if (
      schedule.status === "failed" ||
      schedule.status === "needs_attention" ||
      schedule.status === "cancelled"
    ) {
      attentionPaymentsCount += 1;
    }
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
    payoutPreferenceMode: payoutReleaseRule?.preferenceMode ?? "immediate_when_eligible",
    payoutPreferenceScheduledDate: payoutReleaseRule?.scheduledDate ?? null,
    currency: amounts.currency,
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
    heldAmountAgorot: amounts.heldAmountAgorot,
    availableAmountAgorot: amounts.availableAmountAgorot,
    pendingAmountAgorot: amounts.pendingAmountAgorot,
    paidAmountAgorot: amounts.paidAmountAgorot,
    attentionAmountAgorot: amounts.attentionAmountAgorot,
    outstandingAmountAgorot: amounts.outstandingAmountAgorot,
    lifetimeEarnedAmountAgorot: amounts.lifetimeEarnedAmountAgorot,
    availablePaymentsCount,
    pendingPaymentsCount,
    paidPaymentsCount,
    attentionPaymentsCount,
    onboardingStatus: latestOnboardingSession?.status ?? null,
    onboardingUpdatedAt: latestOnboardingSession?.updatedAt ?? null,
    onboardingLastError: latestOnboardingSession?.lastError ?? null,
  };
}

export async function getMyPayoutOnboardingSessionRead(
  ctx: QueryCtx,
  args: {
    sessionId: Id<"payoutDestinationOnboarding">;
  },
) {
  const user = await requireUserRole(ctx, ["instructor"]);
  const session = await ctx.db.get(args.sessionId);
  if (!session || session.userId !== user._id) {
    throw new ConvexError("Onboarding session not found");
  }

  return {
    _id: session._id,
    status: session.status,
    redirectUrl: session.redirectUrl,
    beneficiaryId: session.beneficiaryId,
    payoutMethodType: session.payoutMethodType,
    lastError: session.lastError,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    createdAt: session.createdAt,
  };
}

export async function getPaymentForInvoicingRead(
  ctx: QueryCtx,
  { paymentId }: { paymentId: Id<"payments"> },
) {
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
}

export async function getPaymentsPreflightRead(ctx: QueryCtx) {
  await requireCurrentUser(ctx);

  const requiredInvoice = ["INVOICE_PROVIDER"] as const;

  const rapydStatus = getRapydEnvPresence();
  const invoice = Object.fromEntries(
    requiredInvoice.map((name) => [name, Boolean(process.env[name]?.trim())]),
  ) as Record<(typeof requiredInvoice)[number], boolean>;

  return {
    mode: rapydStatus.mode,
    payoutReleaseMode: readPayoutReleaseMode(),
    currency: resolvePaymentsCurrency(),
    webhookMaxSkewSeconds: Number.parseInt(
      (process.env.RAPYD_WEBHOOK_MAX_SKEW_SECONDS ?? "300").trim(),
      10,
    ),
    rapyd: rapydStatus.rapyd,
    rapydOnboarding: rapydStatus.rapydOptional,
    effectiveBaseUrlEnvName: rapydStatus.effectiveBaseUrlEnvName,
    hasExplicitWebhookSecret: rapydStatus.hasExplicitWebhookSecret,
    readyForOnboarding: rapydStatus.readyForOnboarding,
    readyForPayouts: rapydStatus.readyForPayouts,
    invoice,
    readyForCheckout: rapydStatus.readyForCheckout,
    readyForInvoicing: Object.values(invoice).every(Boolean),
  };
}
