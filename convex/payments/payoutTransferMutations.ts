import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import { mirrorPayoutTransfer } from "./neutralMirror";
import { refreshPaymentOrderSummary } from "./summaries";
import { paymentProviderValidator, payoutTransferStatusValidator } from "./validators";

export const ensureStripePendingPayoutTransferForFundSplit = internalMutation({
  args: {
    fundSplitId: v.id("fundSplits"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("payoutTransfers"),
      fundSplitId: v.id("fundSplits"),
      connectedAccountId: v.id("connectedAccounts"),
      provider: paymentProviderValidator,
      providerTransferId: v.optional(v.string()),
      amountAgorot: v.number(),
      currency: v.string(),
      status: payoutTransferStatusValidator,
      statusRaw: v.optional(v.string()),
      requestId: v.string(),
      idempotencyKey: v.string(),
      failureReason: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      paidAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const split = await ctx.db.get(args.fundSplitId);
    if (!split || split.provider !== "stripe") {
      return null;
    }

    const existing = await ctx.db
      .query("payoutTransfers")
      .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
      .order("desc")
      .first();
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const transferId = await ctx.db.insert("payoutTransfers", {
      connectedAccountId: split.connectedAccountId,
      fundSplitId: split._id,
      provider: "stripe",
      amountAgorot: split.amountAgorot,
      currency: split.currency,
      status: "pending",
      statusRaw: "pending",
      requestId: `stripe-payout-pending:${split._id}`,
      idempotencyKey: `stripe-payout-pending:${split._id}`,
      metadata: {
        sourcePaymentIntentId: split.sourcePaymentIntentId,
      },
      createdAt: now,
      updatedAt: now,
    });
    const transfer = await ctx.db.get(transferId);
    if (transfer) {
      const order = await ctx.db.get(split.paymentOrderId);
      if (order) {
        await refreshPaymentOrderSummary(ctx, order);
      }
    }
    return transfer;
  },
});

export const reconcileStripePayoutWebhook = internalMutation({
  args: {
    providerAccountId: v.string(),
    providerPayoutId: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    status: payoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const connectedAccount = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", "stripe").eq("providerAccountId", args.providerAccountId),
      )
      .unique();
    if (!connectedAccount) {
      return null;
    }

    const direct = await ctx.db
      .query("payoutTransfers")
      .withIndex("by_provider_transfer", (q) =>
        q.eq("provider", "stripe").eq("providerTransferId", args.providerPayoutId),
      )
      .unique();
    if (direct) {
      await ctx.db.patch(direct._id, {
        status: args.status,
        statusRaw: args.statusRaw,
        updatedAt: now,
        ...omitUndefined({
          failureReason: args.failureReason,
          paidAt: args.paidAt,
          metadata: args.metadata
            ? {
                ...(direct.metadata ?? {}),
                ...args.metadata,
              }
            : undefined,
        }),
      });
      const split = await ctx.db.get(direct.fundSplitId);
      if (split) {
        const order = await ctx.db.get(split.paymentOrderId);
        if (order) {
          await refreshPaymentOrderSummary(ctx, order);
        }
      }
      return null;
    }

    const openTransfers = (
      await ctx.db
        .query("payoutTransfers")
        .withIndex("by_connected_account", (q) => q.eq("connectedAccountId", connectedAccount._id))
        .order("asc")
        .take(100)
    ).filter(
      (transfer) =>
        transfer.provider === "stripe" &&
        transfer.currency.toUpperCase() === args.currency.toUpperCase() &&
        transfer.status !== "paid" &&
        transfer.status !== "failed" &&
        transfer.status !== "cancelled",
    );

    const exactMatches = openTransfers.filter(
      (transfer) => transfer.amountAgorot === args.amountAgorot,
    );
    const firstOpenTransfer = openTransfers[0];
    const candidate =
      exactMatches.length === 1
        ? exactMatches[0]
        : openTransfers.length === 1 &&
            firstOpenTransfer &&
            firstOpenTransfer.amountAgorot <= args.amountAgorot
          ? firstOpenTransfer
          : null;

    if (!candidate) {
      return null;
    }

    await ctx.db.patch(candidate._id, {
      providerTransferId: args.providerPayoutId,
      status: args.status,
      statusRaw: args.statusRaw,
      updatedAt: now,
      ...omitUndefined({
        failureReason: args.failureReason,
        paidAt: args.paidAt,
        metadata: args.metadata
          ? {
              ...(candidate.metadata ?? {}),
              ...args.metadata,
            }
          : undefined,
        }),
      });
    const split = await ctx.db.get(candidate.fundSplitId);
    if (split) {
      const order = await ctx.db.get(split.paymentOrderId);
      if (order) {
        await refreshPaymentOrderSummary(ctx, order);
      }
    }

    return null;
  },
});

export const upsertPayoutTransferFromProvider = internalMutation({
  args: {
    fundSplitId: v.id("fundSplits"),
    connectedAccountId: v.id("connectedAccounts"),
    provider: paymentProviderValidator,
    providerTransferId: v.optional(v.string()),
    amountAgorot: v.number(),
    currency: v.string(),
    status: payoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  },
  returns: v.object({
    _id: v.id("payoutTransfers"),
    fundSplitId: v.id("fundSplits"),
    connectedAccountId: v.id("connectedAccounts"),
    provider: paymentProviderValidator,
    providerTransferId: v.optional(v.string()),
    amountAgorot: v.number(),
    currency: v.string(),
    status: payoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    paidAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = args.providerTransferId
      ? await ctx.db
          .query("payoutTransfers")
          .withIndex("by_provider_transfer", (q) =>
            q.eq("provider", args.provider).eq("providerTransferId", args.providerTransferId),
          )
          .unique()
      : null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        fundSplitId: args.fundSplitId,
        connectedAccountId: args.connectedAccountId,
        amountAgorot: args.amountAgorot,
        currency: args.currency,
        status: args.status,
        statusRaw: args.statusRaw,
        requestId: args.requestId,
        idempotencyKey: args.idempotencyKey,
        updatedAt: now,
        ...omitUndefined({
          providerTransferId: args.providerTransferId,
          failureReason: args.failureReason,
          paidAt: args.paidAt,
        }),
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new ConvexError("Failed to update payout transfer");
      }
      await mirrorPayoutTransfer(ctx, updated as any);
      const split = await ctx.db.get(updated.fundSplitId);
      if (split) {
        const order = await ctx.db.get(split.paymentOrderId);
        if (order) {
          await refreshPaymentOrderSummary(ctx, order);
        }
      }
      return updated;
    }

    const transferId = await ctx.db.insert("payoutTransfers", {
      connectedAccountId: args.connectedAccountId,
      fundSplitId: args.fundSplitId,
      provider: args.provider,
      amountAgorot: args.amountAgorot,
      currency: args.currency,
      status: args.status,
      requestId: args.requestId,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        providerTransferId: args.providerTransferId,
        failureReason: args.failureReason,
        paidAt: args.paidAt,
      }),
    });
    const transfer = await ctx.db.get(transferId);
    if (!transfer) {
      throw new ConvexError("Failed to create payout transfer");
    }
    await mirrorPayoutTransfer(ctx, transfer as any);
    const split = await ctx.db.get(transfer.fundSplitId);
    if (split) {
      const order = await ctx.db.get(split.paymentOrderId);
      if (order) {
        await refreshPaymentOrderSummary(ctx, order);
      }
    }
    return transfer;
  },
});
