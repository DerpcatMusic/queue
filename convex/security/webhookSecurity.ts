import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// =============================================================================
// Configuration Constants
// =============================================================================

const DEFAULT_INVALID_SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_INVALID_SIGNATURE_MAX_ATTEMPTS = 5;
const DEFAULT_INVALID_SIGNATURE_BLOCK_MS = 15 * 60 * 1000;
const DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes
const DEFAULT_WEBHOOK_IP_ALLOWLIST_DEV_MODE = true;

// =============================================================================
// Configuration Helpers
// =============================================================================

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

const getWebhookIpAllowlistDevMode = (): boolean => {
  const envVal = process.env.WEBHOOK_IP_ALLOWLIST_DEV_MODE?.trim().toLowerCase();
  if (envVal === "false" || envVal === "0") return false;
  return DEFAULT_WEBHOOK_IP_ALLOWLIST_DEV_MODE;
};

const getTimestampToleranceSeconds = (): number => {
  const parsed = parsePositiveInt(
    process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
    DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  );
  return Math.min(parsed, 600); // Cap at 10 minutes
};

// =============================================================================
// Validators
// =============================================================================

const webhookProviderValidator = v.union(
  v.literal("stripe"),
  v.literal("didit"),
  v.literal("airwallex"),
);

// =============================================================================
// IP Allowlist Validation (Dev Mode Logging)
// =============================================================================

/**
 * Validates source IP against known webhook IPs.
 * In development, logs warnings instead of blocking.
 * In production, blocks requests from unknown IPs.
 */
export async function validateWebhookSourceIp(
  sourceIp: string | null,
  provider: "stripe" | "didit" | "airwallex",
): Promise<{ valid: boolean; shouldLog: boolean }> {
  const devMode = getWebhookIpAllowlistDevMode();
  
  // Known webhook source IPs (these should be configured per provider)
  const knownIps = getKnownWebhookIps(provider);
  
  // If no IPs configured, allow all in dev mode, require signature validation
  if (knownIps.length === 0) {
    if (devMode) {
      console.warn(
        `[WebhookSecurity] No IP allowlist configured for ${provider}. ` +
        `Requests will be allowed but signature validation is critical.`,
      );
    }
    return { valid: true, shouldLog: devMode };
  }
  
  const isKnown = knownIps.some(
    (allowed) => allowed === sourceIp || allowed === "*" // * = any IP allowed
  );
  
  if (!isKnown) {
    if (devMode) {
      console.warn(
        `[WebhookSecurity] Unknown source IP "${sourceIp}" for ${provider} webhook. ` +
        `Request allowed in development mode. Configure WEBHOOK_STRIPE_IPS, ` +
        `WEBHOOK_DIDIT_IPS, or WEBHOOK_AIRWALLEX_IPS for production.`,
      );
      return { valid: true, shouldLog: true };
    }
    return { valid: false, shouldLog: true };
  }
  
  return { valid: true, shouldLog: false };
}

function getKnownWebhookIps(provider: "stripe" | "didit" | "airwallex"): string[] {
  const envKey = `WEBHOOK_${provider.toUpperCase()}_IPS`;
  const ips = process.env[envKey];
  
  if (!ips) return [];
  
  return ips
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);
}

// =============================================================================
// Replay Attack Prevention - Event Idempotency
// =============================================================================

export const checkWebhookEventIdempotency = internalQuery({
  args: {
    provider: webhookProviderValidator,
    eventId: v.string(),
  },
  returns: v.object({
    isDuplicate: v.boolean(),
    previousProcessingStartedAt: v.optional(v.number()),
    previousProcessedAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEventIdempotency")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .unique();

    if (!existing) {
      return {
        isDuplicate: false,
        previousProcessingStartedAt: undefined,
        previousProcessedAt: undefined,
      };
    }

    // If already processed successfully, reject as duplicate
    if (existing.processedAt !== undefined) {
      return {
        isDuplicate: true,
        previousProcessingStartedAt: existing.createdAt,
        previousProcessedAt: existing.processedAt,
      };
    }

    // If still processing (started within last 60 seconds), reject
    const now = Date.now();
    const processingTimeout = 60 * 1000;
    if (existing.createdAt && now - existing.createdAt < processingTimeout) {
      return {
        isDuplicate: true,
        previousProcessingStartedAt: existing.createdAt,
        previousProcessedAt: undefined,
      };
    }

    // Stale record, allow reprocessing
    return {
      isDuplicate: false,
      previousProcessingStartedAt: existing.createdAt,
      previousProcessedAt: undefined,
    };
  },
});

export const recordWebhookEventProcessing = internalMutation({
  args: {
    provider: webhookProviderValidator,
    eventId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Try to insert new record
    try {
      await ctx.db.insert("webhookEventIdempotency", {
        provider: args.provider,
        eventId: args.eventId,
        createdAt: Date.now(),
      });
    } catch {
      // Record already exists, update timestamp to show processing
      const existing = await ctx.db
        .query("webhookEventIdempotency")
        .withIndex("by_provider_eventId", (q) =>
          q.eq("provider", args.provider).eq("eventId", args.eventId),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          updatedAt: Date.now(),
        });
      }
    }
    return null;
  },
});

export const markWebhookEventProcessed = internalMutation({
  args: {
    provider: webhookProviderValidator,
    eventId: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEventIdempotency")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        processedAt: Date.now(),
        updatedAt: Date.now(),
        success: args.success,
        errorMessage: args.errorMessage,
      });
    }
    return null;
  },
});

// =============================================================================
// Timestamp Validation for Replay Prevention
// =============================================================================

export function validateWebhookTimestamp(
  timestamp: string,
  toleranceSeconds?: number,
): { valid: boolean; age: number } {
  const tolerance = toleranceSeconds ?? getTimestampToleranceSeconds();
  const timestampMs = Number.parseInt(timestamp.trim(), 10);
  
  if (!Number.isFinite(timestampMs)) {
    return { valid: false, age: 0 };
  }
  
  const nowMs = Date.now();
  const ageSeconds = Math.abs(nowMs - timestampMs) / 1000;
  
  return {
    valid: ageSeconds <= tolerance,
    age: ageSeconds,
  };
}

// =============================================================================
// Invalid Signature Throttling (Existing Logic Enhanced)
// =============================================================================

export const checkInvalidSignatureThrottle = internalMutation({
  args: {
    provider: webhookProviderValidator,
    fingerprint: v.string(),
  },
  returns: v.object({
    blocked: v.boolean(),
    blockedUntil: v.optional(v.number()),
    invalidCount: v.number(),
    retryAfterSeconds: v.optional(v.number()),
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
          retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
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

// =============================================================================
// Generic Webhook Error Handler (Prevents Information Leakage)
// =============================================================================

export function sanitizeWebhookError(error: unknown): {
  message: string;
  statusCode: number;
  logLevel: "error" | "warn" | "info";
} {
  // Log details internally but return generic message
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Determine error type and appropriate response
  if (errorMessage.includes("signature") || errorMessage.includes("Signature")) {
    console.error(
      `[WebhookSecurity] Signature verification failed`,
      { error: errorMessage, stack: errorStack },
    );
    return {
      message: "Signature verification failed",
      statusCode: 401,
      logLevel: "warn",
    };
  }
  
  if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
    console.error(
      `[WebhookSecurity] External service timeout`,
      { error: errorMessage, stack: errorStack },
    );
    return {
      message: "Service temporarily unavailable",
      statusCode: 503,
      logLevel: "warn",
    };
  }
  
  if (errorMessage.includes("parse") || errorMessage.includes("JSON")) {
    console.error(
      `[WebhookSecurity] Payload parsing failed`,
      { error: errorMessage, stack: errorStack },
    );
    return {
      message: "Invalid payload format",
      statusCode: 400,
      logLevel: "warn",
    };
  }
  
  // Generic internal error - don't leak details
  console.error(
    `[WebhookSecurity] Unexpected webhook processing error`,
    { error: errorMessage, stack: errorStack },
  );
  return {
    message: "Internal server error",
    statusCode: 500,
    logLevel: "error",
  };
}