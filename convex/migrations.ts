import { v } from "convex/values";

import { ZONE_OPTIONS } from "../src/constants/zones.generated";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { dedupeUsersByEmail, normalizeEmail, resolveCanonicalUserByEmail } from "./lib/authDedupe";
import { isKnownZoneId } from "./lib/domainValidation";
import {
  syncInstructorGeospatialCoverage,
  syncStudioBranchGeospatialLocation,
} from "./lib/geospatial";
import { safeH3Index } from "./lib/h3";
import { diditVerificationStatusValidator } from "./lib/instructorCompliance";
import { mapLegacyPaymentStatusToOrderStatus, summarizeLedgerBalances } from "./lib/marketplace";
import { ensureStudioInfrastructure } from "./lib/studioBranches";
import { generateUniqueInstructorSlug, generateUniqueStudioSlug } from "./lib/slug";
import { omitUndefined } from "./lib/validation";

const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 500;
const DEFAULT_FINANCE_BACKFILL_BATCH_SIZE = 100;
const MAX_FINANCE_BACKFILL_BATCH_SIZE = 250;

type DiditBackfillBatchPageItem = {
  instructorId: Id<"instructorProfiles">;
  diditSessionId?: string;
  diditVerificationStatus?:
    | "not_started"
    | "in_progress"
    | "pending"
    | "in_review"
    | "approved"
    | "declined"
    | "abandoned"
    | "expired";
  diditStatusRaw?: string;
  diditDecision?: any;
};

type DiditBackfillBatchResult = {
  page: DiditBackfillBatchPageItem[];
  isDone: boolean;
  continueCursor: string;
};

type MarketplaceFinanceBackfillResult = {
  scanned: number;
  paymentOrdersCreated: number;
  paymentsLinked: number;
  paymentProviderLinksCreated: number;
  payoutSchedulesCreated: number;
  payoutsLinked: number;
  payoutProviderLinksCreated: number;
  ledgerEntriesInserted: number;
  paymentsWithMultiplePayouts: number;
  hasMore: boolean;
  continueCursor?: string;
};

type DevelopmentResetResult = {
  tablesCleared: number;
  deletedDocuments: number;
  deletedByTable: Array<{
    table: string;
    deleted: number;
  }>;
};

const appRoleValidator = v.union(v.literal("instructor"), v.literal("studio"));
const duplicateUserEmailReportEntryValidator = v.object({
  email: v.string(),
  userCount: v.number(),
  canonicalUserId: v.optional(v.id("users")),
  users: v.array(
    v.object({
      userId: v.id("users"),
      role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
      roles: v.array(appRoleValidator),
      onboardingComplete: v.boolean(),
      isActive: v.boolean(),
      emailVerified: v.boolean(),
      hasInstructorProfile: v.boolean(),
      hasStudioProfile: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
});
const authEmailLinkStateEntryValidator = v.object({
  userId: v.id("users"),
  provider: v.string(),
  providerAccountId: v.string(),
  userEmail: v.optional(v.string()),
  role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
  onboardingComplete: v.boolean(),
  isActive: v.boolean(),
  emailVerified: v.boolean(),
  hasInstructorProfile: v.boolean(),
  hasStudioProfile: v.boolean(),
});

type DuplicateUserEmailReportEntry = {
  email: string;
  userCount: number;
  canonicalUserId?: Id<"users">;
  users: Array<{
    userId: Id<"users">;
    role: "pending" | "instructor" | "studio";
    roles: Array<"instructor" | "studio">;
    onboardingComplete: boolean;
    isActive: boolean;
    emailVerified: boolean;
    hasInstructorProfile: boolean;
    hasStudioProfile: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
};

type AuthEmailLinkStateEntry = {
  userId: Id<"users">;
  provider: string;
  providerAccountId: string;
  userEmail?: string;
  role: "pending" | "instructor" | "studio";
  onboardingComplete: boolean;
  isActive: boolean;
  emailVerified: boolean;
  hasInstructorProfile: boolean;
  hasStudioProfile: boolean;
};

function isDuplicateUserEmailReportEntry(
  entry: DuplicateUserEmailReportEntry | null,
): entry is DuplicateUserEmailReportEntry {
  return entry !== null;
}

function toCleanZone(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

const LEGACY_ZONE_TO_ID = new Map<string, string>(
  ZONE_OPTIONS.flatMap((zone) => [
    [zone.id.toLowerCase(), zone.id] as const,
    [zone.label.en.trim().toLowerCase(), zone.id] as const,
    [zone.label.he.trim().toLowerCase(), zone.id] as const,
  ]),
);

function resolveZoneId(value: string | undefined): string | undefined {
  const cleaned = toCleanZone(value);
  if (!cleaned) return undefined;
  if (isKnownZoneId(cleaned)) return cleaned;
  return LEGACY_ZONE_TO_ID.get(cleaned.toLowerCase());
}

async function resolveUserProfileState(ctx: QueryCtx, userId: Id<"users">) {
  const [instructorProfile, studioProfile] = await Promise.all([
    ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique(),
    ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique(),
  ]);

  return {
    hasInstructorProfile: instructorProfile !== null,
    hasStudioProfile: studioProfile !== null,
  };
}

const MIGRATIONS_ACCESS_TOKEN_ENV = "MIGRATIONS_ACCESS_TOKEN";
const DEVELOPMENT_RESET_CONFIRMATION = "DELETE_ALL_DEV_DATA";
const EMAIL_AUTH_PROVIDER_IDS = ["resend", "resend-otp"] as const;
const DEVELOPMENT_RESET_TABLES = [
  "authAccounts",
  "authRateLimits",
  "authRefreshTokens",
  "authSessions",
  "authVerificationCodes",
  "authVerifiers",
  "calendarEventMappings",
  "calendarExternalEvents",
  "calendarIntegrations",
  "diditEvents",
  "instructorCoverage",
  "instructorGeoCoverage",
  "instructorProfiles",
  "instructorSports",
  "instructorZones",
  "integrationEvents",
  "invoices",
  "jobApplicationStats",
  "jobApplications",
  "jobs",
  "ledgerEntries",
  "notificationLog",
  "paymentEvents",
  "paymentOrders",
  "paymentProviderLinks",
  "payments",
  "payoutDestinationEvents",
  "payoutDestinationOnboarding",
  "payoutDestinations",
  "payoutEvents",
  "payoutProviderLinks",
  "payoutReleaseRules",
  "payoutSchedules",
  "payouts",
  "profileImageUploadSessions",
  "providerMethodCache",
  "studioProfiles",
  "studioBranches",
  "studioMemberships",
  "studioEntitlements",
  "studioSports",
  "userNotifications",
  "users",
  "webhookDeliveries",
  "webhookInvalidSignatureThrottle",
] as const;

export function isValidMigrationsAccessToken(accessToken: string | undefined): boolean {
  const expected = process.env[MIGRATIONS_ACCESS_TOKEN_ENV]?.trim();
  return Boolean(expected) && accessToken?.trim() === expected;
}

function requireMigrationsAccessToken(accessToken: string | undefined) {
  if (!isValidMigrationsAccessToken(accessToken)) {
    throw new Error(
      "Unauthorized migration operation. Set MIGRATIONS_ACCESS_TOKEN and pass accessToken.",
    );
  }
}

async function deleteAllRowsInTable(ctx: MutationCtx, table: string) {
  const rows = await ((ctx.db as any).query(table) as any).collect();
  await Promise.all(rows.map((row: { _id: string }) => ctx.db.delete(row._id as any)));
  return rows.length;
}

function getFinanceBackfillBatchSize(batchSize: number | undefined) {
  return Math.min(
    Math.max(Math.floor(batchSize ?? DEFAULT_FINANCE_BACKFILL_BATCH_SIZE), 1),
    MAX_FINANCE_BACKFILL_BATCH_SIZE,
  );
}

function buildLegacyPaymentOrderCorrelationToken(paymentId: Id<"payments">) {
  return `legacy-payment:${String(paymentId)}`;
}

function isInstructorKycApprovedForMigration(
  profile: Pick<Doc<"instructorProfiles">, "diditVerificationStatus" | "diditLegalName"> | null,
) {
  return profile?.diditVerificationStatus === "approved" && Boolean(profile.diditLegalName?.trim());
}

async function insertMarketplaceLedgerEntryIfMissing(
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
    return { created: false, id: existing._id };
  }

  const id = await ctx.db.insert(
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
    }) as Doc<"ledgerEntries">,
  );
  return { created: true, id };
}

async function upsertPaymentProviderLinkForMigration(
  ctx: MutationCtx,
  args: {
    paymentOrderId: Id<"paymentOrders">;
    legacyPaymentId: Id<"payments">;
    providerObjectType: "merchant_reference" | "checkout" | "payment";
    providerObjectId: string | undefined;
    correlationToken: string | undefined;
  },
) {
  const providerObjectId = args.providerObjectId?.trim();
  if (!providerObjectId) {
    return false;
  }

  const existing = await ctx.db
    .query("paymentProviderLinks")
    .withIndex("by_provider_object", (q: any) =>
      q
        .eq("provider", "rapyd")
        .eq("providerObjectType", args.providerObjectType)
        .eq("providerObjectId", providerObjectId),
    )
    .unique();
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      paymentOrderId: args.paymentOrderId,
      legacyPaymentId: args.legacyPaymentId,
      correlationToken: args.correlationToken ?? existing.correlationToken,
      updatedAt: now,
    });
    return false;
  }

  await ctx.db.insert(
    "paymentProviderLinks",
    omitUndefined({
      provider: "rapyd",
      paymentOrderId: args.paymentOrderId,
      legacyPaymentId: args.legacyPaymentId,
      providerObjectType: args.providerObjectType,
      providerObjectId,
      correlationToken: args.correlationToken,
      createdAt: now,
      updatedAt: now,
    }) as Doc<"paymentProviderLinks">,
  );
  return true;
}

async function upsertPayoutProviderLinkForMigration(
  ctx: MutationCtx,
  args: {
    payoutScheduleId: Id<"payoutSchedules">;
    payoutId: Id<"payouts">;
    merchantReferenceId: string;
    providerPayoutId: string | undefined;
    correlationToken: string | undefined;
  },
) {
  const existing =
    (await ctx.db
      .query("payoutProviderLinks")
      .withIndex("by_payout", (q: any) => q.eq("payoutId", args.payoutId))
      .order("desc")
      .first()) ??
    (await ctx.db
      .query("payoutProviderLinks")
      .withIndex("by_merchant_reference", (q: any) =>
        q.eq("provider", "rapyd").eq("merchantReferenceId", args.merchantReferenceId),
      )
      .unique());
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      payoutScheduleId: args.payoutScheduleId,
      payoutId: args.payoutId,
      providerPayoutId: args.providerPayoutId ?? existing.providerPayoutId,
      correlationToken: args.correlationToken ?? existing.correlationToken,
      updatedAt: now,
    });
    return false;
  }

  await ctx.db.insert(
    "payoutProviderLinks",
    omitUndefined({
      provider: "rapyd",
      payoutScheduleId: args.payoutScheduleId,
      payoutId: args.payoutId,
      providerPayoutId: args.providerPayoutId,
      merchantReferenceId: args.merchantReferenceId,
      correlationToken: args.correlationToken,
      createdAt: now,
      updatedAt: now,
    }) as Doc<"payoutProviderLinks">,
  );
  return true;
}

function mapLegacyPayoutToScheduleStatus(
  status: Doc<"payouts">["status"],
): Doc<"payoutSchedules">["status"] {
  switch (status) {
    case "queued":
      return "scheduled";
    case "processing":
    case "pending_provider":
      return "processing";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "needs_attention";
  }
}

async function ensurePaymentOrderForLegacyPayment(ctx: MutationCtx, payment: Doc<"payments">) {
  const legacyCorrelationToken = buildLegacyPaymentOrderCorrelationToken(payment._id);
  let paymentOrder =
    (payment.paymentOrderId ? await ctx.db.get(payment.paymentOrderId) : null) ?? null;

  if (!paymentOrder) {
    const providerLink = await ctx.db
      .query("paymentProviderLinks")
      .withIndex("by_legacy_payment", (q: any) => q.eq("legacyPaymentId", payment._id))
      .order("desc")
      .first();
    paymentOrder = providerLink ? ((await ctx.db.get(providerLink.paymentOrderId)) ?? null) : null;
  }

  if (!paymentOrder) {
    paymentOrder =
      (await ctx.db
        .query("paymentOrders")
        .withIndex("by_correlation_token", (q: any) =>
          q.eq("correlationToken", legacyCorrelationToken),
        )
        .unique()) ?? null;
  }

  const now = Date.now();
  const paymentOrderPatch = omitUndefined({
    jobId: payment.jobId,
    studioId: payment.studioId,
    studioUserId: payment.studioUserId,
    instructorId: payment.instructorId,
    instructorUserId: payment.instructorUserId,
    provider: payment.provider,
    status: mapLegacyPaymentStatusToOrderStatus(payment.status),
    currency: payment.currency,
    instructorGrossAmountAgorot: payment.instructorBaseAmountAgorot,
    platformFeeAmountAgorot: payment.platformMarkupAmountAgorot,
    studioChargeAmountAgorot: payment.studioChargeAmountAgorot,
    platformFeeBps: payment.platformMarkupBps,
    providerCheckoutId: payment.providerCheckoutId,
    providerPaymentId: payment.providerPaymentId,
    latestError: payment.lastError,
    capturedAt:
      payment.status === "captured" || payment.status === "refunded"
        ? (payment.capturedAt ?? payment.updatedAt ?? payment.createdAt)
        : undefined,
    updatedAt: now,
  });

  let created = false;
  if (!paymentOrder) {
    const paymentOrderId = await ctx.db.insert(
      "paymentOrders",
      omitUndefined({
        jobId: payment.jobId,
        studioId: payment.studioId,
        studioUserId: payment.studioUserId,
        provider: payment.provider,
        correlationToken: legacyCorrelationToken,
        status: mapLegacyPaymentStatusToOrderStatus(payment.status),
        currency: payment.currency,
        instructorGrossAmountAgorot: payment.instructorBaseAmountAgorot,
        platformFeeAmountAgorot: payment.platformMarkupAmountAgorot,
        studioChargeAmountAgorot: payment.studioChargeAmountAgorot,
        platformFeeBps: payment.platformMarkupBps,
        providerCheckoutId: payment.providerCheckoutId,
        providerPaymentId: payment.providerPaymentId,
        latestError: payment.lastError,
        capturedAt:
          payment.status === "captured" || payment.status === "refunded"
            ? (payment.capturedAt ?? payment.updatedAt ?? payment.createdAt)
            : undefined,
        createdAt: payment.createdAt,
        updatedAt: now,
        instructorId: payment.instructorId,
        instructorUserId: payment.instructorUserId,
      }) as Doc<"paymentOrders">,
    );
    paymentOrder = await ctx.db.get(paymentOrderId);
    created = true;
  } else {
    await ctx.db.patch(paymentOrder._id, paymentOrderPatch);
    paymentOrder = await ctx.db.get(paymentOrder._id);
  }

  if (!paymentOrder) {
    throw new Error(`Failed to ensure payment order for ${String(payment._id)}`);
  }

  let paymentLinked = false;
  if (payment.paymentOrderId !== paymentOrder._id) {
    await ctx.db.patch(payment._id, {
      paymentOrderId: paymentOrder._id,
      updatedAt: now,
    });
    paymentLinked = true;
  }

  return { paymentOrder, created, paymentLinked };
}

async function ensureReleaseLedgerForPaymentOrder(
  ctx: MutationCtx,
  args: {
    payment: Doc<"payments">;
    paymentOrder: Doc<"paymentOrders">;
    shouldRelease: boolean;
    releaseReferenceType: Doc<"ledgerEntries">["referenceType"];
    releaseReferenceId: string;
    releaseAt: number;
  },
) {
  if (
    !args.shouldRelease ||
    !args.paymentOrder.instructorId ||
    !args.paymentOrder.instructorUserId ||
    args.paymentOrder.instructorGrossAmountAgorot <= 0
  ) {
    return { ledgerEntriesInserted: 0, releasedNow: false };
  }

  let ledgerEntriesInserted = 0;
  const heldEntry = await insertMarketplaceLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.paymentOrder.instructorUserId,
    payoutScheduleId: undefined,
    payoutId: undefined,
    dedupeKey: `release:${args.paymentOrder._id}:held`,
    entryType: "adjustment",
    balanceBucket: "instructor_held",
    amountAgorot: -args.paymentOrder.instructorGrossAmountAgorot,
    currency: args.paymentOrder.currency,
    referenceType: args.releaseReferenceType,
    referenceId: args.releaseReferenceId,
    createdAt: args.releaseAt,
  });
  if (heldEntry.created) {
    ledgerEntriesInserted += 1;
  }
  const availableEntry = await insertMarketplaceLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.paymentOrder.instructorUserId,
    payoutScheduleId: undefined,
    payoutId: undefined,
    dedupeKey: `release:${args.paymentOrder._id}:available`,
    entryType: "adjustment",
    balanceBucket: "instructor_available",
    amountAgorot: args.paymentOrder.instructorGrossAmountAgorot,
    currency: args.paymentOrder.currency,
    referenceType: args.releaseReferenceType,
    referenceId: args.releaseReferenceId,
    createdAt: args.releaseAt,
  });
  if (availableEntry.created) {
    ledgerEntriesInserted += 1;
  }

  if (!args.paymentOrder.releasedAt) {
    await ctx.db.patch(args.paymentOrder._id, {
      releasedAt: args.releaseAt,
      updatedAt: Date.now(),
    });
  }

  return {
    ledgerEntriesInserted,
    releasedNow: heldEntry.created || availableEntry.created,
  };
}

async function ensureRefundLedgerForPaymentOrder(
  ctx: MutationCtx,
  args: {
    payment: Doc<"payments">;
    paymentOrder: Doc<"paymentOrders">;
  },
) {
  if (args.payment.status !== "refunded") {
    return 0;
  }

  const existingEntries = await ctx.db
    .query("ledgerEntries")
    .withIndex("by_payment_order", (q: any) => q.eq("paymentOrderId", args.paymentOrder._id))
    .collect();
  const balances = summarizeLedgerBalances(existingEntries);
  const instructorRefundBucket =
    balances.instructor_available > 0
      ? "instructor_available"
      : balances.instructor_held > 0
        ? "instructor_held"
        : "adjustments";
  const refundAt = args.payment.updatedAt ?? args.payment.capturedAt ?? args.payment.createdAt;

  let ledgerEntriesInserted = 0;
  const grossRefund = await insertMarketplaceLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.paymentOrder.instructorUserId,
    payoutScheduleId: undefined,
    payoutId: undefined,
    dedupeKey: `refund:${args.paymentOrder._id}:gross`,
    entryType: "refund",
    balanceBucket: "provider_clearing",
    amountAgorot: -args.paymentOrder.studioChargeAmountAgorot,
    currency: args.paymentOrder.currency,
    referenceType: "refund",
    referenceId: String(args.paymentOrder._id),
    createdAt: refundAt,
  });
  if (grossRefund.created) {
    ledgerEntriesInserted += 1;
  }
  const feeRefund = await insertMarketplaceLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.paymentOrder.instructorUserId,
    payoutScheduleId: undefined,
    payoutId: undefined,
    dedupeKey: `refund:${args.paymentOrder._id}:platform_fee`,
    entryType: "refund_fee_impact",
    balanceBucket: "platform_available",
    amountAgorot: -args.paymentOrder.platformFeeAmountAgorot,
    currency: args.paymentOrder.currency,
    referenceType: "refund",
    referenceId: String(args.paymentOrder._id),
    createdAt: refundAt,
  });
  if (feeRefund.created) {
    ledgerEntriesInserted += 1;
  }
  const instructorRefund = await insertMarketplaceLedgerEntryIfMissing(ctx, {
    paymentOrderId: args.paymentOrder._id,
    jobId: args.paymentOrder.jobId,
    studioUserId: args.paymentOrder.studioUserId,
    instructorUserId: args.paymentOrder.instructorUserId,
    payoutScheduleId: undefined,
    payoutId: undefined,
    dedupeKey: `refund:${args.paymentOrder._id}:instructor`,
    entryType: "adjustment",
    balanceBucket: instructorRefundBucket,
    amountAgorot: -args.paymentOrder.instructorGrossAmountAgorot,
    currency: args.paymentOrder.currency,
    referenceType: "refund",
    referenceId: String(args.paymentOrder._id),
    createdAt: refundAt,
  });
  if (instructorRefund.created) {
    ledgerEntriesInserted += 1;
  }

  return ledgerEntriesInserted;
}

export const getMarketplaceFinanceBackfillReport = query({
  args: {
    sampleLimit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    paymentsTotal: v.number(),
    paymentsMissingPaymentOrder: v.number(),
    paymentsMissingProviderLinks: v.number(),
    capturedOrRefundedPaymentsMissingLedger: v.number(),
    capturedOrRefundedPaymentsMissingSchedule: v.number(),
    paymentsWithMultiplePayouts: v.number(),
    payoutsTotal: v.number(),
    payoutsMissingBackfillLinks: v.number(),
    samplePaymentIdsMissingOrder: v.array(v.id("payments")),
    samplePaymentIdsMissingLedger: v.array(v.id("payments")),
    samplePayoutIdsMissingLinks: v.array(v.id("payouts")),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const sampleLimit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 100);

    const [
      payments,
      paymentProviderLinks,
      ledgerEntries,
      payoutSchedules,
      payouts,
      payoutProviderLinks,
    ] = await Promise.all([
      ctx.db.query("payments").collect(),
      ctx.db.query("paymentProviderLinks").collect(),
      ctx.db.query("ledgerEntries").collect(),
      ctx.db.query("payoutSchedules").collect(),
      ctx.db.query("payouts").collect(),
      ctx.db.query("payoutProviderLinks").collect(),
    ]);

    const paymentOrderIdsWithLedger = new Set(
      ledgerEntries.map((entry) => String(entry.paymentOrderId)),
    );
    const paymentOrderIdsWithSchedules = new Set(
      payoutSchedules.map((schedule) => String(schedule.paymentOrderId)),
    );
    const legacyPaymentLinkIds = new Set(
      paymentProviderLinks
        .filter((link) => Boolean(link.legacyPaymentId))
        .map((link) => String(link.legacyPaymentId)),
    );
    const payoutIdsWithLinks = new Set(
      payoutProviderLinks
        .filter((link) => Boolean(link.payoutId))
        .map((link) => String(link.payoutId)),
    );
    const payoutCountByPaymentId = new Map<string, number>();

    for (const payout of payouts) {
      const key = String(payout.paymentId);
      payoutCountByPaymentId.set(key, (payoutCountByPaymentId.get(key) ?? 0) + 1);
    }

    let paymentsMissingPaymentOrder = 0;
    let paymentsMissingProviderLinks = 0;
    let capturedOrRefundedPaymentsMissingLedger = 0;
    let capturedOrRefundedPaymentsMissingSchedule = 0;
    let paymentsWithMultiplePayouts = 0;
    const samplePaymentIdsMissingOrder: Id<"payments">[] = [];
    const samplePaymentIdsMissingLedger: Id<"payments">[] = [];

    for (const payment of payments) {
      const hasOrder = Boolean(payment.paymentOrderId);
      const hasLegacyLink = legacyPaymentLinkIds.has(String(payment._id));
      const linkedOrderId = payment.paymentOrderId ? String(payment.paymentOrderId) : undefined;
      const capturedOrRefunded = payment.status === "captured" || payment.status === "refunded";

      if (!hasOrder) {
        paymentsMissingPaymentOrder += 1;
        if (samplePaymentIdsMissingOrder.length < sampleLimit) {
          samplePaymentIdsMissingOrder.push(payment._id);
        }
      }
      if (!hasLegacyLink) {
        paymentsMissingProviderLinks += 1;
      }
      if (capturedOrRefunded && (!linkedOrderId || !paymentOrderIdsWithLedger.has(linkedOrderId))) {
        capturedOrRefundedPaymentsMissingLedger += 1;
        if (samplePaymentIdsMissingLedger.length < sampleLimit) {
          samplePaymentIdsMissingLedger.push(payment._id);
        }
      }
      if (
        capturedOrRefunded &&
        payment.instructorUserId &&
        (!linkedOrderId || !paymentOrderIdsWithSchedules.has(linkedOrderId))
      ) {
        capturedOrRefundedPaymentsMissingSchedule += 1;
      }
      if ((payoutCountByPaymentId.get(String(payment._id)) ?? 0) > 1) {
        paymentsWithMultiplePayouts += 1;
      }
    }

    let payoutsMissingBackfillLinks = 0;
    const samplePayoutIdsMissingLinks: Id<"payouts">[] = [];
    for (const payout of payouts) {
      if (
        !payout.paymentOrderId ||
        !payout.payoutScheduleId ||
        !payoutIdsWithLinks.has(String(payout._id))
      ) {
        payoutsMissingBackfillLinks += 1;
        if (samplePayoutIdsMissingLinks.length < sampleLimit) {
          samplePayoutIdsMissingLinks.push(payout._id);
        }
      }
    }

    return {
      paymentsTotal: payments.length,
      paymentsMissingPaymentOrder,
      paymentsMissingProviderLinks,
      capturedOrRefundedPaymentsMissingLedger,
      capturedOrRefundedPaymentsMissingSchedule,
      paymentsWithMultiplePayouts,
      payoutsTotal: payouts.length,
      payoutsMissingBackfillLinks,
      samplePaymentIdsMissingOrder,
      samplePaymentIdsMissingLedger,
      samplePayoutIdsMissingLinks,
    };
  },
});

export const backfillMarketplaceFinance = action({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    paymentOrdersCreated: v.number(),
    paymentsLinked: v.number(),
    paymentProviderLinksCreated: v.number(),
    payoutSchedulesCreated: v.number(),
    payoutsLinked: v.number(),
    payoutProviderLinksCreated: v.number(),
    ledgerEntriesInserted: v.number(),
    paymentsWithMultiplePayouts: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<MarketplaceFinanceBackfillResult> => {
    requireMigrationsAccessToken(args.accessToken);
    const result = await ctx.runMutation(
      internal.migrations.backfillMarketplaceFinanceBatch as any,
      omitUndefined({
        cursor: args.cursor,
        batchSize: args.batchSize,
      }),
    );
    return result as MarketplaceFinanceBackfillResult;
  },
});

export const backfillMarketplaceFinanceBatch = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    paymentOrdersCreated: v.number(),
    paymentsLinked: v.number(),
    paymentProviderLinksCreated: v.number(),
    payoutSchedulesCreated: v.number(),
    payoutsLinked: v.number(),
    payoutProviderLinksCreated: v.number(),
    ledgerEntriesInserted: v.number(),
    paymentsWithMultiplePayouts: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = getFinanceBackfillBatchSize(args.batchSize);
    const page = await ctx.db
      .query("payments")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let paymentOrdersCreated = 0;
    let paymentsLinked = 0;
    let paymentProviderLinksCreated = 0;
    let payoutSchedulesCreated = 0;
    let payoutsLinked = 0;
    let payoutProviderLinksCreated = 0;
    let ledgerEntriesInserted = 0;
    let paymentsWithMultiplePayouts = 0;

    for (const payment of page.page) {
      const { paymentOrder, created, paymentLinked } = await ensurePaymentOrderForLegacyPayment(
        ctx,
        payment,
      );
      if (created) {
        paymentOrdersCreated += 1;
      }
      if (paymentLinked) {
        paymentsLinked += 1;
      }

      if (
        await upsertPaymentProviderLinkForMigration(ctx, {
          paymentOrderId: paymentOrder._id,
          legacyPaymentId: payment._id,
          providerObjectType: "merchant_reference",
          providerObjectId: String(payment._id),
          correlationToken: paymentOrder.correlationToken,
        })
      ) {
        paymentProviderLinksCreated += 1;
      }
      if (
        await upsertPaymentProviderLinkForMigration(ctx, {
          paymentOrderId: paymentOrder._id,
          legacyPaymentId: payment._id,
          providerObjectType: "checkout",
          providerObjectId: payment.providerCheckoutId,
          correlationToken: paymentOrder.correlationToken,
        })
      ) {
        paymentProviderLinksCreated += 1;
      }
      if (
        await upsertPaymentProviderLinkForMigration(ctx, {
          paymentOrderId: paymentOrder._id,
          legacyPaymentId: payment._id,
          providerObjectType: "payment",
          providerObjectId: payment.providerPaymentId,
          correlationToken: paymentOrder.correlationToken,
        })
      ) {
        paymentProviderLinksCreated += 1;
      }

      const capturedAt = payment.capturedAt ?? payment.updatedAt ?? payment.createdAt;
      if (payment.status === "captured" || payment.status === "refunded") {
        const captureGross = await insertMarketplaceLedgerEntryIfMissing(ctx, {
          paymentOrderId: paymentOrder._id,
          jobId: paymentOrder.jobId,
          studioUserId: paymentOrder.studioUserId,
          instructorUserId: paymentOrder.instructorUserId,
          payoutScheduleId: undefined,
          payoutId: undefined,
          dedupeKey: `capture:${paymentOrder._id}:gross`,
          entryType: "charge_gross",
          balanceBucket: "provider_clearing",
          amountAgorot: paymentOrder.studioChargeAmountAgorot,
          currency: paymentOrder.currency,
          referenceType: "payment_order",
          referenceId: String(paymentOrder._id),
          createdAt: capturedAt,
        });
        if (captureGross.created) {
          ledgerEntriesInserted += 1;
        }
        const captureFee = await insertMarketplaceLedgerEntryIfMissing(ctx, {
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
          createdAt: capturedAt,
        });
        if (captureFee.created) {
          ledgerEntriesInserted += 1;
        }
        const captureInstructor = await insertMarketplaceLedgerEntryIfMissing(ctx, {
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
          createdAt: capturedAt,
        });
        if (captureInstructor.created) {
          ledgerEntriesInserted += 1;
        }
      }

      const [job, instructorProfile, legacyPayouts] = await Promise.all([
        ctx.db.get(payment.jobId),
        payment.instructorId ? ctx.db.get(payment.instructorId) : Promise.resolve(null),
        ctx.db
          .query("payouts")
          .withIndex("by_payment", (q: any) => q.eq("paymentId", payment._id))
          .order("desc")
          .take(10),
      ]);
      if (legacyPayouts.length > 1) {
        paymentsWithMultiplePayouts += 1;
      }
      const primaryPayout = legacyPayouts[0] ?? null;
      const jobCompleted = job?.status === "completed";
      const kycApproved = isInstructorKycApprovedForMigration(instructorProfile);

      const releaseResult = await ensureReleaseLedgerForPaymentOrder(ctx, {
        payment,
        paymentOrder,
        shouldRelease:
          Boolean(primaryPayout) ||
          Boolean(paymentOrder.releasedAt) ||
          ((payment.status === "captured" || payment.status === "refunded") &&
            jobCompleted &&
            kycApproved),
        releaseReferenceType: primaryPayout ? "adjustment" : "job_completion",
        releaseReferenceId: primaryPayout
          ? `migration:release:${String(payment._id)}`
          : String(payment.jobId),
        releaseAt:
          paymentOrder.releasedAt ??
          primaryPayout?.createdAt ??
          payment.capturedAt ??
          payment.updatedAt ??
          payment.createdAt,
      });
      ledgerEntriesInserted += releaseResult.ledgerEntriesInserted;

      if (paymentOrder.instructorId && paymentOrder.instructorUserId) {
        let payoutSchedule =
          (primaryPayout?.payoutScheduleId
            ? await ctx.db.get(primaryPayout.payoutScheduleId)
            : null) ??
          (await ctx.db
            .query("payoutSchedules")
            .withIndex("by_payment_order", (q: any) => q.eq("paymentOrderId", paymentOrder._id))
            .order("desc")
            .first());

        const nextScheduleStatus = primaryPayout
          ? mapLegacyPayoutToScheduleStatus(primaryPayout.status)
          : payment.status === "refunded"
            ? "cancelled"
            : jobCompleted && kycApproved
              ? "available"
              : payment.status === "captured"
                ? "blocked"
                : "pending_eligibility";
        const scheduleFailureReason =
          primaryPayout?.lastError ??
          (payment.status === "refunded"
            ? "Payment refunded"
            : payment.status === "captured" && !jobCompleted
              ? "Job is not completed yet"
              : payment.status === "captured" && !kycApproved
                ? "Instructor identity verification is required"
                : undefined);

        if (
          !payoutSchedule &&
          (payment.status === "captured" || payment.status === "refunded" || primaryPayout)
        ) {
          const payoutScheduleId = await ctx.db.insert(
            "payoutSchedules",
            omitUndefined({
              paymentOrderId: paymentOrder._id,
              sourcePaymentId: payment._id,
              payoutId: primaryPayout?._id,
              jobId: payment.jobId,
              studioId: payment.studioId,
              studioUserId: payment.studioUserId,
              instructorId: paymentOrder.instructorId,
              instructorUserId: paymentOrder.instructorUserId,
              destinationId: primaryPayout?.destinationId,
              status: nextScheduleStatus,
              amountAgorot: paymentOrder.instructorGrossAmountAgorot,
              currency: paymentOrder.currency,
              releaseAfter:
                nextScheduleStatus === "scheduled" ? primaryPayout?.createdAt : undefined,
              readyAt:
                nextScheduleStatus === "available" ||
                nextScheduleStatus === "scheduled" ||
                nextScheduleStatus === "processing"
                  ? (paymentOrder.releasedAt ??
                    primaryPayout?.createdAt ??
                    payment.capturedAt ??
                    payment.createdAt)
                  : undefined,
              executedAt:
                nextScheduleStatus === "paid"
                  ? (primaryPayout?.terminalAt ??
                    primaryPayout?.updatedAt ??
                    primaryPayout?.createdAt)
                  : undefined,
              failureReason: scheduleFailureReason,
              createdAt: primaryPayout?.createdAt ?? payment.createdAt,
              updatedAt: Date.now(),
            }) as Doc<"payoutSchedules">,
          );
          payoutSchedule = await ctx.db.get(payoutScheduleId);
          payoutSchedulesCreated += 1;
        } else if (payoutSchedule) {
          await ctx.db.patch(
            payoutSchedule._id,
            omitUndefined({
              sourcePaymentId: payment._id,
              payoutId: primaryPayout?._id ?? payoutSchedule.payoutId,
              destinationId: primaryPayout?.destinationId ?? payoutSchedule.destinationId,
              status: nextScheduleStatus,
              amountAgorot: paymentOrder.instructorGrossAmountAgorot,
              currency: paymentOrder.currency,
              releaseAfter:
                nextScheduleStatus === "scheduled"
                  ? primaryPayout?.createdAt
                  : payoutSchedule.releaseAfter,
              readyAt:
                nextScheduleStatus === "available" ||
                nextScheduleStatus === "scheduled" ||
                nextScheduleStatus === "processing"
                  ? (payoutSchedule.readyAt ??
                    paymentOrder.releasedAt ??
                    primaryPayout?.createdAt ??
                    payment.capturedAt ??
                    payment.createdAt)
                  : payoutSchedule.readyAt,
              executedAt:
                nextScheduleStatus === "paid"
                  ? (payoutSchedule.executedAt ??
                    primaryPayout?.terminalAt ??
                    primaryPayout?.updatedAt ??
                    primaryPayout?.createdAt)
                  : payoutSchedule.executedAt,
              failureReason: scheduleFailureReason,
              updatedAt: Date.now(),
            }),
          );
          payoutSchedule = await ctx.db.get(payoutSchedule._id);
        }

        if (payoutSchedule && primaryPayout) {
          for (const payout of legacyPayouts) {
            if (
              payout.paymentOrderId !== paymentOrder._id ||
              payout.payoutScheduleId !== payoutSchedule._id
            ) {
              await ctx.db.patch(payout._id, {
                paymentOrderId: paymentOrder._id,
                payoutScheduleId: payoutSchedule._id,
                updatedAt: Date.now(),
              });
              payoutsLinked += 1;
            }

            if (
              await upsertPayoutProviderLinkForMigration(ctx, {
                payoutScheduleId: payoutSchedule._id,
                payoutId: payout._id,
                merchantReferenceId: String(payout._id),
                providerPayoutId: payout.providerPayoutId,
                correlationToken: `legacy-payout:${String(payout._id)}`,
              })
            ) {
              payoutProviderLinksCreated += 1;
            }
          }

          const reserveAt = primaryPayout.createdAt;
          const reserveAvailable = await insertMarketplaceLedgerEntryIfMissing(ctx, {
            paymentOrderId: paymentOrder._id,
            jobId: paymentOrder.jobId,
            studioUserId: paymentOrder.studioUserId,
            instructorUserId: payoutSchedule.instructorUserId,
            payoutScheduleId: payoutSchedule._id,
            payoutId: primaryPayout._id,
            dedupeKey: `reserve:${payoutSchedule._id}:available`,
            entryType: "payout_reserved",
            balanceBucket: "instructor_available",
            amountAgorot: -payoutSchedule.amountAgorot,
            currency: payoutSchedule.currency,
            referenceType: "payout_schedule",
            referenceId: String(payoutSchedule._id),
            createdAt: reserveAt,
          });
          if (reserveAvailable.created) {
            ledgerEntriesInserted += 1;
          }
          const reserveHeld = await insertMarketplaceLedgerEntryIfMissing(ctx, {
            paymentOrderId: paymentOrder._id,
            jobId: paymentOrder.jobId,
            studioUserId: paymentOrder.studioUserId,
            instructorUserId: payoutSchedule.instructorUserId,
            payoutScheduleId: payoutSchedule._id,
            payoutId: primaryPayout._id,
            dedupeKey: `reserve:${payoutSchedule._id}:reserved`,
            entryType: "payout_reserved",
            balanceBucket: "instructor_reserved",
            amountAgorot: payoutSchedule.amountAgorot,
            currency: payoutSchedule.currency,
            referenceType: "payout_schedule",
            referenceId: String(payoutSchedule._id),
            createdAt: reserveAt,
          });
          if (reserveHeld.created) {
            ledgerEntriesInserted += 1;
          }

          if (primaryPayout.status === "paid") {
            const paidReserved = await insertMarketplaceLedgerEntryIfMissing(ctx, {
              paymentOrderId: paymentOrder._id,
              jobId: paymentOrder.jobId,
              studioUserId: paymentOrder.studioUserId,
              instructorUserId: payoutSchedule.instructorUserId,
              payoutScheduleId: payoutSchedule._id,
              payoutId: primaryPayout._id,
              dedupeKey: `paid:${payoutSchedule._id}:reserved`,
              entryType: "payout_sent",
              balanceBucket: "instructor_reserved",
              amountAgorot: -payoutSchedule.amountAgorot,
              currency: payoutSchedule.currency,
              referenceType: "payout",
              referenceId: String(primaryPayout._id),
              createdAt:
                primaryPayout.terminalAt ?? primaryPayout.updatedAt ?? primaryPayout.createdAt,
            });
            if (paidReserved.created) {
              ledgerEntriesInserted += 1;
            }
            const paidOut = await insertMarketplaceLedgerEntryIfMissing(ctx, {
              paymentOrderId: paymentOrder._id,
              jobId: paymentOrder.jobId,
              studioUserId: paymentOrder.studioUserId,
              instructorUserId: payoutSchedule.instructorUserId,
              payoutScheduleId: payoutSchedule._id,
              payoutId: primaryPayout._id,
              dedupeKey: `paid:${payoutSchedule._id}:paid`,
              entryType: "payout_sent",
              balanceBucket: "instructor_paid",
              amountAgorot: payoutSchedule.amountAgorot,
              currency: payoutSchedule.currency,
              referenceType: "payout",
              referenceId: String(primaryPayout._id),
              createdAt:
                primaryPayout.terminalAt ?? primaryPayout.updatedAt ?? primaryPayout.createdAt,
            });
            if (paidOut.created) {
              ledgerEntriesInserted += 1;
            }
          }

          if (
            primaryPayout.status === "failed" ||
            primaryPayout.status === "cancelled" ||
            primaryPayout.status === "needs_attention"
          ) {
            const failedReserved = await insertMarketplaceLedgerEntryIfMissing(ctx, {
              paymentOrderId: paymentOrder._id,
              jobId: paymentOrder.jobId,
              studioUserId: paymentOrder.studioUserId,
              instructorUserId: payoutSchedule.instructorUserId,
              payoutScheduleId: payoutSchedule._id,
              payoutId: primaryPayout._id,
              dedupeKey: `failed:${payoutSchedule._id}:reserved`,
              entryType: "payout_failed",
              balanceBucket: "instructor_reserved",
              amountAgorot: -payoutSchedule.amountAgorot,
              currency: payoutSchedule.currency,
              referenceType: "payout",
              referenceId: String(primaryPayout._id),
              createdAt:
                primaryPayout.terminalAt ?? primaryPayout.updatedAt ?? primaryPayout.createdAt,
            });
            if (failedReserved.created) {
              ledgerEntriesInserted += 1;
            }
            const failedAvailable = await insertMarketplaceLedgerEntryIfMissing(ctx, {
              paymentOrderId: paymentOrder._id,
              jobId: paymentOrder.jobId,
              studioUserId: paymentOrder.studioUserId,
              instructorUserId: payoutSchedule.instructorUserId,
              payoutScheduleId: payoutSchedule._id,
              payoutId: primaryPayout._id,
              dedupeKey: `failed:${payoutSchedule._id}:available`,
              entryType: "payout_failed",
              balanceBucket: "instructor_available",
              amountAgorot: payoutSchedule.amountAgorot,
              currency: payoutSchedule.currency,
              referenceType: "payout",
              referenceId: String(primaryPayout._id),
              createdAt:
                primaryPayout.terminalAt ?? primaryPayout.updatedAt ?? primaryPayout.createdAt,
            });
            if (failedAvailable.created) {
              ledgerEntriesInserted += 1;
            }
          }
        }
      }

      ledgerEntriesInserted += await ensureRefundLedgerForPaymentOrder(ctx, {
        payment,
        paymentOrder,
      });
    }

    return {
      scanned: page.page.length,
      paymentOrdersCreated,
      paymentsLinked,
      paymentProviderLinksCreated,
      payoutSchedulesCreated,
      payoutsLinked,
      payoutProviderLinksCreated,
      ledgerEntriesInserted,
      paymentsWithMultiplePayouts,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const getZoneDataQualityReport = query({
  args: {
    sampleLimit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    studiosTotal: v.number(),
    jobsTotal: v.number(),
    invalidStudiosCount: v.number(),
    invalidJobsCount: v.number(),
    invalidOpenJobsCount: v.number(),
    invalidStudioSamples: v.array(
      v.object({
        studioId: v.id("studioProfiles"),
        zone: v.string(),
      }),
    ),
    invalidJobSamples: v.array(
      v.object({
        jobId: v.id("jobs"),
        studioId: v.id("studioProfiles"),
        zone: v.string(),
        status: v.union(
          v.literal("open"),
          v.literal("filled"),
          v.literal("cancelled"),
          v.literal("completed"),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const sampleLimit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 100);

    const [studios, jobs] = await Promise.all([
      ctx.db.query("studioProfiles").collect(),
      ctx.db.query("jobs").collect(),
    ]);

    const invalidStudios = studios.filter((studio) => {
      const zone = toCleanZone(studio.zone);
      return !zone || !isKnownZoneId(zone);
    });
    const invalidJobs = jobs.filter((job) => {
      const zone = toCleanZone(job.zone);
      return !zone || !isKnownZoneId(zone);
    });

    return {
      studiosTotal: studios.length,
      jobsTotal: jobs.length,
      invalidStudiosCount: invalidStudios.length,
      invalidJobsCount: invalidJobs.length,
      invalidOpenJobsCount: invalidJobs.filter((job) => job.status === "open").length,
      invalidStudioSamples: invalidStudios.slice(0, sampleLimit).map((studio) => ({
        studioId: studio._id,
        zone: studio.zone,
      })),
      invalidJobSamples: invalidJobs.slice(0, sampleLimit).map((job) => ({
        jobId: job._id,
        studioId: job.studioId,
        zone: job.zone,
        status: job.status,
      })),
    };
  },
});

export const backfillJobZonesFromStudioProfiles = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    skippedInvalidStudioZone: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const page = await ctx.db
      .query("jobs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patched = 0;
    let skippedInvalidStudioZone = 0;
    for (const job of page.page) {
      const jobZone = toCleanZone(job.zone);
      if (jobZone && isKnownZoneId(jobZone)) {
        continue;
      }

      const studio = await ctx.db.get(job.studioId);
      const studioZone = toCleanZone(studio?.zone);
      if (!studioZone || !isKnownZoneId(studioZone)) {
        skippedInvalidStudioZone += 1;
        continue;
      }

      await ctx.db.patch("jobs", job._id, { zone: studioZone });
      patched += 1;
    }

    return {
      scanned: page.page.length,
      patched,
      skippedInvalidStudioZone,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const normalizeLegacyZoneStrings = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scannedStudios: v.number(),
    patchedStudios: v.number(),
    unresolvedStudios: v.number(),
    scannedJobs: v.number(),
    patchedJobs: v.number(),
    unresolvedJobs: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);

    const studioPage = await ctx.db
      .query("studioProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patchedStudios = 0;
    let unresolvedStudios = 0;
    const patchedStudioZoneById = new Map<string, string>();

    for (const studio of studioPage.page) {
      const resolved = resolveZoneId(studio.zone);
      if (!resolved) {
        unresolvedStudios += 1;
        continue;
      }
      if (resolved !== studio.zone) {
        await ctx.db.patch("studioProfiles", studio._id, { zone: resolved });
        patchedStudios += 1;
      }
      patchedStudioZoneById.set(String(studio._id), resolved);
    }

    const jobs = await Promise.all(
      studioPage.page.map((studio) =>
        ctx.db
          .query("jobs")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect(),
      ),
    );

    let scannedJobs = 0;
    let patchedJobs = 0;
    let unresolvedJobs = 0;
    for (let i = 0; i < studioPage.page.length; i += 1) {
      const studio = studioPage.page[i];
      const studioJobs = jobs[i];
      if (!studio || !studioJobs) {
        continue;
      }
      const studioResolvedZone = patchedStudioZoneById.get(String(studio._id));
      for (const job of studioJobs) {
        scannedJobs += 1;
        const resolved = resolveZoneId(job.zone) ?? studioResolvedZone;
        if (!resolved) {
          unresolvedJobs += 1;
          continue;
        }
        if (resolved !== job.zone) {
          await ctx.db.patch("jobs", job._id, { zone: resolved });
          patchedJobs += 1;
        }
      }
    }

    return {
      scannedStudios: studioPage.page.length,
      patchedStudios,
      unresolvedStudios,
      scannedJobs,
      patchedJobs,
      unresolvedJobs,
      hasMore: !studioPage.isDone,
      ...omitUndefined({
        continueCursor: studioPage.isDone ? undefined : studioPage.continueCursor,
      }),
    };
  },
});

export const backfillJobApplicationStats = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scannedJobs: v.number(),
    upsertedStats: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);

    const page = await ctx.db
      .query("jobs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let upsertedStats = 0;
    for (const job of page.page) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      const applicationsCount = applications.length;
      const pendingApplicationsCount = applications.filter(
        (application) => application.status === "pending",
      ).length;
      const existing = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .unique();
      const next = {
        studioId: job.studioId,
        applicationsCount,
        pendingApplicationsCount,
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, next);
      } else {
        await ctx.db.insert("jobApplicationStats", {
          jobId: job._id,
          ...next,
        });
      }
      upsertedStats += 1;
    }

    return {
      scannedJobs: page.page.length,
      upsertedStats,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const backfillJobApplicationStudioIds = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    skippedMissingJob: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const page = await ctx.db
      .query("jobApplications")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patched = 0;
    let skippedMissingJob = 0;

    for (const application of page.page) {
      const job = await ctx.db.get(application.jobId);
      if (!job) {
        skippedMissingJob += 1;
        continue;
      }
      if (application.studioId === job.studioId) {
        continue;
      }
      await ctx.db.patch("jobApplications", application._id, {
        studioId: job.studioId,
      });
      patched += 1;
    }

    return {
      scanned: page.page.length,
      patched,
      skippedMissingJob,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const getJobApplicationStatsConsistencyReport = query({
  args: {
    sampleLimit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    jobsTotal: v.number(),
    statsTotal: v.number(),
    missingStatsCount: v.number(),
    mismatchedStatsCount: v.number(),
    studioIdMismatchCount: v.number(),
    missingStatsSamples: v.array(
      v.object({
        jobId: v.id("jobs"),
      }),
    ),
    mismatchedStatsSamples: v.array(
      v.object({
        jobId: v.id("jobs"),
        expectedApplicationsCount: v.number(),
        actualApplicationsCount: v.number(),
        expectedPendingApplicationsCount: v.number(),
        actualPendingApplicationsCount: v.number(),
      }),
    ),
    studioIdMismatchSamples: v.array(
      v.object({
        applicationId: v.id("jobApplications"),
        jobId: v.id("jobs"),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const sampleLimit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 200);
    const [jobs, stats, applications] = await Promise.all([
      ctx.db.query("jobs").collect(),
      ctx.db.query("jobApplicationStats").collect(),
      ctx.db.query("jobApplications").collect(),
    ]);

    const jobById = new Map(jobs.map((job) => [String(job._id), job] as const));
    const statByJobId = new Map(stats.map((stat) => [String(stat.jobId), stat] as const));

    const applicationsByJobId = new Map<string, Doc<"jobApplications">[]>();
    for (const application of applications) {
      const jobId = String(application.jobId);
      const existing = applicationsByJobId.get(jobId);
      if (existing) {
        existing.push(application);
      } else {
        applicationsByJobId.set(jobId, [application]);
      }
    }

    const missingStatsSamples: Array<{ jobId: Id<"jobs"> }> = [];
    const mismatchedStatsSamples: Array<{
      jobId: Id<"jobs">;
      expectedApplicationsCount: number;
      actualApplicationsCount: number;
      expectedPendingApplicationsCount: number;
      actualPendingApplicationsCount: number;
    }> = [];
    const studioIdMismatchSamples: Array<{
      applicationId: Id<"jobApplications">;
      jobId: Id<"jobs">;
    }> = [];

    let missingStatsCount = 0;
    let mismatchedStatsCount = 0;
    for (const job of jobs) {
      const jobId = String(job._id);
      const stat = statByJobId.get(jobId);
      const jobApplications = applicationsByJobId.get(jobId) ?? [];
      const applicationsCount = jobApplications.length;
      const pendingApplicationsCount = jobApplications.filter(
        (application) => application.status === "pending",
      ).length;

      if (!stat) {
        missingStatsCount += 1;
        if (missingStatsSamples.length < sampleLimit) {
          missingStatsSamples.push({ jobId: job._id });
        }
        continue;
      }

      if (
        stat.applicationsCount !== applicationsCount ||
        stat.pendingApplicationsCount !== pendingApplicationsCount
      ) {
        mismatchedStatsCount += 1;
        if (mismatchedStatsSamples.length < sampleLimit) {
          mismatchedStatsSamples.push({
            jobId: job._id,
            expectedApplicationsCount: applicationsCount,
            actualApplicationsCount: stat.applicationsCount,
            expectedPendingApplicationsCount: pendingApplicationsCount,
            actualPendingApplicationsCount: stat.pendingApplicationsCount,
          });
        }
      }
    }

    let studioIdMismatchCount = 0;
    for (const application of applications) {
      const job = jobById.get(String(application.jobId));
      if (!job) continue;
      if (application.studioId === job.studioId) continue;
      studioIdMismatchCount += 1;
      if (studioIdMismatchSamples.length < sampleLimit) {
        studioIdMismatchSamples.push({
          applicationId: application._id,
          jobId: application.jobId,
        });
      }
    }

    return {
      jobsTotal: jobs.length,
      statsTotal: stats.length,
      missingStatsCount,
      mismatchedStatsCount,
      studioIdMismatchCount,
      missingStatsSamples,
      mismatchedStatsSamples,
      studioIdMismatchSamples,
    };
  },
});

export const repairJobApplicationStatsForJobs = internalMutation({
  args: {
    jobIds: v.array(v.id("jobs")),
  },
  returns: v.object({
    repaired: v.number(),
    missingJobs: v.number(),
  }),
  handler: async (ctx, args) => {
    let repaired = 0;
    let missingJobs = 0;

    for (const jobId of args.jobIds) {
      const job = await ctx.db.get(jobId);
      if (!job) {
        missingJobs += 1;
        continue;
      }
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      const applicationsCount = applications.length;
      const pendingApplicationsCount = applications.filter(
        (application) => application.status === "pending",
      ).length;
      const existing = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .unique();
      const next = {
        studioId: job.studioId,
        applicationsCount,
        pendingApplicationsCount,
        updatedAt: Date.now(),
      };
      if (existing) {
        await ctx.db.patch(existing._id, next);
      } else {
        await ctx.db.insert("jobApplicationStats", {
          jobId: job._id,
          ...next,
        });
      }
      repaired += 1;
    }

    return { repaired, missingJobs };
  },
});

const DIDIT_BASE_URL = "https://verification.didit.me";
const DIDIT_STATUS_VALUES = [
  "not_started",
  "in_progress",
  "pending",
  "in_review",
  "approved",
  "declined",
  "abandoned",
  "expired",
] as const;
type DiditStatus = (typeof DIDIT_STATUS_VALUES)[number];

function normalizeDiditStatus(raw: string | undefined): DiditStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("approve")) return "approved";
  if (value.includes("declin")) return "declined";
  if (value.includes("abandon")) return "abandoned";
  if (value.includes("expir")) return "expired";
  if (value.includes("review")) return "in_review";
  if (value.includes("pending")) return "pending";
  if (value.includes("progress")) return "in_progress";
  return "not_started";
}

function normalizeNamePart(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

function getTrimmedString(
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function extractLegalName(decision: unknown): {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
} {
  if (!decision || typeof decision !== "object") {
    return {};
  }
  const rawDecision = decision as Record<string, unknown>;
  const idVerificationsRaw = rawDecision.id_verifications;
  const idVerification =
    Array.isArray(idVerificationsRaw) && idVerificationsRaw.length > 0
      ? ((idVerificationsRaw[0] as Record<string, unknown>) ?? {})
      : idVerificationsRaw && typeof idVerificationsRaw === "object"
        ? (idVerificationsRaw as Record<string, unknown>)
        : {};
  const idVerificationExtracted =
    idVerification.extracted_data && typeof idVerification.extracted_data === "object"
      ? (idVerification.extracted_data as Record<string, unknown>)
      : {};

  const firstName = normalizeNamePart(
    idVerification.first_name ??
      idVerification.firstName ??
      idVerificationExtracted.first_name ??
      idVerificationExtracted.firstName ??
      rawDecision.first_name,
  );
  const middleName = normalizeNamePart(
    idVerification.middle_name ??
      idVerification.middleName ??
      idVerificationExtracted.middle_name ??
      idVerificationExtracted.middleName ??
      rawDecision.middle_name,
  );
  const lastName = normalizeNamePart(
    idVerification.last_name ??
      idVerification.lastName ??
      idVerificationExtracted.last_name ??
      idVerificationExtracted.lastName ??
      rawDecision.last_name,
  );
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || undefined;
  return omitUndefined({ firstName, middleName, lastName, fullName });
}

export const backfillDiditVerificationSnapshots = action({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    onlyNonApproved: v.optional(v.boolean()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    synced: v.number(),
    skippedNoSession: v.number(),
    skippedAlreadyApproved: v.number(),
    failed: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    scanned: number;
    synced: number;
    skippedNoSession: number;
    skippedAlreadyApproved: number;
    failed: number;
    hasMore: boolean;
    continueCursor?: string;
  }> => {
    requireMigrationsAccessToken(args.accessToken);
    const batchSize = Math.min(Math.max(args.batchSize ?? 50, 1), 100);
    const onlyNonApproved = args.onlyNonApproved ?? true;
    const diditApiKey = (process.env.DIDIT_API_KEY ?? "").trim();
    if (!diditApiKey) {
      throw new Error("Missing DIDIT_API_KEY");
    }
    const diditBaseUrl = (process.env.DIDIT_BASE_URL?.trim() || DIDIT_BASE_URL).trim();
    const page: DiditBackfillBatchResult = await ctx.runQuery(
      internal.migrations.getDiditBackfillInstructorBatch,
      {
        batchSize,
        ...omitUndefined({
          cursor: args.cursor,
        }),
      },
    );

    const fetchJson = async (url: string): Promise<Record<string, unknown> | undefined> => {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": diditApiKey,
        },
      });
      if (!response.ok) return undefined;
      const payload = (await response.json()) as unknown;
      return payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : undefined;
    };

    let synced = 0;
    let skippedNoSession = 0;
    let skippedAlreadyApproved = 0;
    let failed = 0;
    const now = Date.now();

    for (const profile of page.page) {
      if (!profile.diditSessionId) {
        skippedNoSession += 1;
        continue;
      }
      if (onlyNonApproved && profile.diditVerificationStatus === "approved") {
        skippedAlreadyApproved += 1;
        continue;
      }

      try {
        const decisionUrl = new URL(
          `/v3/session/${profile.diditSessionId}/decision/`,
          diditBaseUrl,
        ).toString();
        const sessionUrl = new URL(
          `/v3/session/${profile.diditSessionId}/`,
          diditBaseUrl,
        ).toString();
        const decisionPayload = await fetchJson(decisionUrl);
        const sessionPayload = await fetchJson(sessionUrl);
        const decisionData =
          decisionPayload?.data && typeof decisionPayload.data === "object"
            ? (decisionPayload.data as Record<string, unknown>)
            : decisionPayload;
        const sessionData =
          sessionPayload?.data && typeof sessionPayload.data === "object"
            ? (sessionPayload.data as Record<string, unknown>)
            : sessionPayload;

        const statusRaw =
          getTrimmedString(decisionData, ["status"]) ??
          getTrimmedString(sessionData, ["status"]) ??
          profile.diditStatusRaw;
        const mappedStatus = normalizeDiditStatus(statusRaw);
        const decision = decisionData ?? profile.diditDecision;
        const legal = mappedStatus === "approved" ? extractLegalName(decision) : {};

        await ctx.runMutation(internal.migrations.applyDiditVerificationSnapshotCompat, {
          instructorId: profile.instructorId,
          mappedStatus,
          at: now,
          ...omitUndefined({
            statusRaw,
            decision,
            legalFirstName: legal.firstName,
            legalMiddleName: legal.middleName,
            legalLastName: legal.lastName,
            legalName: legal.fullName,
          }),
        });
        synced += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: page.page.length,
      synced,
      skippedNoSession,
      skippedAlreadyApproved,
      failed,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const applyDiditVerificationSnapshotCompat = internalMutation({
  args: {
    instructorId: v.id("instructorProfiles"),
    mappedStatus: diditVerificationStatusValidator,
    at: v.number(),
    statusRaw: v.optional(v.string()),
    decision: v.optional(v.any()),
    legalFirstName: v.optional(v.string()),
    legalMiddleName: v.optional(v.string()),
    legalLastName: v.optional(v.string()),
    legalName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.instructorId);
    if (!profile) {
      return null;
    }

    await ctx.db.patch(profile._id, {
      diditVerificationStatus: args.mappedStatus,
      diditStatusRaw: args.statusRaw,
      diditDecision: args.decision,
      diditVerifiedAt: args.at,
      diditLegalFirstName: args.legalFirstName,
      diditLegalMiddleName: args.legalMiddleName,
      diditLegalLastName: args.legalLastName,
      diditLegalName: args.legalName,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const dedupeDuplicateUsersByEmail = action({
  args: {
    email: v.optional(v.string()),
    limit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scannedEmails: v.number(),
    dedupedEmails: v.number(),
    canonicalUserIds: v.array(v.id("users")),
    duplicateEmails: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedTargetEmail = normalizeEmail(args.email);
    const duplicateEmails: string[] = normalizedTargetEmail
      ? [normalizedTargetEmail]
      : await ctx.runQuery(internal.migrations.getDuplicateUserEmails, {});
    const targetEmails = duplicateEmails.slice(
      0,
      Math.max(args.limit ?? duplicateEmails.length, 0),
    );
    const canonicalUserIds: Id<"users">[] = [];

    for (const email of targetEmails) {
      const canonicalUserId = await ctx.runMutation(internal.migrations.dedupeUsersForEmail, {
        email,
      });
      if (canonicalUserId) {
        canonicalUserIds.push(canonicalUserId);
      }
    }

    return {
      scannedEmails: targetEmails.length,
      dedupedEmails: canonicalUserIds.length,
      canonicalUserIds,
      duplicateEmails: targetEmails,
    };
  },
});

export const getDuplicateUserEmailReport = action({
  args: {
    email: v.optional(v.string()),
    limit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scannedEmails: v.number(),
    duplicateEmails: v.array(duplicateUserEmailReportEntryValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    scannedEmails: number;
    duplicateEmails: DuplicateUserEmailReportEntry[];
  }> => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedTargetEmail = normalizeEmail(args.email);
    const duplicateEmails: string[] = normalizedTargetEmail
      ? [normalizedTargetEmail]
      : await ctx.runQuery(internal.migrations.getDuplicateUserEmails, {});
    const targetEmails: string[] = duplicateEmails.slice(
      0,
      Math.max(args.limit ?? duplicateEmails.length, 0),
    );

    const reportEntries: DuplicateUserEmailReportEntry[] = (
      await Promise.all(
        targetEmails.map((email: string) =>
          ctx.runQuery(internal.migrations.getDuplicateUserEmailReportEntry, { email }),
        ),
      )
    ).filter(isDuplicateUserEmailReportEntry);

    return {
      scannedEmails: targetEmails.length,
      duplicateEmails: reportEntries,
    };
  },
});

export const inspectUserEmailLinkState = query({
  args: {
    email: v.string(),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    normalizedEmail: v.string(),
    usersByEmail: v.array(
      v.object({
        userId: v.id("users"),
        role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
        onboardingComplete: v.boolean(),
        isActive: v.boolean(),
        emailVerified: v.boolean(),
        hasInstructorProfile: v.boolean(),
        hasStudioProfile: v.boolean(),
      }),
    ),
    usersFromEmailAuthAccounts: v.array(authEmailLinkStateEntryValidator),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    const usersByEmail = await Promise.all(
      users.map(async (user) => ({
        userId: user._id,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
        isActive: user.isActive,
        emailVerified: user.emailVerificationTime !== undefined,
        ...(await resolveUserProfileState(ctx, user._id)),
      })),
    );

    const usersFromEmailAuthAccounts: AuthEmailLinkStateEntry[] = [];
    for (const providerId of EMAIL_AUTH_PROVIDER_IDS) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", providerId).eq("providerAccountId", normalizedEmail),
        )
        .collect();

      for (const account of accounts) {
        const user = await ctx.db.get(account.userId);
        if (!user) {
          continue;
        }

        usersFromEmailAuthAccounts.push({
          userId: user._id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          role: user.role,
          onboardingComplete: user.onboardingComplete,
          isActive: user.isActive,
          emailVerified:
            user.emailVerificationTime !== undefined || account.emailVerified !== undefined,
          ...(await resolveUserProfileState(ctx, user._id)),
          ...omitUndefined({
            userEmail: user.email,
          }),
        });
      }
    }

    return {
      normalizedEmail,
      usersByEmail,
      usersFromEmailAuthAccounts,
    };
  },
});

export const repairUserEmailFromAuthAccounts = mutation({
  args: {
    email: v.string(),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    normalizedEmail: v.string(),
    inspectedUsers: v.number(),
    updatedUsers: v.number(),
    updatedUserIds: v.array(v.id("users")),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const candidates = new Map<
      string,
      {
        userId: Id<"users">;
        shouldMarkVerified: boolean;
      }
    >();

    for (const providerId of EMAIL_AUTH_PROVIDER_IDS) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", providerId).eq("providerAccountId", normalizedEmail),
        )
        .collect();

      for (const account of accounts) {
        const key = String(account.userId);
        const existing = candidates.get(key);
        const shouldMarkVerified = account.emailVerified === normalizedEmail;
        candidates.set(key, {
          userId: account.userId,
          shouldMarkVerified: existing?.shouldMarkVerified === true || shouldMarkVerified,
        });
      }
    }

    const updatedUserIds: Id<"users">[] = [];
    const now = Date.now();

    for (const candidate of candidates.values()) {
      const user = await ctx.db.get(candidate.userId);
      if (!user) {
        continue;
      }

      const userEmail = normalizeEmail(user.email);
      const shouldUpdateEmail = userEmail !== normalizedEmail;
      const shouldUpdateVerification =
        candidate.shouldMarkVerified && user.emailVerificationTime === undefined;

      if (!shouldUpdateEmail && !shouldUpdateVerification) {
        continue;
      }

      await ctx.db.patch("users", user._id, {
        ...(shouldUpdateEmail ? { email: normalizedEmail } : {}),
        ...(shouldUpdateVerification ? { emailVerificationTime: now } : {}),
        updatedAt: now,
      });
      updatedUserIds.push(user._id);
    }

    return {
      normalizedEmail,
      inspectedUsers: candidates.size,
      updatedUsers: updatedUserIds.length,
      updatedUserIds,
    };
  },
});

export const resetDevelopmentData = action({
  args: {
    accessToken: v.optional(v.string()),
    confirm: v.string(),
  },
  returns: v.object({
    tablesCleared: v.number(),
    deletedDocuments: v.number(),
    deletedByTable: v.array(
      v.object({
        table: v.string(),
        deleted: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<DevelopmentResetResult> => {
    requireMigrationsAccessToken(args.accessToken);
    if (args.confirm !== DEVELOPMENT_RESET_CONFIRMATION) {
      throw new Error(
        `Refusing to reset development data without confirm=${DEVELOPMENT_RESET_CONFIRMATION}.`,
      );
    }
    return await ctx.runMutation(internal.migrations.clearAllDevelopmentData, {});
  },
});

export const getDuplicateUserEmails = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const counts = new Map<string, { total: number; verified: number }>();
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (!email) {
        continue;
      }
      const current = counts.get(email) ?? { total: 0, verified: 0 };
      counts.set(email, {
        total: current.total + 1,
        verified: current.verified + (user.emailVerificationTime !== undefined ? 1 : 0),
      });
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count.total > 1 && count.verified > 0)
      .map(([email]) => email)
      .sort();
  },
});

export const getDuplicateUserEmailReportEntry = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(duplicateUserEmailReportEntryValidator, v.null()),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      return null;
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    if (users.length <= 1) {
      return null;
    }

    const canonicalUserId =
      (await resolveCanonicalUserByEmail({
        ctx,
        normalizedEmail,
      })) ?? undefined;

    const userEntries = await Promise.all(
      users.map(async (user) => {
        const [instructorProfiles, studioProfiles] = await Promise.all([
          ctx.db
            .query("instructorProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .take(1),
          ctx.db
            .query("studioProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .take(1),
        ]);

        return {
          userId: user._id,
          role: user.role,
          roles: (user.roles ?? []).filter(
            (role): role is "instructor" | "studio" => role === "instructor" || role === "studio",
          ),
          onboardingComplete: user.onboardingComplete,
          isActive: user.isActive,
          emailVerified: user.emailVerificationTime !== undefined,
          hasInstructorProfile: instructorProfiles.length > 0,
          hasStudioProfile: studioProfiles.length > 0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }),
    );

    return {
      email: normalizedEmail,
      userCount: users.length,
      ...omitUndefined({
        canonicalUserId,
      }),
      users: userEntries.sort((left, right) => left.createdAt - right.createdAt),
    };
  },
});

export const dedupeUsersForEmail = internalMutation({
  args: {
    email: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      return null;
    }
    return await dedupeUsersByEmail({
      ctx,
      normalizedEmail,
      requireVerifiedUser: true,
    });
  },
});

export const clearAllDevelopmentData = internalMutation({
  args: {},
  returns: v.object({
    tablesCleared: v.number(),
    deletedDocuments: v.number(),
    deletedByTable: v.array(
      v.object({
        table: v.string(),
        deleted: v.number(),
      }),
    ),
  }),
  handler: async (ctx): Promise<DevelopmentResetResult> => {
    const deletedByTable: Array<{ table: string; deleted: number }> = [];

    for (const table of DEVELOPMENT_RESET_TABLES) {
      const deleted = await deleteAllRowsInTable(ctx, table);
      deletedByTable.push({ table, deleted });
    }

    return {
      tablesCleared: deletedByTable.filter((entry) => entry.deleted > 0).length,
      deletedDocuments: deletedByTable.reduce((total, entry) => total + entry.deleted, 0),
      deletedByTable,
    };
  },
});

export const getDiditBackfillInstructorBatch = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    page: v.array(
      v.object({
        instructorId: v.id("instructorProfiles"),
        diditSessionId: v.optional(v.string()),
        diditVerificationStatus: v.optional(
          v.union(
            v.literal("not_started"),
            v.literal("in_progress"),
            v.literal("pending"),
            v.literal("in_review"),
            v.literal("approved"),
            v.literal("declined"),
            v.literal("abandoned"),
            v.literal("expired"),
          ),
        ),
        diditStatusRaw: v.optional(v.string()),
        diditDecision: v.optional(v.any()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args): Promise<DiditBackfillBatchResult> => {
    const page = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: args.batchSize });
    return {
      page: page.page.map((profile) => ({
        instructorId: profile._id,
        ...omitUndefined({
          diditSessionId: profile.diditSessionId,
          diditVerificationStatus: profile.diditVerificationStatus,
          diditStatusRaw: profile.diditStatusRaw,
          diditDecision: profile.diditDecision,
        }),
      })),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const backfillStudioBranchInfrastructure = mutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    updatedStudios: v.number(),
    updatedJobs: v.number(),
    updatedApplications: v.number(),
    updatedStats: v.number(),
    updatedPayments: v.number(),
    updatedPayouts: v.number(),
    updatedCalendarIntegrations: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 50), 1), 200);
    const page = await ctx.db
      .query("studioProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let updatedStudios = 0;
    let updatedJobs = 0;
    let updatedApplications = 0;
    let updatedStats = 0;
    let updatedPayments = 0;
    let updatedPayouts = 0;
    let updatedCalendarIntegrations = 0;

    for (const studio of page.page) {
      const now = Date.now();
      const { branch } = await ensureStudioInfrastructure(ctx, studio, now);
      updatedStudios += 1;

      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const job of jobs) {
        const patch = omitUndefined({
          branchId: job.branchId ?? branch._id,
          branchNameSnapshot: job.branchNameSnapshot ?? branch.name,
          branchAddressSnapshot: job.branchAddressSnapshot ?? branch.address,
        });
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(job._id, patch);
          updatedJobs += 1;
        }
      }

      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const application of applications) {
        if (!application.branchId) {
          await ctx.db.patch(application._id, { branchId: branch._id });
          updatedApplications += 1;
        }
      }

      const stats = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const stat of stats) {
        if (!stat.branchId) {
          await ctx.db.patch(stat._id, { branchId: branch._id });
          updatedStats += 1;
        }
      }

      const payments = await ctx.db
        .query("payments")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const payment of payments) {
        const patch = omitUndefined({
          branchId: payment.branchId ?? branch._id,
          branchNameSnapshot: payment.branchNameSnapshot ?? branch.name,
        });
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(payment._id, patch);
          updatedPayments += 1;
        }
      }

      const payouts = await ctx.db
        .query("payouts")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const payout of payouts) {
        if (!payout.branchId) {
          await ctx.db.patch(payout._id, { branchId: branch._id });
          updatedPayouts += 1;
        }
      }

      const integrations = await ctx.db
        .query("calendarIntegrations")
        .withIndex("by_studio_provider", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const integration of integrations) {
        if (!integration.branchId) {
          await ctx.db.patch(integration._id, { branchId: branch._id });
          updatedCalendarIntegrations += 1;
        }
      }
    }

    return {
      scanned: page.page.length,
      updatedStudios,
      updatedJobs,
      updatedApplications,
      updatedStats,
      updatedPayments,
      updatedPayouts,
      updatedCalendarIntegrations,
      hasMore: !page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const backfillInstructorGeospatialCoverage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    synced: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const page = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let synced = 0;
    for (const profile of page.page) {
      await syncInstructorGeospatialCoverage(ctx, profile._id);
      synced += 1;
    }

    return {
      scanned: page.page.length,
      synced,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

export const backfillStudioBranchGeospatialCoverage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    synced: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const page = await ctx.db
      .query("studioBranches")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let synced = 0;
    for (const branch of page.page) {
      await syncStudioBranchGeospatialLocation(ctx, branch);
      synced += 1;
    }

    return {
      scanned: page.page.length,
      synced,
      hasMore: !page.isDone,
      ...omitUndefined({
        continueCursor: page.isDone ? undefined : page.continueCursor,
      }),
    };
  },
});

/**
 * Backfill slug field for all existing instructor and studio profiles
 * that don't have a slug yet. Safe to run multiple times — only patches
 * profiles that are missing the slug field.
 *
 * Run via: npx convex run migrations:backfillPublicProfileSlugs --watch
 * Convex will prompt for next cursor if hasMore is true.
 */
export const backfillPublicProfileSlugs = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    updatedInstructors: v.number(),
    updatedStudios: v.number(),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);

    // ── Instructors ─────────────────────────────────────────────────────────
    const instructorPage = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let updatedInstructors = 0;
    for (const profile of instructorPage.page) {
      if (!profile.slug) {
        const slug = await generateUniqueInstructorSlug(profile.displayName, ctx);
        await ctx.db.patch(profile._id, { slug });
        updatedInstructors += 1;
      }
    }

    // ── Studios ───────────────────────────────────────────────────────────────
    // Convex only allows one paginated query per function. Studio profiles are
    // backfilled opportunistically from a bounded collect here.
    const studioProfiles = await ctx.db.query("studioProfiles").collect();
    let updatedStudios = 0;
    for (const profile of studioProfiles.slice(0, batchSize)) {
      if (!profile.slug) {
        const slug = await generateUniqueStudioSlug(profile.studioName, ctx);
        await ctx.db.patch(profile._id, { slug });
        updatedStudios += 1;
      }
    }

    const hasMore = !instructorPage.isDone;

    return {
      updatedInstructors,
      updatedStudios,
      hasMore,
      ...omitUndefined({
        nextCursor: instructorPage.isDone ? undefined : instructorPage.continueCursor,
      }),
    };
  },
});

export const backfillBranchH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("studioBranches")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const branch of result.page) {
      if (branch.h3Index !== undefined) continue;
      const h3 = safeH3Index(branch.latitude, branch.longitude);
      if (h3 === undefined) continue;
      await ctx.db.patch(branch._id, { h3Index: h3 });
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const backfillInstructorH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const profile of result.page) {
      if (profile.h3Index !== undefined) continue;
      const h3 = safeH3Index(profile.latitude, profile.longitude);
      if (h3 === undefined) continue;
      await ctx.db.patch(profile._id, { h3Index: h3 });
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const backfillJobH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("jobs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const job of result.page) {
      if (job.h3Index !== undefined) continue;
      const branch = await ctx.db.get(job.branchId);
      if (!branch?.h3Index) continue;
      await ctx.db.patch(job._id, { h3Index: branch.h3Index });
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});
