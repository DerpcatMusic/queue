/**
 * Security utilities - Internal Mutations
 *
 * These are internal mutations for security operations like
 * rate limiting and cleanup. Not exposed to the public API.
 */

import { internalMutation } from "./_generated/server";
import { cleanupExpiredRateLimits as doCleanup } from "./lib/rateLimit";

/**
 * Cleanup expired rate limit records.
 * Called by cron job every 15 minutes.
 */
export const cleanupExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deleted = await doCleanup(ctx);
    return { deleted };
  },
});
