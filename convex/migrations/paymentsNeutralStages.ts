import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import {
  mirrorConnectedAccount,
  mirrorConnectedAccountRequirement,
  mirrorFundSplit,
  mirrorLedgerEntry,
  mirrorPaymentAttempt,
  mirrorPaymentOffer,
  mirrorPaymentOrder,
  mirrorPayoutPreference,
  mirrorPayoutTransfer,
  mirrorPricingRule,
  mirrorProviderObject,
} from "../payments/neutralMirror";
import {
  type BackfillBatchResult,
  backfillTable,
  type PaymentNeutralStage,
} from "./paymentsNeutralShared";

export function nextStage(stage: PaymentNeutralStage): PaymentNeutralStage | null {
  return stage === "paymentOffers"
    ? "connectedAccounts"
    : stage === "connectedAccounts"
      ? "providerObjects"
      : stage === "providerObjects"
        ? "connectedAccountRequirements"
        : stage === "connectedAccountRequirements"
          ? "payoutPreferences"
          : stage === "payoutPreferences"
            ? "pricingRules"
            : stage === "pricingRules"
              ? "paymentOrders"
              : stage === "paymentOrders"
                ? "paymentAttempts"
                : stage === "paymentAttempts"
                  ? "fundSplits"
                  : stage === "fundSplits"
                    ? "payoutTransfers"
                    : stage === "payoutTransfers"
                      ? "ledgerEntries"
                      : null;
}

export async function scheduleAdvance(
  ctx: MutationCtx,
  stage: PaymentNeutralStage,
  batchSize: number,
  result: BackfillBatchResult,
) {
  if (result.hasMore) {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.paymentsNeutral.backfillPaymentsNeutralBatch,
      {
        stage,
        cursor: result.continueCursor,
        batchSize,
      },
    );
    return;
  }

  const next = nextStage(stage);
  if (next) {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.paymentsNeutral.backfillPaymentsNeutralBatch,
      {
        stage: next,
        batchSize,
      },
    );
  }
}

export async function backfillStage(
  ctx: MutationCtx,
  stage: PaymentNeutralStage,
  cursor: string | undefined,
  batchSize: number,
) {
  switch (stage) {
    case "paymentOffers":
      return await backfillTable(ctx, "paymentOffersV2", cursor, batchSize, mirrorPaymentOffer);
    case "connectedAccounts":
      return await backfillTable(
        ctx,
        "connectedAccountsV2",
        cursor,
        batchSize,
        mirrorConnectedAccount,
      );
    case "providerObjects":
      return await backfillTable(ctx, "providerObjectsV2", cursor, batchSize, mirrorProviderObject);
    case "connectedAccountRequirements":
      return await backfillTable(
        ctx,
        "connectedAccountRequirementsV2",
        cursor,
        batchSize,
        mirrorConnectedAccountRequirement,
      );
    case "payoutPreferences":
      return await backfillTable(
        ctx,
        "payoutPreferencesV2",
        cursor,
        batchSize,
        mirrorPayoutPreference,
      );
    case "pricingRules":
      return await backfillTable(ctx, "pricingRulesV2", cursor, batchSize, mirrorPricingRule);
    case "paymentOrders":
      return await backfillTable(ctx, "paymentOrdersV2", cursor, batchSize, mirrorPaymentOrder);
    case "paymentAttempts":
      return await backfillTable(ctx, "paymentAttemptsV2", cursor, batchSize, mirrorPaymentAttempt);
    case "fundSplits":
      return await backfillTable(ctx, "fundSplitsV2", cursor, batchSize, mirrorFundSplit);
    case "payoutTransfers":
      return await backfillTable(ctx, "payoutTransfersV2", cursor, batchSize, mirrorPayoutTransfer);
    case "ledgerEntries":
      return await backfillTable(ctx, "ledgerEntriesV2", cursor, batchSize, mirrorLedgerEntry);
  }
}
