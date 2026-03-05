import { ConvexError } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCurrentUser, requireUserRole } from "./lib/auth";
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

export const isSandboxMode = (): boolean =>
  (process.env.RAPYD_MODE ?? "sandbox").trim().toLowerCase() !== "production";

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

export const isInstructorKycApproved = async (
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
  const paymentIdFromMerchantReference = getPaymentIdFromMerchantReferenceId(
    args.merchantReferenceId,
  );
  if (paymentIdFromMerchantReference) {
    const byMerchantReference = await ctx.db.get(paymentIdFromMerchantReference);
    if (byMerchantReference && byMerchantReference.provider === RAPYD_PROVIDER) {
      return byMerchantReference;
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
}
