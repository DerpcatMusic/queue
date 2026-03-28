/**
 * Server-Side API Rate Limiting
 *
 * Provides comprehensive rate limiting for all public Convex APIs.
 * Uses sliding window algorithm with per-identifier tracking.
 *
 * Rate limits:
 * - Auth operations: 10/minute per user/IP
 * - Queries: 100/minute per user
 * - Mutations: 50/minute per user
 * - Payment mutations: 20/minute per user
 *
 * All limits are configurable via environment variables.
 */

import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_AUTH_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_AUTH_MAX_REQUESTS = 10;
const DEFAULT_AUTH_BLOCK_MS = 15 * 60 * 1000; // 15 minutes

const DEFAULT_QUERY_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_QUERY_MAX_REQUESTS = 100;
const DEFAULT_QUERY_BLOCK_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_MUTATION_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MUTATION_MAX_REQUESTS = 50;
const DEFAULT_MUTATION_BLOCK_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_PAYMENT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_PAYMENT_MAX_REQUESTS = 20;
const DEFAULT_PAYMENT_BLOCK_MS = 10 * 60 * 1000; // 10 minutes

const DEFAULT_WEBHOOK_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_WEBHOOK_MAX_REQUESTS = 60;
const DEFAULT_WEBHOOK_BLOCK_MS = 5 * 60 * 1000; // 5 minutes

type OperationType = "query" | "mutation" | "auth" | "payment" | "webhook";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockMs: number;
}

const getConfig = (type: OperationType): RateLimitConfig => {
  const prefix = `RATELIMIT_${type.toUpperCase()}_`;

  const parseEnv = (suffix: string, fallback: number): number => {
    const val = process.env[`${prefix}${suffix}`];
    if (val) {
      const parsed = Number.parseInt(val, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };

  switch (type) {
    case "auth":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_AUTH_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_AUTH_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_AUTH_BLOCK_MS),
      };
    case "payment":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_PAYMENT_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_PAYMENT_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_PAYMENT_BLOCK_MS),
      };
    case "webhook":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_WEBHOOK_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_WEBHOOK_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_WEBHOOK_BLOCK_MS),
      };
    case "mutation":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_MUTATION_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_MUTATION_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_MUTATION_BLOCK_MS),
      };
    case "query":
    default:
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_QUERY_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_QUERY_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_QUERY_BLOCK_MS),
      };
  }
};

// ============================================
// HELPERS
// ============================================

/**
 * Build a fingerprint for rate limiting from request context.
 * Combines userId (if authenticated) with IP hash for anonymous users.
 */
export function buildRateLimitFingerprint(args: { userId?: string; ipAddress?: string }): string {
  if (args.userId) {
    return `user:${args.userId}`;
  }
  if (args.ipAddress) {
    // Hash the IP to avoid storing raw IPs
    return `ip:${simpleHash(args.ipAddress)}`;
  }
  return `anonymous:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/**
 * Simple string hash for fingerprinting.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================
// RATE LIMIT CHECK (Internal Mutation)
// ============================================

export const checkRateLimit = {
  args: {
    identifier: v.string(),
    operationType: v.union(
      v.literal("query"),
      v.literal("mutation"),
      v.literal("auth"),
      v.literal("payment"),
      v.literal("webhook"),
    ),
  },
  returns: v.object({
    allowed: v.boolean(),
    currentCount: v.number(),
    limit: v.number(),
    blockedUntil: v.optional(v.number()),
    retryAfterMs: v.optional(v.number()),
  }),
  handler: async (ctx: MutationCtx, args: { identifier: string; operationType: OperationType }) => {
    const config = getConfig(args.operationType);
    const now = Date.now();
    const db = ctx.db as any;

    // Get or create throttle record
    const existing = await db
      .query("apiRateLimitThrottle")
      .withIndex("by_identifier_type", (q: any) =>
        q.eq("identifier", args.identifier).eq("operationType", args.operationType),
      )
      .unique();

    // Check if currently blocked
    if (existing?.blockedUntil && existing.blockedUntil > now) {
      return {
        allowed: false,
        currentCount: Number(existing.requestCount ?? 0),
        limit: config.maxRequests,
        blockedUntil: existing.blockedUntil as number,
        retryAfterMs: (existing.blockedUntil as number) - now,
      };
    }

    // Reset window if expired
    if (!existing || now - existing.windowStartedAt > config.windowMs) {
      if (!existing) {
        await db.insert("apiRateLimitThrottle", {
          identifier: args.identifier,
          operationType: args.operationType,
          windowStartedAt: now,
          requestCount: 1,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await db.patch(existing._id, {
          windowStartedAt: now,
          requestCount: 1,
          blockedUntil: undefined,
          updatedAt: now,
        });
      }
      return {
        allowed: true,
        currentCount: 1,
        limit: config.maxRequests,
        blockedUntil: undefined,
        retryAfterMs: undefined,
      };
    }

    // Increment count
    const newCount = Number(existing.requestCount ?? 0) + 1;
    const shouldBlock = newCount > config.maxRequests;
    const blockedUntil = shouldBlock ? now + config.blockMs : undefined;

    await db.patch(existing._id, {
      requestCount: newCount,
      blockedUntil,
      updatedAt: now,
    });

    return {
      allowed: !shouldBlock,
      currentCount: newCount,
      limit: config.maxRequests,
      blockedUntil,
      retryAfterMs: shouldBlock ? config.blockMs : undefined,
    };
  },
};

// ============================================
// RATE LIMIT ENFORCEMENT
// ============================================

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  blockedUntil?: number;
  retryAfterMs?: number;
}

/**
 * Check rate limit and throw if exceeded.
 * Use this in mutations and queries to enforce rate limits.
 */
export async function enforceRateLimit(
  ctx: MutationCtx | QueryCtx,
  identifier: string,
  operationType: OperationType,
): Promise<RateLimitResult> {
  const db = ctx.db as any;
  const config = getConfig(operationType);
  const now = Date.now();

  const existing = await db
    .query("apiRateLimitThrottle")
    .withIndex("by_identifier_type", (q: any) =>
      q.eq("identifier", identifier).eq("operationType", operationType),
    )
    .unique();

  // Check if currently blocked
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    const retryAfterSecs = Math.ceil((existing.blockedUntil - now) / 1000);
    throw new ConvexError(`Rate limit exceeded. Try again in ${retryAfterSecs} seconds.`);
  }

  // Reset window if expired
  if (!existing || now - existing.windowStartedAt > config.windowMs) {
    if (!existing) {
      await db.insert("apiRateLimitThrottle", {
        identifier,
        operationType,
        windowStartedAt: now,
        requestCount: 1,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db.patch(existing._id, {
        windowStartedAt: now,
        requestCount: 1,
        blockedUntil: undefined,
        updatedAt: now,
      });
    }
    return { allowed: true, currentCount: 1, limit: config.maxRequests };
  }

  // Increment count
  const newCount = Number(existing.requestCount ?? 0) + 1;
  const shouldBlock = newCount > config.maxRequests;
  const blockedUntil = shouldBlock ? now + config.blockMs : undefined;

  await db.patch(existing._id, {
    requestCount: newCount,
    blockedUntil,
    updatedAt: now,
  });

  if (shouldBlock) {
    const retryAfterSecs = Math.ceil(config.blockMs / 1000);
    throw new ConvexError(`Rate limit exceeded. Try again in ${retryAfterSecs} seconds.`);
  }

  return { allowed: true, currentCount: newCount, limit: config.maxRequests };
}

/**
 * Non-throwing rate limit check.
 * Use for logging/monitoring without blocking.
 */
export async function checkRateLimitOnly(
  ctx: MutationCtx | QueryCtx,
  identifier: string,
  operationType: OperationType,
): Promise<RateLimitResult> {
  const db = ctx.db as any;
  const config = getConfig(operationType);
  const now = Date.now();

  const existing = await db
    .query("apiRateLimitThrottle")
    .withIndex("by_identifier_type", (q: any) =>
      q.eq("identifier", identifier).eq("operationType", operationType),
    )
    .unique();

  if (!existing) {
    return { allowed: true, currentCount: 0, limit: config.maxRequests };
  }

  if (existing.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      currentCount: Number(existing.requestCount ?? 0),
      limit: config.maxRequests,
      blockedUntil: existing.blockedUntil as number,
      retryAfterMs: (existing.blockedUntil as number) - now,
    };
  }

  if (now - existing.windowStartedAt > config.windowMs) {
    return { allowed: true, currentCount: 0, limit: config.maxRequests };
  }

  return {
    allowed: Number(existing.requestCount ?? 0) < config.maxRequests,
    currentCount: Number(existing.requestCount ?? 0),
    limit: config.maxRequests,
  };
}

/**
 * Clear rate limit for an identifier (admin use only).
 */
export async function clearRateLimit(
  ctx: MutationCtx,
  identifier: string,
  operationType?: OperationType,
): Promise<void> {
  const db = ctx.db as any;

  if (operationType) {
    const existing = await db
      .query("apiRateLimitThrottle")
      .withIndex("by_identifier_type", (q: any) =>
        q.eq("identifier", identifier).eq("operationType", operationType),
      )
      .unique();
    if (existing) {
      await db.delete(existing._id);
    }
  } else {
    // Clear all rate limits for identifier across all types
    const records = await db
      .query("apiRateLimitThrottle")
      .withIndex("by_identifier_type", (q: any) => q.eq("identifier", identifier))
      .collect();
    for (const record of records) {
      await db.delete(record._id);
    }
  }
}

/**
 * Cleanup old rate limit records.
 * Should be called periodically via cron job.
 */
export async function cleanupExpiredRateLimits(ctx: MutationCtx): Promise<number> {
  const db = ctx.db as any;
  const now = Date.now();
  let deleted = 0;

  const records = await db.query("apiRateLimitThrottle").collect();

  for (const record of records) {
    // Delete if window has expired and not currently blocked
    const windowExpired = now - record.windowStartedAt > getConfig(record.operationType).windowMs;
    const blocked = record.blockedUntil && record.blockedUntil > now;

    if (windowExpired && !blocked) {
      await db.delete(record._id);
      deleted++;
    }
  }

  return deleted;
}
