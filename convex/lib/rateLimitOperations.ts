import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { 
  getRateLimitConfig, 
  type OperationType 
} from "./rateLimitConfig";
import { 
  buildRateLimitFingerprint, 
  buildBatchOperationFingerprint,
  type BatchOperationType,
  type DeviceFingerprint,
  verifyPowSolution,
  generatePowChallenge,
  BATCH_RATE_LIMITS,
  type PowChallenge,
} from "./rateLimitFingerprint";

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  blockedUntil?: number;
  retryAfterMs?: number;
}

export interface BatchRateLimitResult extends RateLimitResult {
  batchSize: number;
  requiresPow: boolean;
  powChallenge?: PowChallenge;
}

/**
 * Multi-layer rate limit enforcement.
 * Combines userId, device fingerprint, and IP for comprehensive coverage.
 */
export async function enforceRateLimit(
  ctx: MutationCtx | QueryCtx,
  args: {
    userId?: string;
    ipAddress?: string;
    device?: DeviceFingerprint;
    operationType: OperationType;
  },
): Promise<RateLimitResult> {
  const db = ctx.db as any;
  const config = getRateLimitConfig(args.operationType);
  const now = Date.now();

  // Build composite fingerprint with all available layers
  const identifier = buildRateLimitFingerprint({
    userId: args.userId,
    ipAddress: args.ipAddress,
    device: args.device,
  });

  const existing = await db
    .query("apiRateLimitThrottle")
    .withIndex("by_identifier_type", (q: any) =>
      q.eq("identifier", identifier).eq("operationType", args.operationType),
    )
    .unique();

  // Check if currently blocked
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    const retryAfterMs = existing.blockedUntil - now;
    const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `Rate limit exceeded for this operation. Try again in ${retryAfterSecs} seconds.`,
      data: { retryAfterMs },
    });
  }

  // Reset window if expired
  if (!existing || now - existing.windowStartedAt > config.windowMs) {
    if (!existing) {
      await db.insert("apiRateLimitThrottle", {
        identifier,
        operationType: args.operationType,
        windowStartedAt: now,
        requestCount: 1,
        createdAt: now,
        updatedAt: now,
        // Store breakdown for multi-layer analysis
        userId: args.userId ?? null,
        deviceHash: args.device?.deviceId ? args.device.deviceId.substring(0, 16) : null,
        ipHash: args.ipAddress ? simpleHash(args.ipAddress) : null,
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

  // Increment counter
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
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `Rate limit exceeded for this operation. Try again in ${retryAfterSecs} seconds.`,
      data: { retryAfterMs: config.blockMs },
    });
  }

  return { allowed: true, currentCount: newCount, limit: config.maxRequests };
}

/**
 * Check rate limit status without incrementing counter.
 */
export async function checkRateLimitOnly(
  ctx: MutationCtx | QueryCtx,
  args: {
    userId?: string;
    ipAddress?: string;
    device?: DeviceFingerprint;
    operationType: OperationType;
  },
): Promise<RateLimitResult> {
  const db = ctx.db as any;
  const config = getRateLimitConfig(args.operationType);
  const now = Date.now();

  const identifier = buildRateLimitFingerprint({
    userId: args.userId,
    ipAddress: args.ipAddress,
    device: args.device,
  });

  const existing = await db
    .query("apiRateLimitThrottle")
    .withIndex("by_identifier_type", (q: any) =>
      q.eq("identifier", identifier).eq("operationType", args.operationType),
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
 * Enforce rate limit for batch operations with proof-of-work support.
 * Validates batch size and optionally requires proof-of-work for expensive operations.
 */
export async function enforceBatchRateLimit(
  ctx: MutationCtx | QueryCtx,
  args: {
    userId?: string;
    ipAddress?: string;
    device?: DeviceFingerprint;
    operationType: BatchOperationType;
    batchSize: number;
    powSolution?: string;
    powChallengeId?: string;
  },
): Promise<BatchRateLimitResult> {
  const db = ctx.db as any;
  const now = Date.now();

  const batchConfig = BATCH_RATE_LIMITS[args.operationType];

  // Validate batch size
  if (args.batchSize > batchConfig.maxBatchSize) {
    throw new ConvexError({
      code: "BATCH_SIZE_EXCEEDED",
      message: `Batch size exceeds maximum allowed (${batchConfig.maxBatchSize}).`,
      data: { maxBatchSize: batchConfig.maxBatchSize },
    });
  }

  // Verify proof-of-work if required
  if (batchConfig.requiresPow) {
    if (!args.powSolution || !args.powChallengeId) {
      throw new ConvexError({
        code: "POW_REQUIRED",
        message: "Proof-of-work challenge required for this operation.",
        data: { 
          requiresPow: true,
          difficulty: batchConfig.powDifficulty,
        },
      });
    }

    // Retrieve stored challenge
    const challenge = await db
      .query("rateLimitPowChallenges")
      .withIndex("by_challenge_id", (q: any) => q.eq("challengeId", args.powChallengeId))
      .unique();

    if (!challenge || challenge.expiresAt < now) {
      throw new ConvexError({
        code: "POW_INVALID",
        message: "Proof-of-work challenge expired or invalid.",
      });
    }

    const solutionValid = verifyPowSolution(
      {
        id: challenge.challengeId,
        difficulty: challenge.difficulty,
        target: challenge.target,
        expiresAt: challenge.expiresAt,
        createdAt: challenge.createdAt,
      },
      args.powSolution,
    );

    if (!solutionValid) {
      throw new ConvexError({
        code: "POW_INVALID",
        message: "Invalid proof-of-work solution.",
      });
    }

    // Delete used challenge to prevent replay
    await db.delete(challenge._id);
  }

  // Build batch operation fingerprint
  const identifier = buildBatchOperationFingerprint({
    userId: args.userId,
    ipAddress: args.ipAddress,
    device: args.device,
    operationType: args.operationType,
  });

  const existing = await db
    .query("apiRateLimitThrottle")
    .withIndex("by_identifier_type", (q: any) =>
      q.eq("identifier", identifier).eq("operationType", `batch:${args.operationType}` as any),
    )
    .unique();

  // Check if currently blocked
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      currentCount: Number(existing.requestCount ?? 0),
      limit: batchConfig.maxRequests,
      batchSize: args.batchSize,
      requiresPow: batchConfig.requiresPow,
      blockedUntil: existing.blockedUntil as number,
      retryAfterMs: (existing.blockedUntil as number) - now,
    };
  }

  // Reset or create window
  if (!existing || now - existing.windowStartedAt > batchConfig.windowMs) {
    if (!existing) {
      await db.insert("apiRateLimitThrottle", {
        identifier,
        operationType: `batch:${args.operationType}` as any,
        windowStartedAt: now,
        requestCount: 1,
        createdAt: now,
        updatedAt: now,
        userId: args.userId ?? null,
        deviceHash: args.device?.deviceId ? args.device.deviceId.substring(0, 16) : null,
        ipHash: args.ipAddress ? simpleHash(args.ipAddress) : null,
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
      limit: batchConfig.maxRequests,
      batchSize: args.batchSize,
      requiresPow: batchConfig.requiresPow,
    };
  }

  // Increment counter
  const newCount = Number(existing.requestCount ?? 0) + 1;
  const shouldBlock = newCount > batchConfig.maxRequests;
  const blockedUntil = shouldBlock ? now + batchConfig.windowMs : undefined;

  await db.patch(existing._id, {
    requestCount: newCount,
    blockedUntil,
    updatedAt: now,
  });

  return {
    allowed: !shouldBlock,
    currentCount: newCount,
    limit: batchConfig.maxRequests,
    batchSize: args.batchSize,
    requiresPow: batchConfig.requiresPow,
  };
}

/**
 * Create a proof-of-work challenge for expensive batch operations.
 */
export async function createPowChallenge(
  ctx: MutationCtx,
  operationType: BatchOperationType,
): Promise<PowChallenge> {
  const batchConfig = BATCH_RATE_LIMITS[operationType];
  
  if (!batchConfig.requiresPow) {
    throw new ConvexError("Proof-of-work not required for this operation type.");
  }

  const challenge = generatePowChallenge(operationType, batchConfig.powDifficulty);
  const now = Date.now();

  // Store challenge for later verification
  await db.insert("rateLimitPowChallenges", {
    challengeId: challenge.id,
    operationType,
    difficulty: challenge.difficulty,
    target: challenge.target,
    expiresAt: challenge.expiresAt,
    createdAt: challenge.createdAt,
    used: false,
  });

  return challenge;
}

/**
 * Legacy support - wraps the old single-identifier API.
 * @deprecated Use enforceRateLimit with full args instead.
 */
export async function enforceRateLimitLegacy(
  ctx: MutationCtx | QueryCtx,
  identifier: string,
  operationType: OperationType,
): Promise<RateLimitResult> {
  return enforceRateLimit(ctx, {
    operationType,
  });
}

/**
 * Clear rate limit for a specific identifier and operation type.
 */
export async function clearRateLimit(
  ctx: MutationCtx,
  args: {
    userId?: string;
    ipAddress?: string;
    device?: DeviceFingerprint;
    operationType?: OperationType | BatchOperationType;
  },
): Promise<void> {
  const db = ctx.db as any;

  // Build the base fingerprint
  const baseIdentifier = buildRateLimitFingerprint({
    userId: args.userId,
    ipAddress: args.ipAddress,
    device: args.device,
  });

  if (args.operationType) {
    const opType = args.operationType;
    const identifier = opType.startsWith("batch:") 
      ? buildBatchOperationFingerprint({
          userId: args.userId,
          ipAddress: args.ipAddress,
          device: args.device,
          operationType: opType.replace("batch:", "") as BatchOperationType,
        })
      : baseIdentifier;

    const existing = await db
      .query("apiRateLimitThrottle")
      .withIndex("by_identifier_type", (q: any) =>
        q.eq("identifier", identifier).eq("operationType", opType),
      )
      .unique();
    if (existing) {
      await db.delete(existing._id);
    }
  } else {
    // Clear all rate limits for this fingerprint
    const records = await db
      .query("apiRateLimitThrottle")
      .withIndex("by_identifier_blocked_until", (q: any) => 
        q.eq("identifier", baseIdentifier)
      )
      .collect();
    for (const record of records) {
      await db.delete(record._id);
    }
  }
}

/**
 * Cleanup expired rate limit records.
 */
export async function cleanupExpiredRateLimits(ctx: MutationCtx): Promise<number> {
  const db = ctx.db as any;
  const now = Date.now();
  let deleted = 0;

  const records = await db.query("apiRateLimitThrottle").collect();

  for (const record of records) {
    const config = getRateLimitConfig(record.operationType as OperationType);
    const windowExpired = now - record.windowStartedAt > config.windowMs;
    const blocked = record.blockedUntil && record.blockedUntil > now;

    if (windowExpired && !blocked) {
      await db.delete(record._id);
      deleted++;
    }
  }

  // Cleanup expired POW challenges
  const powChallenges = await db.query("rateLimitPowChallenges").collect();
  for (const challenge of powChallenges) {
    if (challenge.expiresAt < now) {
      await db.delete(challenge._id);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Simple hash for IP addresses.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get combined rate limit status for a user across all layers.
 * Useful for displaying rate limit info to users.
 */
export async function getMultiLayerRateLimitStatus(
  ctx: QueryCtx,
  args: {
    userId?: string;
    ipAddress?: string;
    device?: DeviceFingerprint;
  },
): Promise<{
  user: RateLimitResult;
  device: RateLimitResult;
  ip: RateLimitResult;
  combined: RateLimitResult;
}> {
  const now = Date.now();
  const db = ctx.db as any;

  const getStatus = async (identifier: string, opType: OperationType): Promise<RateLimitResult> => {
    const config = getRateLimitConfig(opType);
    const existing = await db
      .query("apiRateLimitThrottle")
      .withIndex("by_identifier_type", (q: any) =>
        q.eq("identifier", identifier).eq("operationType", opType),
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
  };

  // Build separate fingerprints for each layer
  const userId = args.userId;
  const deviceHash = args.device?.deviceId ? args.device.deviceId.substring(0, 16) : null;
  const ipHash = args.ipAddress ? simpleHash(args.ipAddress) : null;

  const userStatus = userId 
    ? await getStatus(`u:${userId}`, "mutation") 
    : { allowed: true, currentCount: 0, limit: 0 };
  
  const deviceStatus = deviceHash 
    ? await getStatus(`d:${deviceHash}`, "mutation") 
    : { allowed: true, currentCount: 0, limit: 0 };
  
  const ipStatus = ipHash 
    ? await getStatus(`i:${ipHash}`, "mutation") 
    : { allowed: true, currentCount: 0, limit: 0 };

  const combinedStatus = await getStatus(
    buildRateLimitFingerprint(args),
    "mutation",
  );

  return {
    user: userStatus,
    device: deviceStatus,
    ip: ipStatus,
    combined: combinedStatus,
  };
}