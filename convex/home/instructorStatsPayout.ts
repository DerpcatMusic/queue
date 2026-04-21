import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadLatestPaymentChildrenByOrderIds } from "../payments/readModels";
import { loadPaymentOrderSummariesByOrderIds } from "../payments/summaries";

export async function getMyInstructorPayoutSnapshotRead(
  ctx: QueryCtx,
  userId: Doc<"users">["_id"],
) {
  const connectedAccount = await ctx.db
    .query("connectedAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .first();

  const orders = await ctx.db
    .query("paymentOrders")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", userId))
    .order("desc")
    .collect();

  let currency = orders[0]?.currency ?? "ILS";
  let lifetimeEarnedAmountAgorot = 0;
  let paidAmountAgorot = 0;
  let availableAmountAgorot = 0;
  let heldAmountAgorot = 0;

  const summaries = await loadPaymentOrderSummariesByOrderIds(
    ctx,
    orders.map((order) => order._id),
  );
  const missingOrders = orders.filter((order) => !summaries.has(String(order._id)));
  const latestChildren = missingOrders.length
    ? await loadLatestPaymentChildrenByOrderIds(
        ctx,
        missingOrders.map((order) => order._id),
      )
    : {
        latestAttemptByOrderId: new Map<string, Doc<"paymentAttempts">>(),
        latestSplitByOrderId: new Map<string, Doc<"fundSplits">>(),
        latestTransferByOrderId: new Map<string, Doc<"payoutTransfers">>(),
      };

  for (const order of orders) {
    const summary = summaries.get(String(order._id));
    currency = summary?.currency || order.currency || currency;
    const amountAgorot =
      summary?.instructorBaseAmountAgorot ?? order.pricing!.instructorOfferAmountAgorot;
    lifetimeEarnedAmountAgorot += amountAgorot;

    const split = summary?.latestSplitStatus
      ? ({
          status: summary.latestSplitStatus,
        } as Doc<"fundSplits">)
      : latestChildren.latestSplitByOrderId.get(String(order._id)) ?? null;
    const transfer = summary?.latestTransferStatus
      ? ({
          status: summary.latestTransferStatus,
        } as Doc<"payoutTransfers">)
      : latestChildren.latestTransferByOrderId.get(String(order._id)) ?? null;

    const paid =
      transfer?.status === "paid" ||
      split?.status === "settled" ||
      summary?.latestTransferStatus === "paid" ||
      summary?.latestSplitStatus === "settled";
    const available =
      (summary?.status ?? order.status) === "succeeded" &&
      !paid &&
      split !== null &&
      split.status !== "failed" &&
      split.status !== "reversed" &&
      transfer?.status !== "failed" &&
      transfer?.status !== "cancelled" &&
      transfer?.status !== "needs_attention";

    if (paid) {
      paidAmountAgorot += amountAgorot;
      continue;
    }
    if (available) {
      availableAmountAgorot += amountAgorot;
      continue;
    }
    heldAmountAgorot += amountAgorot;
  }

  return {
    currency,
    lifetimeEarnedAmountAgorot,
    paidAmountAgorot,
    availableAmountAgorot,
    heldAmountAgorot,
    outstandingAmountAgorot: Math.max(0, lifetimeEarnedAmountAgorot - paidAmountAgorot),
    hasVerifiedDestination: connectedAccount?.status === "active",
  };
}
