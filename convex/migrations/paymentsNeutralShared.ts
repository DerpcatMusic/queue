import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";

export const DEFAULT_BATCH_SIZE = 100;
export const MAX_BATCH_SIZE = 300;

export const PAYMENT_NEUTRAL_STAGE_ORDER = [
  "paymentOffers",
  "connectedAccounts",
  "providerObjects",
  "connectedAccountRequirements",
  "payoutPreferences",
  "pricingRules",
  "paymentOrders",
  "paymentAttempts",
  "fundSplits",
  "payoutTransfers",
  "ledgerEntries",
] as const;

export type PaymentNeutralStage = (typeof PAYMENT_NEUTRAL_STAGE_ORDER)[number];

export type BackfillBatchResult = {
  processed: number;
  hasMore: boolean;
  continueCursor?: string;
};

export const paymentNeutralStageValidator = v.union(
  v.literal("paymentOffers"),
  v.literal("connectedAccounts"),
  v.literal("providerObjects"),
  v.literal("connectedAccountRequirements"),
  v.literal("payoutPreferences"),
  v.literal("pricingRules"),
  v.literal("paymentOrders"),
  v.literal("paymentAttempts"),
  v.literal("fundSplits"),
  v.literal("payoutTransfers"),
  v.literal("ledgerEntries"),
);

export function normalizeBatchSize(batchSize: number | undefined) {
  return Math.min(Math.max(batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
}

export async function paginateV2Table(
  ctx: MutationCtx,
  table: string,
  cursor: string | undefined,
  batchSize: number,
) {
  return await (ctx.db as any)
    .query(table)
    .paginate({ cursor: cursor ?? null, numItems: batchSize });
}

export async function backfillTable<T extends { _id: string }>(
  ctx: MutationCtx,
  table: string,
  cursor: string | undefined,
  batchSize: number,
  mirror: (ctx: MutationCtx, doc: T) => Promise<void>,
): Promise<BackfillBatchResult> {
  const page = await paginateV2Table(ctx, table, cursor, batchSize);
  await Promise.all(page.page.map((doc: T) => mirror(ctx, doc)));
  return {
    processed: page.page.length,
    hasMore: !page.isDone,
    ...(page.isDone ? {} : { continueCursor: page.continueCursor }),
  };
}

export function nextStage(stage: PaymentNeutralStage): PaymentNeutralStage | null {
  const index = PAYMENT_NEUTRAL_STAGE_ORDER.indexOf(stage);
  return index >= 0 && index < PAYMENT_NEUTRAL_STAGE_ORDER.length - 1
    ? PAYMENT_NEUTRAL_STAGE_ORDER[index + 1]
    : null;
}
