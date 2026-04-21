import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

function getUniqueIdsInOrder<T extends string>(ids: ReadonlyArray<Id<T>>) {
  const seen = new Set<string>();
  const ordered: Id<T>[] = [];
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

export async function loadLatestPaymentChildrenByOrderIds(
  ctx: Pick<QueryCtx, "db">,
  orderIds: ReadonlyArray<Id<"paymentOrders">>,
) {
  const latestAttemptByOrderId = new Map<string, Doc<"paymentAttempts">>();
  const latestSplitByOrderId = new Map<string, Doc<"fundSplits">>();
  const latestTransferByOrderId = new Map<string, Doc<"payoutTransfers">>();

  const uniqueOrderIds = getUniqueIdsInOrder(orderIds);
  const latestAttempts = await Promise.all(
    uniqueOrderIds.map((orderId) =>
      ctx.db
        .query("paymentAttempts")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", orderId))
        .order("desc")
        .first(),
    ),
  );
  const latestSplits = await Promise.all(
    uniqueOrderIds.map((orderId) =>
      ctx.db
        .query("fundSplits")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", orderId))
        .order("desc")
        .first(),
    ),
  );

  await Promise.all(
    latestSplits.map(async (split, index) => {
      const orderId = uniqueOrderIds[index];
      const attempt = latestAttempts[index];
      if (attempt) {
        latestAttemptByOrderId.set(String(orderId), attempt);
      }
      if (!split) {
        return;
      }

      latestSplitByOrderId.set(String(orderId), split);
      const transfer = await ctx.db
        .query("payoutTransfers")
        .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
        .order("desc")
        .first();
      if (transfer) {
        latestTransferByOrderId.set(String(orderId), transfer);
      }
    }),
  );

  return {
    latestAttemptByOrderId,
    latestSplitByOrderId,
    latestTransferByOrderId,
  };
}
