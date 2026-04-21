import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Environment variable for enabling dangerous migrations in production (for emergencies only)
export const ALLOW_DANGEROUS_MIGRATIONS_ENV = "ALLOW_DANGEROUS_MIGRATIONS";
export const NODE_ENV_ENV = "NODE_ENV";

export const DEFAULT_BATCH_SIZE = 200;
export const MAX_BATCH_SIZE = 500;
export const MIGRATIONS_ACCESS_TOKEN_ENV = "MIGRATIONS_ACCESS_TOKEN";
export const DEVELOPMENT_RESET_CONFIRMATION = "DELETE_ALL_DEV_DATA";
export const CONVEX_DEPLOYMENT_ENV = "CONVEX_DEPLOYMENT";
export const EMAIL_AUTH_PROVIDER_IDS = ["resend", "resend-otp"] as const;
export const DEVELOPMENT_RESET_TABLES = [
  "authAccounts",
  "authRateLimits",
  "authRefreshTokens",
  "authSessions",
  "authVerificationCodes",
  "authVerifiers",
  "calendarEventMappings",
  "calendarExternalEvents",
  "calendarIntegrations",
  "diditEvents",
  "instructorGeoCoverage",
  "instructorHexCoverage",
  "instructorProfiles",
  "instructorSports",
  "integrationEvents",
  "jobApplicationStats",
  "jobApplications",
  "jobs",
  "notificationLog",
  "paymentAttempts",
  "paymentMigrationRefs",
  "paymentOffers",
  "paymentOrders",
  "payoutPreferences",
  "payoutTransfers",
  "connectedAccountRequirements",
  "connectedAccounts",
  "fundSplits",
  "ledgerEntries",
  "pricingRules",
  "providerObjects",
  "profileImageUploadSessions",
  "providerMethodCache",
  "studioProfiles",
  "studioBranches",
  "studioMemberships",
  "studioEntitlements",
  "studioSports",
  "userNotifications",
  "users",
  "webhookDeliveries",
  "webhookInvalidSignatureThrottle",
] as const;

export type DiditBackfillBatchPageItem = {
  instructorId: Id<"instructorProfiles">;
  diditSessionId?: string;
  diditVerificationStatus?:
    | "not_started"
    | "in_progress"
    | "pending"
    | "in_review"
    | "approved"
    | "declined"
    | "abandoned"
    | "expired";
  diditStatusRaw?: string;
  diditDecision?: any;
};

export type DiditBackfillBatchResult = {
  page: DiditBackfillBatchPageItem[];
  isDone: boolean;
  continueCursor: string;
};

export type DevelopmentResetResult = {
  tablesCleared: number;
  deletedDocuments: number;
  deletedByTable: Array<{
    table: string;
    deleted: number;
  }>;
};

export const appRoleValidator = v.union(v.literal("instructor"), v.literal("studio"));
export const duplicateUserEmailReportEntryValidator = v.object({
  email: v.string(),
  userCount: v.number(),
  canonicalUserId: v.optional(v.id("users")),
  users: v.array(
    v.object({
      userId: v.id("users"),
      role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
      roles: v.array(appRoleValidator),
      onboardingComplete: v.boolean(),
      isActive: v.boolean(),
      emailVerified: v.boolean(),
      hasInstructorProfile: v.boolean(),
      hasStudioProfile: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
});

export const authEmailLinkStateEntryValidator = v.object({
  userId: v.id("users"),
  provider: v.string(),
  providerAccountId: v.string(),
  userEmail: v.optional(v.string()),
  role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
  onboardingComplete: v.boolean(),
  isActive: v.boolean(),
  emailVerified: v.boolean(),
  hasInstructorProfile: v.boolean(),
  hasStudioProfile: v.boolean(),
});

export type DuplicateUserEmailReportEntry = {
  email: string;
  userCount: number;
  canonicalUserId?: Id<"users">;
  users: Array<{
    userId: Id<"users">;
    role: "pending" | "instructor" | "studio";
    roles: Array<"instructor" | "studio">;
    onboardingComplete: boolean;
    isActive: boolean;
    emailVerified: boolean;
    hasInstructorProfile: boolean;
    hasStudioProfile: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
};

export type AuthEmailLinkStateEntry = {
  userId: Id<"users">;
  provider: string;
  providerAccountId: string;
  userEmail?: string;
  role: "pending" | "instructor" | "studio";
  onboardingComplete: boolean;
  isActive: boolean;
  emailVerified: boolean;
  hasInstructorProfile: boolean;
  hasStudioProfile: boolean;
};

export function isDuplicateUserEmailReportEntry(
  entry: DuplicateUserEmailReportEntry | null,
): entry is DuplicateUserEmailReportEntry {
  return entry !== null;
}

export async function resolveUserProfileState(ctx: QueryCtx, userId: Id<"users">) {
  const [instructorProfile, studioProfile] = await Promise.all([
    ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique(),
    ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique(),
  ]);

  return {
    hasInstructorProfile: instructorProfile !== null,
    hasStudioProfile: studioProfile !== null,
  };
}

export function isValidMigrationsAccessToken(accessToken: string | undefined): boolean {
  const expected = process.env[MIGRATIONS_ACCESS_TOKEN_ENV]?.trim();
  return Boolean(expected) && accessToken?.trim() === expected;
}

export function isDevDeployment(): boolean {
  return process.env[CONVEX_DEPLOYMENT_ENV]?.trim().startsWith("dev:") ?? false;
}

export function requireMigrationsAccessToken(accessToken: string | undefined) {
  if (isDevDeployment() && !process.env[MIGRATIONS_ACCESS_TOKEN_ENV]?.trim()) {
    return;
  }

  if (!isValidMigrationsAccessToken(accessToken)) {
    throw new ConvexError({
      code: ErrorCode.UNAUTHORIZED,
      message: "Unauthorized migration operation. Set MIGRATIONS_ACCESS_TOKEN and pass accessToken.",
    });
  }
}

/**
 * Production guard for dangerous migrations.
 * Prevents execution in production unless ALLOW_DANGEROUS_MIGRATIONS is explicitly set.
 * This is a critical safety mechanism for data-destructive operations.
 */
export function requireSafeEnvironment(operationName: string): void {
  const nodeEnv = process.env[NODE_ENV_ENV]?.trim().toLowerCase();
  const isProductionEnv = nodeEnv === "production";
  const allowDangerous = process.env[ALLOW_DANGEROUS_MIGRATIONS_ENV]?.trim();

  if (isProductionEnv && !allowDangerous) {
    throw new ConvexError({
      code: "PRODUCTION_BLOCKED",
      message: `BLOCKED: '${operationName}' cannot run in production without explicit opt-in. ` +
        `Set ${ALLOW_DANGEROUS_MIGRATIONS_ENV}=true to bypass (use only for emergencies).`,
    });
  }
}

/**
 * Check if the current environment is safe for dangerous migrations.
 * Returns { blocked: true, reason: string } if blocked, { blocked: false } if allowed.
 */
export function checkDangerousMigrationSafety(operationName: string): {
  blocked: boolean;
  reason?: string;
} {
  const nodeEnv = process.env[NODE_ENV_ENV]?.trim().toLowerCase();
  const isProductionEnv = nodeEnv === "production";
  const allowDangerous = process.env[ALLOW_DANGEROUS_MIGRATIONS_ENV]?.trim();

  if (isProductionEnv && !allowDangerous) {
    return {
      blocked: true,
      reason: `Production guard blocked '${operationName}'. ` +
        `NODE_ENV=production and ${ALLOW_DANGEROUS_MIGRATIONS_ENV} not set. ` +
        `Timestamp: ${new Date().toISOString()}`,
    };
  }

  return { blocked: false };
}

/**
 * Log a blocked migration attempt to console.
 * In a production system, this should be sent to a secure audit logging service.
 */
export function logBlockedMigrationAttempt(
  ctx: MutationCtx,
  args: {
    operationName: string;
    reason: string;
    callerInfo?: string;
  },
): void {
  const logEntry = {
    event: "MIGRATION_BLOCKED",
    operation: args.operationName,
    reason: args.reason,
    callerInfo: args.callerInfo ?? "internal",
    timestamp: Date.now(),
    isoTimestamp: new Date().toISOString(),
  };

  // Console log for immediate visibility
  console.error(
    `[SECURITY ALERT] Migration blocked: ${JSON.stringify(logEntry, null, 2)}`,
  );

  // Attempt to log to audit table if it exists
  try {
    ctx.db.insert("migrationAuditLogs" as any, {
      operation: args.operationName,
      action: "blocked",
      reason: args.reason,
      callerInfo: args.callerInfo,
      timestamp: logEntry.timestamp,
    });
  } catch {
    // Table doesn't exist - already logged to console above
  }
}

export async function deleteAllRowsInTable(ctx: MutationCtx, table: string) {
  const rows = await ((ctx.db as any).query(table) as any).collect();
  await Promise.all(rows.map((row: { _id: string }) => ctx.db.delete(row._id as any)));
  return rows.length;
}
