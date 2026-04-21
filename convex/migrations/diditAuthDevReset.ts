import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import {
  DEVELOPMENT_RESET_CONFIRMATION,
  DEVELOPMENT_RESET_TABLES,
  checkDangerousMigrationSafety,
  logBlockedMigrationAttempt,
  requireSafeEnvironment,
  type DevelopmentResetResult,
  deleteAllRowsInTable,
  requireMigrationsAccessToken,
} from "./shared";
import { ErrorCode } from "../lib/errors";

const RESET_OPERATION_NAME = "clearAllDevelopmentData";

// Extended return type with warning field
export type ResetDevelopmentDataResult = DevelopmentResetResult & {
  warning?: string;
};

export const resetDevelopmentData = action({
  args: {
    accessToken: v.optional(v.string()),
    confirm: v.string(),
  },
  returns: v.object({
    tablesCleared: v.number(),
    deletedDocuments: v.number(),
    deletedByTable: v.array(
      v.object({
        table: v.string(),
        deleted: v.number(),
      }),
    ),
    warning: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<ResetDevelopmentDataResult> => {
    // Layer 1: Access token check
    requireMigrationsAccessToken(args.accessToken);

    // Layer 2: Production environment check (at action level)
    requireSafeEnvironment(RESET_OPERATION_NAME);

    if (args.confirm !== DEVELOPMENT_RESET_CONFIRMATION) {
      throw new ConvexError({
        code: ErrorCode.FORBIDDEN,
        message: "Refusing to reset development data without correct confirmation",
      });
    }

    const result = await ctx.runMutation(
      internal.migrations.index.clearAllDevelopmentData,
      {},
    );

    // Add warning for non-dev environments
    const safety = checkDangerousMigrationSafety(RESET_OPERATION_NAME);
    if (!safety.blocked) {
      const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "unknown";
      if (nodeEnv !== "development") {
        result.warning = `⚠️ WARNING: Development data was cleared in ${nodeEnv} environment. ` +
          `Ensure this was intentional. Timestamp: ${new Date().toISOString()}`;
      }
    }

    return result;
  },
});

export const clearAllDevelopmentData = internalMutation({
  args: {},
  returns: v.object({
    tablesCleared: v.number(),
    deletedDocuments: v.number(),
    deletedByTable: v.array(
      v.object({
        table: v.string(),
        deleted: v.number(),
      }),
    ),
    warning: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<DevelopmentResetResult & { warning?: string }> => {
    // Production guard - Layer 1: Check if operation should be blocked
    const safety = checkDangerousMigrationSafety(RESET_OPERATION_NAME);
    if (safety.blocked) {
      // Log the blocked attempt
      logBlockedMigrationAttempt(ctx, {
        operationName: RESET_OPERATION_NAME,
        reason: safety.reason!,
        callerInfo: "internalMutation:clearAllDevelopmentData",
      });

      // Return blocked result with warning
      return {
        tablesCleared: 0,
        deletedDocuments: 0,
        deletedByTable: [],
        warning: `🚫 BLOCKED: ${safety.reason}`,
      };
    }

    // Proceed with data deletion
    const deletedByTable: Array<{ table: string; deleted: number }> = [];
    for (const table of DEVELOPMENT_RESET_TABLES) {
      const deleted = await deleteAllRowsInTable(ctx, table);
      deletedByTable.push({ table, deleted });
    }

    return {
      tablesCleared: deletedByTable.filter((entry) => entry.deleted > 0).length,
      deletedDocuments: deletedByTable.reduce((total, entry) => total + entry.deleted, 0),
      deletedByTable,
    };
  },
});
