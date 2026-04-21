import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import { loadLatestConnectedAccountForUser } from "./helpers";
import { mirrorFundSplit } from "./neutralMirror";
import { refreshPaymentOrderSummary } from "./summaries";
import { projectFundSplit } from "./projectors";
import { fundSplitSummaryValidator, paymentProviderValidator } from "./validators";

export const syncStripeDestinationChargeFundSplit = internalMutation({
  args: {
    providerPaymentIntentId: v.string(),
    providerFundsSplitId: v.optional(v.string()),
    destinationAccountId: v.string(),
    settledAt: v.optional(v.number()),
  },
  returns: v.union(v.null(), fundSplitSummaryValidator),
  handler: async (ctx, args): Promise<any> => {
    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_provider_payment_intent", (q) =>
        q.eq("provider", "stripe").eq("providerPaymentIntentId", args.providerPaymentIntentId),
      )
      .unique();
    if (!attempt) {
      return null;
    }

    const order = await ctx.db.get(attempt.paymentOrderId);
    if (!order) {
      return null;
    }

    const connectedAccount = await loadLatestConnectedAccountForUser(
      ctx,
      order.instructorUserId,
      "stripe",
    );
    if (!connectedAccount || connectedAccount.provider !== "stripe") {
      return null;
    }

    return await ctx.runMutation(internal.payments.core.upsertFundSplitFromProvider, {
      paymentOrderId: order._id,
      paymentAttemptId: attempt._id,
      connectedAccountId: connectedAccount._id,
      provider: "stripe",
      sourcePaymentIntentId: attempt.providerPaymentIntentId,
      destinationAccountId: args.destinationAccountId,
      amountAgorot: order.pricing!.instructorOfferAmountAgorot,
      currency: order.currency,
      autoRelease: true,
      releaseMode: "automatic",
      status: "settled",
      requestId: `stripe-fund-split:${args.providerPaymentIntentId}`,
      idempotencyKey: `stripe-fund-split:${args.providerPaymentIntentId}`,
      ...omitUndefined({
        providerFundsSplitId: args.providerFundsSplitId,
        settledAt: args.settledAt ?? Date.now(),
        releasedAt: args.settledAt ?? Date.now(),
      }),
    });
  },
});

export const upsertFundSplitFromProvider = internalMutation({
  args: {
    paymentOrderId: v.id("paymentOrders"),
    paymentAttemptId: v.id("paymentAttempts"),
    connectedAccountId: v.id("connectedAccounts"),
    provider: paymentProviderValidator,
    providerFundsSplitId: v.optional(v.string()),
    sourcePaymentIntentId: v.string(),
    destinationAccountId: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    autoRelease: v.boolean(),
    releaseMode: v.union(v.literal("automatic"), v.literal("manual"), v.literal("scheduled")),
    status: v.union(
      v.literal("pending_create"),
      v.literal("created"),
      v.literal("released"),
      v.literal("settled"),
      v.literal("failed"),
      v.literal("reversed"),
    ),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    releasedAt: v.optional(v.number()),
    settledAt: v.optional(v.number()),
  },
  returns: fundSplitSummaryValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing =
      (args.providerFundsSplitId
        ? await ctx.db
            .query("fundSplits")
            .withIndex("by_provider_split", (q) =>
              q.eq("provider", args.provider).eq("providerFundsSplitId", args.providerFundsSplitId),
            )
            .unique()
        : null) ??
      (await ctx.db
        .query("fundSplits")
        .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", args.paymentOrderId))
        .order("desc")
        .first());

    if (existing) {
      await ctx.db.patch(existing._id, {
        paymentAttemptId: args.paymentAttemptId,
        connectedAccountId: args.connectedAccountId,
        sourcePaymentIntentId: args.sourcePaymentIntentId,
        destinationAccountId: args.destinationAccountId,
        amountAgorot: args.amountAgorot,
        currency: args.currency,
        autoRelease: args.autoRelease,
        releaseMode: args.releaseMode,
        status: args.status,
        requestId: args.requestId,
        idempotencyKey: args.idempotencyKey,
        updatedAt: now,
        ...omitUndefined({
          providerFundsSplitId: args.providerFundsSplitId,
          failureReason: args.failureReason,
          releasedAt: args.releasedAt,
          settledAt: args.settledAt,
        }),
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update fund split");
      }
      await mirrorFundSplit(ctx, updated as any);
      const order = await ctx.db.get(updated.paymentOrderId);
      if (order) {
        await refreshPaymentOrderSummary(ctx, order);
      }
      return projectFundSplit(updated);
    }

    const splitId = await ctx.db.insert("fundSplits", {
      paymentOrderId: args.paymentOrderId,
      paymentAttemptId: args.paymentAttemptId,
      connectedAccountId: args.connectedAccountId,
      provider: args.provider,
      sourcePaymentIntentId: args.sourcePaymentIntentId,
      destinationAccountId: args.destinationAccountId,
      amountAgorot: args.amountAgorot,
      currency: args.currency,
      autoRelease: args.autoRelease,
      releaseMode: args.releaseMode,
      status: args.status,
      requestId: args.requestId,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        providerFundsSplitId: args.providerFundsSplitId,
        failureReason: args.failureReason,
        releasedAt: args.releasedAt,
        settledAt: args.settledAt,
      }),
    });
    const split = await ctx.db.get(splitId);
    if (!split) {
      throw new ConvexError("Failed to create fund split");
    }
    await mirrorFundSplit(ctx, split as any);
    const order = await ctx.db.get(split.paymentOrderId);
    if (order) {
      await refreshPaymentOrderSummary(ctx, order);
    }
    return projectFundSplit(split);
  },
});
