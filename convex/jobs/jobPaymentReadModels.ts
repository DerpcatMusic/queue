import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import { loadLatestPaymentChildrenByOrderIds } from "../payments/readModels";
import { loadPaymentOrderSummariesByOrderIds } from "../payments/summaries";
import {
  type LegacyPaymentStatus,
  type LegacyPayoutStatus,
  mapFundSplitStatusToLegacy,
  mapPaymentOrderStatusToLegacy,
  mapPayoutTransferStatusToLegacy,
} from "../payments/statuses";
import { getUniqueIdsInOrder } from "./jobConstants";

export async function loadLatestPaymentDetailsByJobId(
  ctx: QueryCtx,
  args: {
    jobIds: ReadonlyArray<Id<"jobs">>;
    instructorUserId: Id<"users">;
  },
) {
  const uniqueJobIds = getUniqueIdsInOrder(args.jobIds);
  const paymentOrdersByJobId = new Map<string, Doc<"paymentOrders">>();
  await Promise.all(
    uniqueJobIds.map(async (jobId, index) => {
      const paymentOrder = await ctx.db
        .query("paymentOrders")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .order("desc")
        .first();
      if (paymentOrder && paymentOrder.instructorUserId === args.instructorUserId) {
        paymentOrdersByJobId.set(String(uniqueJobIds[index]), paymentOrder);
      }
    }),
  );

  const summaries = await loadPaymentOrderSummariesByOrderIds(
    ctx,
    [...paymentOrdersByJobId.values()].map((paymentOrder) => paymentOrder._id),
  );
  const missingOrders = [...paymentOrdersByJobId.values()].filter(
    (paymentOrder) => !summaries.has(String(paymentOrder._id)),
  );
  const fallbackChildren = missingOrders.length
    ? await loadLatestPaymentChildrenByOrderIds(
        ctx,
        missingOrders.map((paymentOrder) => paymentOrder._id),
      )
    : {
        latestAttemptByOrderId: new Map<string, Doc<"paymentAttempts">>(),
        latestSplitByOrderId: new Map<string, Doc<"fundSplits">>(),
        latestTransferByOrderId: new Map<string, Doc<"payoutTransfers">>(),
      };

  const paymentDetailsByJobId = new Map<
    string,
    {
      status: LegacyPaymentStatus;
      payoutStatus?: LegacyPayoutStatus;
    }
  >();

  for (const [jobId, paymentOrder] of paymentOrdersByJobId.entries()) {
    const summary = summaries.get(String(paymentOrder._id));
    const split = summary?.latestSplitStatus
      ? ({
          status: summary.latestSplitStatus,
        } as Doc<"fundSplits">)
      : fallbackChildren.latestSplitByOrderId.get(String(paymentOrder._id));
    const transfer = summary?.latestTransferStatus
      ? ({
          status: summary.latestTransferStatus,
        } as Doc<"payoutTransfers">)
      : fallbackChildren.latestTransferByOrderId.get(String(paymentOrder._id));
    paymentDetailsByJobId.set(jobId, {
      status: mapPaymentOrderStatusToLegacy(summary?.status ?? paymentOrder.status),
      ...omitUndefined({
        payoutStatus: transfer
          ? mapPayoutTransferStatusToLegacy(transfer.status)
          : split
            ? mapFundSplitStatusToLegacy(split.status)
            : undefined,
      }),
    });
  }

  return paymentDetailsByJobId;
}
