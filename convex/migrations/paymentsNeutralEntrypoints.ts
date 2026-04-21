import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import {
  type BackfillBatchResult,
  normalizeBatchSize,
  paymentNeutralStageValidator,
} from "./paymentsNeutralShared";
import { backfillStage, scheduleAdvance } from "./paymentsNeutralStages";

function makeStageResultValidator() {
  return v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.optional(v.string()),
  });
}

export const backfillPaymentsNeutralBatch = internalMutation({
  args: {
    stage: paymentNeutralStageValidator,
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result: BackfillBatchResult = await backfillStage(
      ctx,
      args.stage,
      args.cursor,
      batchSize,
    );
    await scheduleAdvance(ctx, args.stage, batchSize, result);
    return result;
  },
});

export const backfillPaymentOffersNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "paymentOffers", args.cursor, batchSize);
    await scheduleAdvance(ctx, "paymentOffers", batchSize, result);
    return result;
  },
});

export const backfillConnectedAccountsNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "connectedAccounts", args.cursor, batchSize);
    await scheduleAdvance(ctx, "connectedAccounts", batchSize, result);
    return result;
  },
});

export const backfillProviderObjectsNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "providerObjects", args.cursor, batchSize);
    await scheduleAdvance(ctx, "providerObjects", batchSize, result);
    return result;
  },
});

export const backfillConnectedAccountRequirementsNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "connectedAccountRequirements", args.cursor, batchSize);
    await scheduleAdvance(ctx, "connectedAccountRequirements", batchSize, result);
    return result;
  },
});

export const backfillPayoutPreferencesNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "payoutPreferences", args.cursor, batchSize);
    await scheduleAdvance(ctx, "payoutPreferences", batchSize, result);
    return result;
  },
});

export const backfillPricingRulesNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "pricingRules", args.cursor, batchSize);
    await scheduleAdvance(ctx, "pricingRules", batchSize, result);
    return result;
  },
});

export const backfillPaymentOrdersNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "paymentOrders", args.cursor, batchSize);
    await scheduleAdvance(ctx, "paymentOrders", batchSize, result);
    return result;
  },
});

export const backfillPaymentAttemptsNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "paymentAttempts", args.cursor, batchSize);
    await scheduleAdvance(ctx, "paymentAttempts", batchSize, result);
    return result;
  },
});

export const backfillFundSplitsNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "fundSplits", args.cursor, batchSize);
    await scheduleAdvance(ctx, "fundSplits", batchSize, result);
    return result;
  },
});

export const backfillPayoutTransfersNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "payoutTransfers", args.cursor, batchSize);
    await scheduleAdvance(ctx, "payoutTransfers", batchSize, result);
    return result;
  },
});

export const backfillLedgerEntriesNeutralBatch = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: makeStageResultValidator(),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const result = await backfillStage(ctx, "ledgerEntries", args.cursor, batchSize);
    await scheduleAdvance(ctx, "ledgerEntries", batchSize, result);
    return result;
  },
});

export const startPaymentsNeutralBackfill = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.paymentsNeutral.backfillPaymentsNeutralBatch,
      {
        stage: "paymentOffers",
        batchSize: normalizeBatchSize(args.batchSize),
      },
    );
    return null;
  },
});
