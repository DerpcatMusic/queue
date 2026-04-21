import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireCurrentUser, requireUserRole } from "../lib/auth";
import {
  listPaymentOrdersForCurrentUser,
  loadCurrentStudio,
  loadLatestConnectedAccountForUser,
} from "./helpers";
import {
  projectFundSplit,
  projectPaymentAttempt,
  projectPaymentOffer,
  projectPaymentOrder,
} from "./projectors";
import { loadLatestPaymentChildrenByOrderIds } from "./readModels";
import { loadPaymentOrderSummariesByOrderIds } from "./summaries";
import { getPaymentOrderById, projectConnectedAccountLocal } from "./readShared";
import {
  paymentOfferSummaryValidator,
} from "./validators";
import { buildPaymentOrderDetailView, buildPayoutSummaryView } from "./views";

export const getMyPaymentOffer = query({
  args: { jobId: v.id("jobs") },
  returns: paymentOfferSummaryValidator,
  handler: async (ctx, args) => {
    const { studio } = await loadCurrentStudio(ctx);
    const offer = await ctx.db
      .query("paymentOffers")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
    if (!offer || offer.studioId !== studio._id) {
      throw new ConvexError("Payment offer not found");
    }
    return projectPaymentOffer(offer as any);
  },
});

export const listMyPaymentOrders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => await listPaymentOrdersForCurrentUser(ctx, args),
});

export const getMyPaymentOrderDetail = query({
  args: {
    paymentOrderId: v.id("paymentOrders"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const order = await getPaymentOrderById(ctx, String(args.paymentOrderId));
    if (!order) {
      return null;
    }
    if (order.studioUserId !== user._id && order.instructorUserId !== user._id) {
      throw new ConvexError("Not authorized");
    }

    const [job, attempts, splits] = await Promise.all([
      ctx.db.get("jobs", order.jobId),
      ctx.db
        .query("paymentAttempts")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("fundSplits")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
        .order("desc")
        .take(20),
    ]);

    const transfers = await Promise.all(
      splits.map((split) =>
        ctx.db
          .query("payoutTransfers")
          .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
          .order("desc")
          .first(),
      ),
    );
    const latestSplit = splits[0] ?? null;
    const latestTransfer = transfers[0] ?? null;
    return buildPaymentOrderDetailView({
      order: order as any,
      job,
      attempts,
      splits,
      transfers,
      latestSplit,
      latestTransfer,
    });
  },
});

export const getMyPayoutSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const orders = await ctx.db
      .query("paymentOrders")
      .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", user._id))
      .order("desc")
      .collect();
    const connectedAccount = await loadLatestConnectedAccountForUser(ctx, user._id, "stripe");
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
    const latestSplitByOrderId = new Map<string, Doc<"fundSplits"> | null>();
    const latestTransferByOrderId = new Map<string, Doc<"payoutTransfers"> | null>();

    for (const order of orders) {
      const summary = summaries.get(String(order._id));
      if (summary?.latestSplitStatus) {
        latestSplitByOrderId.set(
          String(order._id),
          {
            _id: summary.latestSplitId ?? order._id,
            paymentOrderId: order._id,
            paymentAttemptId: order._id as any,
            connectedAccountId: order.instructorId as any,
            provider: order.provider as any,
            sourcePaymentIntentId: summary.latestAttemptProviderPaymentIntentId ?? "",
            destinationAccountId: "",
            amountAgorot: summary.instructorBaseAmountAgorot,
            currency: summary.currency,
            autoRelease: true,
            releaseMode: "automatic",
            status: summary.latestSplitStatus,
            requestId: "",
            idempotencyKey: "",
            createdAt: summary.updatedAt,
            updatedAt: summary.updatedAt,
            ...(summary.latestSplitSettledAt ? { settledAt: summary.latestSplitSettledAt } : {}),
          } as Doc<"fundSplits">,
        );
      }
      if (summary?.latestTransferStatus) {
        latestTransferByOrderId.set(
          String(order._id),
          {
            _id: summary.latestTransferId ?? order._id,
            connectedAccountId: order.instructorId as any,
            fundSplitId: summary.latestSplitId ?? (order._id as any),
            provider: order.provider as any,
            amountAgorot: summary.instructorBaseAmountAgorot,
            currency: summary.currency,
            status: summary.latestTransferStatus,
            requestId: "",
            idempotencyKey: "",
            createdAt: summary.updatedAt,
            updatedAt: summary.updatedAt,
            ...(summary.latestTransferPaidAt ? { paidAt: summary.latestTransferPaidAt } : {}),
          } as Doc<"payoutTransfers">,
        );
      }
    }
    for (const [orderId, split] of latestChildren.latestSplitByOrderId.entries()) {
      latestSplitByOrderId.set(orderId, split);
    }
    for (const [orderId, transfer] of latestChildren.latestTransferByOrderId.entries()) {
      latestTransferByOrderId.set(orderId, transfer);
    }

    return buildPayoutSummaryView({
      orders: orders as any,
      connectedAccount,
      latestSplitByOrderId,
      latestTransferByOrderId,
    });
  },
});

export const getMyPaymentOrder = query({
  args: { paymentOrderId: v.id("paymentOrders") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { studio } = await loadCurrentStudio(ctx);
    const order = await getPaymentOrderById(ctx, String(args.paymentOrderId));
    if (!order || order.studioId !== studio._id) {
      throw new ConvexError("Payment order not found");
    }
    return projectPaymentOrder(order as any);
  },
});

export const getPaymentCheckoutContext = query({
  args: { paymentOrderId: v.id("paymentOrders") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { studio } = await loadCurrentStudio(ctx);
    const order = await getPaymentOrderById(ctx, String(args.paymentOrderId));
    if (!order || order.studioId !== studio._id) {
      return null;
    }

    if (!order.offerId) {
      return null;
    }
    const offer = await ctx.db.get("paymentOffers", order.offerId);
    if (!offer) {
      throw new ConvexError("Payment offer not found");
    }

    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();

    const connectedAccount = await loadLatestConnectedAccountForUser(
      ctx,
      order.instructorUserId,
      order.provider,
    );

    return {
      offer: projectPaymentOffer(offer),
      order: projectPaymentOrder(order),
      attempt: attempt ? projectPaymentAttempt(attempt as any) : null,
      connectedAccount: connectedAccount
        ? projectConnectedAccountLocal(connectedAccount as any)
        : null,
      instructorConnectedAccountRequired: order.provider === "stripe",
    };
  },
});

export const getFundSplitCreationContext = internalQuery({
  args: {
    paymentOrderId: v.id("paymentOrders"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const order = await getPaymentOrderById(ctx, String(args.paymentOrderId));
    if (!order) {
      return null;
    }
    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();
    const connectedAccount = await loadLatestConnectedAccountForUser(
      ctx,
      order.instructorUserId,
      order.provider,
    );
    if (!attempt || !connectedAccount) {
      return null;
    }
    const existingSplit = await ctx.db
      .query("fundSplits")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();
    return {
      order: projectPaymentOrder(order as any),
      attempt: projectPaymentAttempt(attempt as any),
      connectedAccount: projectConnectedAccountLocal(connectedAccount as any),
      existingSplit: existingSplit ? projectFundSplit(existingSplit as any) : null,
    };
  },
});
