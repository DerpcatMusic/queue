import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

async function findMigrationRef(ctx: MutationCtx, sourceTable: string, sourceId: string) {
  return await (ctx.db as any)
    .query("paymentMigrationRefs")
    .withIndex("by_source", (q: any) => q.eq("sourceTable", sourceTable).eq("sourceId", sourceId))
    .unique();
}

async function resolveMigrationTargetId(ctx: MutationCtx, sourceTable: string, sourceId: string) {
  const ref = await findMigrationRef(ctx, sourceTable, sourceId);
  return ref ? (ref.targetId as string) : null;
}

async function upsertMigratedRow<T>(
  ctx: MutationCtx,
  sourceTable: string,
  sourceId: string,
  targetTable: string,
  value: T,
) {
  const existingRef = await findMigrationRef(ctx, sourceTable, sourceId);
  if (existingRef) {
    await ctx.db.patch(existingRef.targetId as any, value as any);
    return existingRef.targetId as string;
  }

  const targetId = await ctx.db.insert(targetTable as any, value as any);
  await (ctx.db as any).insert("paymentMigrationRefs", {
    sourceTable,
    sourceId,
    targetTable,
    targetId: String(targetId),
    createdAt: Date.now(),
  });
  return String(targetId);
}

export async function mirrorPaymentOffer(
  ctx: MutationCtx,
  offer: Doc<"paymentOffersV2">,
): Promise<void> {
  await upsertMigratedRow(ctx, "paymentOffersV2", String(offer._id), "paymentOffers", {
    jobId: offer.jobId,
    studioId: offer.studioId,
    studioUserId: offer.studioUserId,
    instructorId: offer.instructorId,
    instructorUserId: offer.instructorUserId,
    providerCountry: offer.providerCountry,
    currency: offer.currency,
    pricing: offer.pricing,
    pricingSnapshot: offer.pricingSnapshot,
    bonusReason: offer.bonusReason,
    bonusAppliedByUserId: offer.bonusAppliedByUserId,
    status: offer.status,
    expiresAt: offer.expiresAt,
    metadata: offer.metadata,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  });
}

export async function mirrorPaymentOrder(
  ctx: MutationCtx,
  order: Doc<"paymentOrdersV2">,
): Promise<void> {
  const offerId = await resolveMigrationTargetId(ctx, "paymentOffersV2", String(order.offerId));
  if (!offerId) {
    return;
  }

  await upsertMigratedRow(ctx, "paymentOrdersV2", String(order._id), "paymentOrders", {
    offerId: offerId as any,
    jobId: order.jobId,
    studioId: order.studioId,
    studioUserId: order.studioUserId,
    instructorId: order.instructorId,
    instructorUserId: order.instructorUserId,
    provider: order.provider,
    status: order.status,
    providerCountry: order.providerCountry,
    currency: order.currency,
    pricing: order.pricing,
    capturedAmountAgorot: order.capturedAmountAgorot,
    refundedAmountAgorot: order.refundedAmountAgorot,
    correlationKey: order.correlationKey,
    latestError: order.latestError,
    metadata: order.metadata,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    succeededAt: order.succeededAt,
    cancelledAt: order.cancelledAt,
  });
}

export async function mirrorConnectedAccount(
  ctx: MutationCtx,
  account: Doc<"connectedAccountsV2">,
): Promise<void> {
  await upsertMigratedRow(ctx, "connectedAccountsV2", String(account._id), "connectedAccounts", {
    userId: account.userId,
    role: account.role,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    accountCapability: account.accountCapability,
    status: account.status,
    kycStatus: account.kycStatus,
    kybStatus: account.kybStatus,
    serviceAgreementType: account.serviceAgreementType,
    country: account.country,
    currency: account.currency,
    defaultPayoutMethod: account.defaultPayoutMethod,
    metadata: account.metadata,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    activatedAt: account.activatedAt,
  });
}

export async function mirrorProviderObject(
  ctx: MutationCtx,
  object: Doc<"providerObjectsV2">,
): Promise<void> {
  await upsertMigratedRow(ctx, "providerObjectsV2", String(object._id), "providerObjects", {
    provider: object.provider,
    entityType: object.entityType,
    entityId: object.entityId,
    providerObjectType: object.providerObjectType,
    providerObjectId: object.providerObjectId,
    createdAt: object.createdAt,
  });
}

export async function mirrorConnectedAccountRequirement(
  ctx: MutationCtx,
  requirement: Doc<"connectedAccountRequirementsV2">,
): Promise<void> {
  const connectedAccountId = await resolveMigrationTargetId(
    ctx,
    "connectedAccountsV2",
    String(requirement.connectedAccountId),
  );
  if (!connectedAccountId) {
    return;
  }

  await upsertMigratedRow(
    ctx,
    "connectedAccountRequirementsV2",
    String(requirement._id),
    "connectedAccountRequirements",
    {
      connectedAccountId: connectedAccountId as any,
      providerRequirementId: requirement.providerRequirementId,
      kind: requirement.kind,
      code: requirement.code,
      message: requirement.message,
      blocking: requirement.blocking,
      resolvedAt: requirement.resolvedAt,
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
    },
  );
}

export async function mirrorPayoutPreference(
  ctx: MutationCtx,
  preference: Doc<"payoutPreferencesV2">,
): Promise<void> {
  await upsertMigratedRow(ctx, "payoutPreferencesV2", String(preference._id), "payoutPreferences", {
    userId: preference.userId,
    mode: preference.mode,
    scheduledDate: preference.scheduledDate,
    autoPayoutEnabled: preference.autoPayoutEnabled,
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt,
  });
}

export async function mirrorPricingRule(
  ctx: MutationCtx,
  rule: Doc<"pricingRulesV2">,
): Promise<void> {
  await upsertMigratedRow(ctx, "pricingRulesV2", String(rule._id), "pricingRules", {
    code: rule.code,
    country: rule.country,
    currency: rule.currency,
    basePlatformFeeAgorot: rule.basePlatformFeeAgorot,
    bonusPlatformFeeAgorot: rule.bonusPlatformFeeAgorot,
    bonusTriggerMode: rule.bonusTriggerMode,
    active: rule.active,
    version: rule.version,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  });
}

export async function mirrorPaymentAttempt(
  ctx: MutationCtx,
  attempt: Doc<"paymentAttemptsV2">,
): Promise<void> {
  const paymentOrderId = await resolveMigrationTargetId(
    ctx,
    "paymentOrdersV2",
    String(attempt.paymentOrderId),
  );
  if (!paymentOrderId) {
    return;
  }

  await upsertMigratedRow(ctx, "paymentAttemptsV2", String(attempt._id), "paymentAttempts", {
    paymentOrderId: paymentOrderId as any,
    provider: attempt.provider,
    providerPaymentIntentId: attempt.providerPaymentIntentId,
    providerAttemptId: attempt.providerAttemptId,
    clientSecretRef: attempt.clientSecretRef,
    status: attempt.status,
    statusRaw: attempt.statusRaw,
    requestId: attempt.requestId,
    idempotencyKey: attempt.idempotencyKey,
    lastError: attempt.lastError,
    metadata: attempt.metadata,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  });
}

export async function mirrorFundSplit(ctx: MutationCtx, split: Doc<"fundSplitsV2">): Promise<void> {
  const [paymentOrderId, paymentAttemptId, connectedAccountId] = await Promise.all([
    resolveMigrationTargetId(ctx, "paymentOrdersV2", String(split.paymentOrderId)),
    resolveMigrationTargetId(ctx, "paymentAttemptsV2", String(split.paymentAttemptId)),
    resolveMigrationTargetId(ctx, "connectedAccountsV2", String(split.connectedAccountId)),
  ]);
  if (!paymentOrderId || !paymentAttemptId || !connectedAccountId) {
    return;
  }

  await upsertMigratedRow(ctx, "fundSplitsV2", String(split._id), "fundSplits", {
    paymentOrderId: paymentOrderId as any,
    paymentAttemptId: paymentAttemptId as any,
    connectedAccountId: connectedAccountId as any,
    provider: split.provider,
    providerFundsSplitId: split.providerFundsSplitId,
    sourcePaymentIntentId: split.sourcePaymentIntentId,
    destinationAccountId: split.destinationAccountId,
    amountAgorot: split.amountAgorot,
    currency: split.currency,
    autoRelease: split.autoRelease,
    releaseMode: split.releaseMode,
    status: split.status,
    requestId: split.requestId,
    idempotencyKey: split.idempotencyKey,
    failureReason: split.failureReason,
    metadata: split.metadata,
    createdAt: split.createdAt,
    updatedAt: split.updatedAt,
    releasedAt: split.releasedAt,
    settledAt: split.settledAt,
  });
}

export async function mirrorPayoutTransfer(
  ctx: MutationCtx,
  transfer: Doc<"payoutTransfersV2">,
): Promise<void> {
  const [connectedAccountId, fundSplitId] = await Promise.all([
    resolveMigrationTargetId(ctx, "connectedAccountsV2", String(transfer.connectedAccountId)),
    resolveMigrationTargetId(ctx, "fundSplitsV2", String(transfer.fundSplitId)),
  ]);
  if (!connectedAccountId || !fundSplitId) {
    return;
  }

  await upsertMigratedRow(ctx, "payoutTransfersV2", String(transfer._id), "payoutTransfers", {
    connectedAccountId: connectedAccountId as any,
    fundSplitId: fundSplitId as any,
    provider: transfer.provider,
    providerTransferId: transfer.providerTransferId,
    amountAgorot: transfer.amountAgorot,
    currency: transfer.currency,
    status: transfer.status,
    statusRaw: transfer.statusRaw,
    requestId: transfer.requestId,
    idempotencyKey: transfer.idempotencyKey,
    failureReason: transfer.failureReason,
    metadata: transfer.metadata,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    paidAt: transfer.paidAt,
  });
}

export async function mirrorLedgerEntry(
  ctx: MutationCtx,
  entry: Doc<"ledgerEntriesV2">,
): Promise<void> {
  const [paymentOrderId, paymentAttemptId, fundSplitId, payoutTransferId] = await Promise.all([
    resolveMigrationTargetId(ctx, "paymentOrdersV2", String(entry.paymentOrderId)),
    entry.paymentAttemptId
      ? resolveMigrationTargetId(ctx, "paymentAttemptsV2", String(entry.paymentAttemptId))
      : Promise.resolve(null),
    entry.fundSplitId
      ? resolveMigrationTargetId(ctx, "fundSplitsV2", String(entry.fundSplitId))
      : Promise.resolve(null),
    entry.payoutTransferId
      ? resolveMigrationTargetId(ctx, "payoutTransfersV2", String(entry.payoutTransferId))
      : Promise.resolve(null),
  ]);
  if (!paymentOrderId) {
    return;
  }

  await upsertMigratedRow(ctx, "ledgerEntriesV2", String(entry._id), "ledgerEntries", {
    paymentOrderId: paymentOrderId as any,
    ...(paymentAttemptId ? { paymentAttemptId: paymentAttemptId as any } : {}),
    ...(fundSplitId ? { fundSplitId: fundSplitId as any } : {}),
    ...(payoutTransferId ? { payoutTransferId: payoutTransferId as any } : {}),
    jobId: entry.jobId,
    studioUserId: entry.studioUserId,
    instructorUserId: entry.instructorUserId,
    entryType: entry.entryType,
    bucket: entry.bucket,
    amountAgorot: entry.amountAgorot,
    currency: entry.currency,
    dedupeKey: entry.dedupeKey,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    createdAt: entry.createdAt,
  });
}
