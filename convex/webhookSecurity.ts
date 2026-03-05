import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const DEFAULT_INVALID_SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_INVALID_SIGNATURE_MAX_ATTEMPTS = 5;
const DEFAULT_INVALID_SIGNATURE_BLOCK_MS = 15 * 60 * 1000;
const DEFAULT_CLEANUP_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_BATCH_SIZE = 100;

const webhookProviderValidator = v.union(v.literal("rapyd"), v.literal("didit"));
const cleanupCursorValidator = v.object({
  paymentEvents: v.optional(v.string()),
  payoutDestinationEvents: v.optional(v.string()),
  diditEvents: v.optional(v.string()),
  throttleRows: v.optional(v.string()),
});

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getInvalidSignatureWindowMs = (): number =>
  Math.min(
    24 * 60 * 60 * 1000,
    parsePositiveInt(
      process.env.WEBHOOK_INVALID_SIGNATURE_WINDOW_MS,
      DEFAULT_INVALID_SIGNATURE_WINDOW_MS,
    ),
  );

const getInvalidSignatureMaxAttempts = (): number =>
  Math.min(
    100,
    parsePositiveInt(
      process.env.WEBHOOK_INVALID_SIGNATURE_MAX_ATTEMPTS,
      DEFAULT_INVALID_SIGNATURE_MAX_ATTEMPTS,
    ),
  );

const getInvalidSignatureBlockMs = (): number =>
  Math.min(
    24 * 60 * 60 * 1000,
    parsePositiveInt(
      process.env.WEBHOOK_INVALID_SIGNATURE_BLOCK_MS,
      DEFAULT_INVALID_SIGNATURE_BLOCK_MS,
    ),
  );

const normalizeBatchSize = (batchSize: number | undefined): number =>
  Math.min(
    500,
    Math.max(
      1,
      Number.isFinite(batchSize) ? Math.floor(batchSize as number) : DEFAULT_CLEANUP_BATCH_SIZE,
    ),
  );

const buildPrunedPayload = (payloadHash: string, now: number): Record<string, unknown> => ({
  pruned: true,
  payloadHash,
  prunedAt: now,
});

const isAlreadyPruned = (payload: unknown): boolean =>
  Boolean(payload && typeof payload === "object" && (payload as { pruned?: boolean }).pruned === true);

export const checkInvalidSignatureThrottle = internalMutation({
  args: {
    provider: webhookProviderValidator,
    fingerprint: v.string(),
  },
  returns: v.object({
    blocked: v.boolean(),
    blockedUntil: v.optional(v.number()),
    invalidCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const state = await db
      .query("webhookInvalidSignatureThrottle")
      .withIndex("by_provider_fingerprint", (q: any) =>
        q.eq("provider", args.provider).eq("fingerprint", args.fingerprint),
      )
      .unique();

    if (!state) {
      return {
        blocked: false,
        invalidCount: 0,
      };
    }

    const now = Date.now();
    const blocked = typeof state.blockedUntil === "number" && state.blockedUntil > now;
    return blocked
      ? {
          blocked: true,
          blockedUntil: state.blockedUntil as number,
          invalidCount: Number(state.invalidCount ?? 0),
        }
      : {
          blocked: false,
          invalidCount: Number(state.invalidCount ?? 0),
        };
  },
});

export const recordInvalidSignatureAttempt = internalMutation({
  args: {
    provider: webhookProviderValidator,
    fingerprint: v.string(),
  },
  returns: v.object({
    blocked: v.boolean(),
    blockedUntil: v.optional(v.number()),
    invalidCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const now = Date.now();
    const windowMs = getInvalidSignatureWindowMs();
    const blockMs = getInvalidSignatureBlockMs();
    const maxAttempts = getInvalidSignatureMaxAttempts();

    const existing = await db
      .query("webhookInvalidSignatureThrottle")
      .withIndex("by_provider_fingerprint", (q: any) =>
        q.eq("provider", args.provider).eq("fingerprint", args.fingerprint),
      )
      .unique();

    if (!existing) {
      const blockedUntil = maxAttempts <= 1 ? now + blockMs : undefined;
      await db.insert("webhookInvalidSignatureThrottle", {
        provider: args.provider,
        fingerprint: args.fingerprint,
        invalidCount: 1,
        windowStartedAt: now,
        lastInvalidAt: now,
        blockedUntil,
        createdAt: now,
        updatedAt: now,
      });
      if (typeof blockedUntil === "number" && blockedUntil > now) {
        return {
          blocked: true,
          blockedUntil,
          invalidCount: 1,
        };
      }
      return {
        blocked: false,
        invalidCount: 1,
      };
    }

    const windowReset = now - existing.windowStartedAt > windowMs;
    const nextInvalidCount = (windowReset ? 0 : Number(existing.invalidCount ?? 0)) + 1;
    const nextWindowStartedAt = windowReset ? now : existing.windowStartedAt;
    const stillBlocked = typeof existing.blockedUntil === "number" && existing.blockedUntil > now;
    const shouldBlock = stillBlocked || nextInvalidCount >= maxAttempts;
    const nextBlockedUntil = shouldBlock
      ? Math.max(existing.blockedUntil ?? now, now) + blockMs
      : undefined;

    await db.patch(existing._id, {
      invalidCount: nextInvalidCount,
      windowStartedAt: nextWindowStartedAt,
      lastInvalidAt: now,
      blockedUntil: nextBlockedUntil,
      updatedAt: now,
    });

    if (typeof nextBlockedUntil === "number" && nextBlockedUntil > now) {
      return {
        blocked: true,
        blockedUntil: nextBlockedUntil,
        invalidCount: nextInvalidCount,
      };
    }
    return {
      blocked: false,
      invalidCount: nextInvalidCount,
    };
  },
});

export const clearInvalidSignatureThrottle = internalMutation({
  args: {
    provider: webhookProviderValidator,
    fingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const existing = await db
      .query("webhookInvalidSignatureThrottle")
      .withIndex("by_provider_fingerprint", (q: any) =>
        q.eq("provider", args.provider).eq("fingerprint", args.fingerprint),
      )
      .unique();
    if (existing) {
      await db.delete(existing._id);
    }
    return null;
  },
});

export const cleanupStaleWebhookArtifacts = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    cursors: v.optional(cleanupCursorValidator),
  },
  returns: v.object({
    paymentEventsPruned: v.number(),
    payoutDestinationEventsPruned: v.number(),
    diditEventsPruned: v.number(),
    throttleRowsDeleted: v.number(),
    hasMore: v.boolean(),
    continueCursors: cleanupCursorValidator,
  }),
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const now = Date.now();
    const olderThanMs = Math.min(
      365 * 24 * 60 * 60 * 1000,
      Math.max(
        60 * 1000,
        Number.isFinite(args.olderThanMs)
          ? Math.floor(args.olderThanMs as number)
          : DEFAULT_CLEANUP_AGE_MS,
      ),
    );
    const cutoff = now - olderThanMs;
    const batchSize = normalizeBatchSize(args.batchSize);
    const cursors = args.cursors ?? {};

    let paymentEventsPruned = 0;
    const paymentEventsPage = await ctx.db
      .query("paymentEvents")
      .paginate({ cursor: cursors.paymentEvents ?? null, numItems: batchSize });
    for (const event of paymentEventsPage.page) {
      if (event.updatedAt > cutoff || isAlreadyPruned(event.payload)) continue;
      await ctx.db.patch(event._id, {
        payload: buildPrunedPayload(event.payloadHash, now),
        updatedAt: now,
      });
      paymentEventsPruned += 1;
    }

    let payoutDestinationEventsPruned = 0;
    const payoutDestinationEventsPage = await ctx.db
      .query("payoutDestinationEvents")
      .paginate({ cursor: cursors.payoutDestinationEvents ?? null, numItems: batchSize });
    for (const event of payoutDestinationEventsPage.page) {
      if (event.updatedAt > cutoff || isAlreadyPruned(event.payload)) continue;
      await ctx.db.patch(event._id, {
        payload: buildPrunedPayload(event.payloadHash, now),
        updatedAt: now,
      });
      payoutDestinationEventsPruned += 1;
    }

    let diditEventsPruned = 0;
    const diditEventsPage = await ctx.db
      .query("diditEvents")
      .paginate({ cursor: cursors.diditEvents ?? null, numItems: batchSize });
    for (const event of diditEventsPage.page) {
      if (event.updatedAt > cutoff || isAlreadyPruned(event.payload)) continue;
      await ctx.db.patch(event._id, {
        payload: buildPrunedPayload(event.payloadHash, now),
        updatedAt: now,
      });
      diditEventsPruned += 1;
    }

    let throttleRowsDeleted = 0;
    const throttleRowsPage = await db
      .query("webhookInvalidSignatureThrottle")
      .paginate({ cursor: cursors.throttleRows ?? null, numItems: batchSize });
    for (const row of throttleRowsPage.page) {
      const blocked = typeof row.blockedUntil === "number" && row.blockedUntil > now;
      if (blocked || row.lastInvalidAt > cutoff) continue;
      await db.delete(row._id);
      throttleRowsDeleted += 1;
    }

    const continueCursors = {
      ...(paymentEventsPage.isDone ? {} : { paymentEvents: paymentEventsPage.continueCursor }),
      ...(payoutDestinationEventsPage.isDone
        ? {}
        : { payoutDestinationEvents: payoutDestinationEventsPage.continueCursor }),
      ...(diditEventsPage.isDone ? {} : { diditEvents: diditEventsPage.continueCursor }),
      ...(throttleRowsPage.isDone ? {} : { throttleRows: throttleRowsPage.continueCursor }),
    };

    return {
      paymentEventsPruned,
      payoutDestinationEventsPruned,
      diditEventsPruned,
      throttleRowsDeleted,
      hasMore: Object.keys(continueCursors).length > 0,
      continueCursors,
    };
  },
});
