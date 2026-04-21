import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { omitUndefined } from "../lib/validation";

type PaymentOrderSummaryInput = {
  order: Doc<"paymentOrders">;
  attempt?: Doc<"paymentAttempts"> | null;
  split?: Doc<"fundSplits"> | null;
  transfer?: Doc<"payoutTransfers"> | null;
};

function getUniqueIdsInOrder(ids: ReadonlyArray<Id<any>>) {
  const seen = new Set<string>();
  const ordered: Id<any>[] = [];
  for (const id of ids) {
    const key = String(id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(id);
  }
  return ordered;
}

function buildPaymentOrderSummaryFields({
  order,
  attempt,
  split,
  transfer,
}: PaymentOrderSummaryInput) {
  return {
    paymentOrderId: order._id,
    jobId: order.jobId,
    studioId: order.studioId,
    studioUserId: order.studioUserId,
    instructorId: order.instructorId,
    instructorUserId: order.instructorUserId,
    provider: order.provider,
    status: order.status,
    currency: order.currency,
    studioChargeAmountAgorot: order.pricing!.studioChargeAmountAgorot,
    instructorBaseAmountAgorot: order.pricing!.instructorOfferAmountAgorot,
    platformMarkupAmountAgorot: order.pricing!.platformServiceFeeAgorot,
    capturedAmountAgorot: order.capturedAmountAgorot ?? 0,
    refundedAmountAgorot: order.refundedAmountAgorot ?? 0,
    ...omitUndefined({
      offerId: order.offerId,
      correlationKey: order.correlationKey,
      latestError: order.latestError,
      latestAttemptId: attempt?._id,
      latestAttemptStatus: attempt?.status,
      latestAttemptStatusRaw: attempt?.statusRaw,
      latestAttemptProviderPaymentIntentId: attempt?.providerPaymentIntentId,
      latestSplitId: split?._id,
      latestSplitStatus: split?.status,
      latestSplitSettledAt: split?.settledAt,
      latestTransferId: transfer?._id,
      latestTransferStatus: transfer?.status,
      latestTransferPaidAt: transfer?.paidAt,
      receiptUrl: attempt?.metadata?.receipt_url,
      receiptNumber: attempt?.metadata?.receipt_number,
      succeededAt: order.succeededAt,
      cancelledAt: order.cancelledAt,
    }),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function buildPaymentOrderSummary(input: PaymentOrderSummaryInput) {
  return buildPaymentOrderSummaryFields(input);
}

export async function upsertPaymentOrderSummary(
  ctx: MutationCtx,
  input: PaymentOrderSummaryInput,
) {
  const now = Date.now();
  const fields = {
    ...buildPaymentOrderSummaryFields(input),
    updatedAt: now,
  };
  const existing = await ctx.db
    .query("paymentOrderSummaries")
    .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", input.order._id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return (await ctx.db.get(existing._id)) ?? existing;
  }

  const summaryId = await ctx.db.insert("paymentOrderSummaries", fields);
  return await ctx.db.get(summaryId);
}

export async function refreshPaymentOrderSummary(
  ctx: MutationCtx,
  order: Doc<"paymentOrders">,
) {
  const [attempt, split] = await Promise.all([
    ctx.db
      .query("paymentAttempts")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first(),
    ctx.db
      .query("fundSplits")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first(),
  ]);

  const transfer = split
    ? await ctx.db
        .query("payoutTransfers")
        .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
        .order("desc")
        .first()
    : null;

  return await upsertPaymentOrderSummary(ctx, {
    order,
    attempt,
    split,
    transfer,
  });
}

export async function loadPaymentOrderSummariesByOrderIds(
  ctx: Pick<QueryCtx, "db">,
  orderIds: ReadonlyArray<Id<"paymentOrders">>,
) {
  const summariesByOrderId = new Map<string, Doc<"paymentOrderSummaries">>();
  const uniqueOrderIds = getUniqueIdsInOrder(orderIds);

  await Promise.all(
    uniqueOrderIds.map(async (orderId) => {
      const summary = await ctx.db
        .query("paymentOrderSummaries")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", orderId))
        .unique();
      if (summary) {
        summariesByOrderId.set(String(orderId), summary);
      }
    }),
  );

  return summariesByOrderId;
}

export async function loadLatestPaymentOrderSummariesByJobIds(
  ctx: Pick<QueryCtx, "db">,
  jobIds: ReadonlyArray<Id<"jobs">>,
) {
  const summariesByJobId = new Map<string, Doc<"paymentOrderSummaries">>();
  const uniqueJobIds = getUniqueIdsInOrder(jobIds);

  await Promise.all(
    uniqueJobIds.map(async (jobId) => {
      const summary = await ctx.db
        .query("paymentOrderSummaries")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .order("desc")
        .first();
      if (summary) {
        summariesByJobId.set(String(jobId), summary);
      }
    }),
  );

  return summariesByJobId;
}

export async function loadLatestPaymentOrderSummariesByInstructorUserId(
  ctx: Pick<QueryCtx, "db">,
  instructorUserId: Id<"users">,
  limit?: number,
) {
  return await ctx.db
    .query("paymentOrderSummaries")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", instructorUserId))
    .order("desc")
    .take(limit ?? 300);
}
