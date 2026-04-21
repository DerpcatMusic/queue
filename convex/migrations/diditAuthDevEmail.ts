import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { type Id, internal } from "../_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { dedupeUsersByEmail, normalizeEmail, resolveCanonicalUserByEmail } from "../lib/authDedupe";
import { omitUndefined } from "../lib/validation";
import {
  type AuthEmailLinkStateEntry,
  authEmailLinkStateEntryValidator,
  duplicateUserEmailReportEntryValidator,
  isDuplicateUserEmailReportEntry,
  requireMigrationsAccessToken,
  resolveUserProfileState,
} from "./shared";
import { ErrorCode } from "../lib/errors";

export const dedupeDuplicateUsersByEmail = action({
  args: {
    email: v.optional(v.string()),
    limit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scannedEmails: v.number(),
    dedupedEmails: v.number(),
    canonicalUserIds: v.array(v.id("users")),
    duplicateEmails: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedTargetEmail = normalizeEmail(args.email);
    const duplicateEmails: string[] = normalizedTargetEmail
      ? [normalizedTargetEmail]
      : await ctx.runQuery(internal.migrations.index.getDuplicateUserEmails, {});
    const targetEmails = duplicateEmails.slice(
      0,
      Math.max(args.limit ?? duplicateEmails.length, 0),
    );
    const canonicalUserIds: Id<"users">[] = [];

    for (const email of targetEmails) {
      const canonicalUserId = await ctx.runMutation(internal.migrations.index.dedupeUsersForEmail, {
        email,
      });
      if (canonicalUserId) {
        canonicalUserIds.push(canonicalUserId);
      }
    }

    return {
      scannedEmails: targetEmails.length,
      dedupedEmails: canonicalUserIds.length,
      canonicalUserIds,
      duplicateEmails: targetEmails,
    };
  },
});

export const getDuplicateUserEmailReport = action({
  args: {
    email: v.optional(v.string()),
    limit: v.optional(v.number()),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    scannedEmails: v.number(),
    duplicateEmails: v.array(duplicateUserEmailReportEntryValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    scannedEmails: number;
    duplicateEmails: any[];
  }> => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedTargetEmail = normalizeEmail(args.email);
    const duplicateEmails: string[] = normalizedTargetEmail
      ? [normalizedTargetEmail]
      : await ctx.runQuery(internal.migrations.index.getDuplicateUserEmails, {});
    const targetEmails: string[] = duplicateEmails.slice(
      0,
      Math.max(args.limit ?? duplicateEmails.length, 0),
    );

    const reportEntries = (
      await Promise.all(
        targetEmails.map((email: string) =>
          ctx.runQuery(internal.migrations.index.getDuplicateUserEmailReportEntry, { email }),
        ),
      )
    ).filter(isDuplicateUserEmailReportEntry);

    return {
      scannedEmails: targetEmails.length,
      duplicateEmails: reportEntries,
    };
  },
});

export const inspectUserEmailLinkState = query({
  args: {
    email: v.string(),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    normalizedEmail: v.string(),
    usersByEmail: v.array(
      v.object({
        userId: v.id("users"),
        role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
        onboardingComplete: v.boolean(),
        isActive: v.boolean(),
        emailVerified: v.boolean(),
        hasInstructorProfile: v.boolean(),
        hasStudioProfile: v.boolean(),
      }),
    ),
    usersFromEmailAuthAccounts: v.array(authEmailLinkStateEntryValidator),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      throw new ConvexError({
        code: ErrorCode.MISSING_REQUIRED_FIELD,
        message: "Email is required",
      });
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    const usersByEmail = await Promise.all(
      users.map(async (user) => ({
        userId: user._id,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
        isActive: user.isActive,
        emailVerified: user.emailVerificationTime !== undefined,
        ...(await resolveUserProfileState(ctx, user._id)),
      })),
    );

    const usersFromEmailAuthAccounts: AuthEmailLinkStateEntry[] = [];
    for (const providerId of ["resend", "resend-otp"] as const) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", providerId).eq("providerAccountId", normalizedEmail),
        )
        .collect();

      for (const account of accounts) {
        const user = await ctx.db.get(account.userId);
        if (!user) continue;

        usersFromEmailAuthAccounts.push({
          userId: user._id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          role: user.role,
          onboardingComplete: user.onboardingComplete,
          isActive: user.isActive,
          emailVerified:
            user.emailVerificationTime !== undefined || account.emailVerified !== undefined,
          ...(await resolveUserProfileState(ctx, user._id)),
          ...omitUndefined({
            userEmail: user.email,
          }),
        });
      }
    }

    return {
      normalizedEmail,
      usersByEmail,
      usersFromEmailAuthAccounts,
    };
  },
});

export const repairUserEmailFromAuthAccounts = mutation({
  args: {
    email: v.string(),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    normalizedEmail: v.string(),
    inspectedUsers: v.number(),
    updatedUsers: v.number(),
    updatedUserIds: v.array(v.id("users")),
  }),
  handler: async (ctx, args) => {
    requireMigrationsAccessToken(args.accessToken);
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      throw new ConvexError({
        code: ErrorCode.MISSING_REQUIRED_FIELD,
        message: "Email is required",
      });
    }

    const candidates = new Map<
      string,
      {
        userId: Id<"users">;
        shouldMarkVerified: boolean;
      }
    >();

    for (const providerId of ["resend", "resend-otp"] as const) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", providerId).eq("providerAccountId", normalizedEmail),
        )
        .collect();

      for (const account of accounts) {
        const key = String(account.userId);
        const existing = candidates.get(key);
        const shouldMarkVerified = account.emailVerified === normalizedEmail;
        candidates.set(key, {
          userId: account.userId,
          shouldMarkVerified: existing?.shouldMarkVerified === true || shouldMarkVerified,
        });
      }
    }

    const updatedUserIds: Id<"users">[] = [];
    const now = Date.now();

    for (const candidate of candidates.values()) {
      const user = await ctx.db.get(candidate.userId);
      if (!user) continue;

      const userEmail = normalizeEmail(user.email);
      const shouldUpdateEmail = userEmail !== normalizedEmail;
      const shouldUpdateVerification =
        candidate.shouldMarkVerified && user.emailVerificationTime === undefined;

      if (!shouldUpdateEmail && !shouldUpdateVerification) {
        continue;
      }

      await ctx.db.patch("users", user._id, {
        ...(shouldUpdateEmail ? { email: normalizedEmail } : {}),
        ...(shouldUpdateVerification ? { emailVerificationTime: now } : {}),
        updatedAt: now,
      });
      updatedUserIds.push(user._id);
    }

    return {
      normalizedEmail,
      inspectedUsers: candidates.size,
      updatedUsers: updatedUserIds.length,
      updatedUserIds,
    };
  },
});

export const getDuplicateUserEmails = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const counts = new Map<string, { total: number; verified: number }>();
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (!email) continue;
      const current = counts.get(email) ?? { total: 0, verified: 0 };
      counts.set(email, {
        total: current.total + 1,
        verified: current.verified + (user.emailVerificationTime !== undefined ? 1 : 0),
      });
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count.total > 1 && count.verified > 0)
      .map(([email]) => email)
      .sort();
  },
});

export const getDuplicateUserEmailReportEntry = internalQuery({
  args: { email: v.string() },
  returns: v.union(duplicateUserEmailReportEntryValidator, v.null()),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) return null;

    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    if (users.length <= 1) {
      return null;
    }

    const canonicalUserId =
      (await resolveCanonicalUserByEmail({
        ctx,
        normalizedEmail,
      })) ?? undefined;

    const userEntries = await Promise.all(
      users.map(async (user) => {
        const [instructorProfiles, studioProfiles] = await Promise.all([
          ctx.db
            .query("instructorProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .take(1),
          ctx.db
            .query("studioProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .take(1),
        ]);

        return {
          userId: user._id,
          role: user.role,
          roles: (user.roles ?? []).filter(
            (role): role is "instructor" | "studio" => role === "instructor" || role === "studio",
          ),
          onboardingComplete: user.onboardingComplete,
          isActive: user.isActive,
          emailVerified: user.emailVerificationTime !== undefined,
          hasInstructorProfile: instructorProfiles.length > 0,
          hasStudioProfile: studioProfiles.length > 0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }),
    );

    return {
      email: normalizedEmail,
      userCount: users.length,
      ...(canonicalUserId ? { canonicalUserId } : {}),
      users: userEntries.sort((left, right) => left.createdAt - right.createdAt),
    };
  },
});

export const dedupeUsersForEmail = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      return null;
    }
    return await dedupeUsersByEmail({
      ctx,
      normalizedEmail,
      requireVerifiedUser: true,
    });
  },
});
