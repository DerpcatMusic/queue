import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentUser, requireInternalTester } from "../lib/auth";
import {
  assertSingleInternalAccessTarget,
  internalAccessRoleValidator,
  normalizeInternalAccessEmail,
  requireInternalTesterFeatureEnabled,
  resolveInternalAccessForUser,
} from "../lib/internalAccess";
import { auditInternalAccessChange } from "../lib/audit";
import { omitUndefined } from "../lib/validation";

const MAX_NOTES_LENGTH = 240;
const INTERNAL_ACCESS_BOOTSTRAP_TOKEN_ENV = "INTERNAL_ACCESS_BOOTSTRAP_TOKEN";

// Internal tester email management constants
const INTERNAL_TESTER_EMAILS_ENV = "INTERNAL_TESTER_EMAILS";
const MAX_INTERNAL_TESTER_COUNT = 5;

function getInternalTesterEmails(): Set<string> {
  const envValue = process.env[INTERNAL_TESTER_EMAILS_ENV] ?? "";
  const emails = envValue
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
  
  // Enforce maximum count limit
  if (emails.length > MAX_INTERNAL_TESTER_COUNT) {
    console.warn(
      `[SECURITY] INTERNAL_TESTER_EMAILS has ${emails.length} emails, exceeding max of ${MAX_INTERNAL_TESTER_COUNT}. Only first ${MAX_INTERNAL_TESTER_COUNT} will be active.`,
    );
  }

  return new Set(emails.slice(0, MAX_INTERNAL_TESTER_COUNT));
}

function isInternalTesterEmail(email: string | undefined): boolean {
  if (!email) return false;
  return getInternalTesterEmails().has(email.trim().toLowerCase());
}

function normalizeNotes(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length > MAX_NOTES_LENGTH) {
    throw new ConvexError(`notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }
  return normalized;
}

async function deactivateMatchingActiveGrants(
  ctx: MutationCtx,
  args: {
    userId?: Doc<"users">["_id"];
    email?: string;
    now: number;
  },
) {
  const [userMatches, emailMatches] = await Promise.all([
    args.userId
      ? ctx.db
          .query("internalAccessGrants")
          .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("active", true))
          .collect()
      : Promise.resolve([]),
    args.email
      ? ctx.db
          .query("internalAccessGrants")
          .withIndex("by_email_active", (q) => q.eq("email", args.email).eq("active", true))
          .collect()
      : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  const matches = [...userMatches, ...emailMatches].filter((row) => {
    const key = String(row._id);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  await Promise.all(
    matches.map((row) =>
      ctx.db.patch(row._id, {
        active: false,
        updatedAt: args.now,
      }),
    ),
  );
}

function isValidInternalAccessBootstrapToken(accessToken: string | undefined): boolean {
  const expected = process.env[INTERNAL_ACCESS_BOOTSTRAP_TOKEN_ENV]?.trim();
  return Boolean(expected) && accessToken?.trim() === expected;
}

async function applyInternalAccessGrant(
  ctx: MutationCtx,
  args: {
    userId?: Doc<"users">["_id"];
    email?: string;
    role: "tester";
    verificationBypass?: boolean;
    active?: boolean;
    notes?: string;
    grantedByUserId?: Doc<"users">["_id"];
  },
) {
  requireInternalTesterFeatureEnabled();
  assertSingleInternalAccessTarget(args);

  const now = Date.now();
  const targetUser = args.userId ? await ctx.db.get(args.userId) : null;
  if (args.userId && !targetUser) {
    throw new ConvexError("Target user not found");
  }

  const normalizedEmail = normalizeInternalAccessEmail(args.email ?? targetUser?.email);
  if (!args.userId && !normalizedEmail) {
    throw new ConvexError("Target email is required when userId is not provided");
  }

  await deactivateMatchingActiveGrants(ctx, {
    now,
    ...omitUndefined({
      userId: args.userId,
      email: normalizedEmail,
    }),
  });

  const active = args.active ?? true;
  const verificationBypass = args.verificationBypass ?? true;
  const normalizedRole = "tester" as const;

  if (active) {
    await ctx.db.insert("internalAccessGrants", {
      role: normalizedRole,
      verificationBypass,
      active: true,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        userId: args.userId,
        email: normalizedEmail,
        notes: normalizeNotes(args.notes),
        grantedByUserId: args.grantedByUserId,
      }),
    });
  }

  return {
    ok: true,
    verificationBypass: active ? verificationBypass : false,
    active,
    ...omitUndefined({
      userId: args.userId,
      email: normalizedEmail,
      role: active ? normalizedRole : undefined,
    }),
  };
}

export const getMyInternalAccess = query({
  args: {},
  returns: v.object({
    role: v.optional(internalAccessRoleValidator),
    verificationBypass: v.boolean(),
    canManageInternalAccess: v.boolean(),
    source: v.union(
      v.literal("none"),
      v.literal("table"),
      v.literal("env"),
      v.literal("table+env"),
    ),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        verificationBypass: false,
        canManageInternalAccess: false,
        source: "none" as const,
      };
    }
    return await resolveInternalAccessForUser(ctx, user);
  },
});

export const listInternalAccessGrants = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("internalAccessGrants"),
      userId: v.optional(v.id("users")),
      email: v.optional(v.string()),
      role: internalAccessRoleValidator,
      verificationBypass: v.boolean(),
      active: v.boolean(),
      notes: v.optional(v.string()),
      grantedByUserId: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    requireInternalTesterFeatureEnabled();
    await requireInternalTester(ctx);
    const testerRows = await ctx.db
      .query("internalAccessGrants")
      .withIndex("by_role_active", (q) => q.eq("role", "tester").eq("active", true))
      .collect();
    return testerRows.sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

/**
 * setInternalAccessGrant: Grant or revoke internal tester access.
 * 
 * AUDIT: Logs internal access grants for security and compliance.
 */
export const setInternalAccessGrant = mutation({
  args: {
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: internalAccessRoleValidator,
    verificationBypass: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: v.optional(internalAccessRoleValidator),
    verificationBypass: v.boolean(),
    active: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireInternalTesterFeatureEnabled();
    const testerUser = await requireInternalTester(ctx);
    const active = args.active ?? true;
    const result = await applyInternalAccessGrant(ctx, {
      ...args,
      grantedByUserId: testerUser._id,
    });

    await auditInternalAccessChange(ctx, {
      actor: {
        _id: testerUser._id,
        ...omitUndefined({ email: testerUser.email, role: testerUser.role }),
      },
      grantedRole: "tester",
      active,
      success: true,
      ...omitUndefined({ targetUserId: args.userId, targetEmail: args.email }),
    });

    return result;
  },
});

/**
 * setInternalAccessGrantWithAccessToken: Grant internal access using bootstrap token.
 * 
 * AUDIT: Logs internal access grants for security and compliance.
 */
export const setInternalAccessGrantWithAccessToken = mutation({
  args: {
    accessToken: v.string(),
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: internalAccessRoleValidator,
    verificationBypass: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: v.optional(internalAccessRoleValidator),
    verificationBypass: v.boolean(),
    active: v.boolean(),
    source: v.string(),
  }),
  handler: async (ctx, args) => {
    requireInternalTesterFeatureEnabled();
    const now = Date.now();
    const active = args.active ?? true;

    if (!isValidInternalAccessBootstrapToken(args.accessToken)) {
      await auditInternalAccessChange(ctx, {
        grantedRole: "tester",
        active,
        success: false,
        errorMessage: "Invalid bootstrap token",
        ...omitUndefined({ targetUserId: args.userId, targetEmail: args.email }),
      });
      throw new ConvexError(
        "Unauthorized internal access bootstrap operation. Set INTERNAL_ACCESS_BOOTSTRAP_TOKEN and pass accessToken.",
      );
    }

    if (args.email) {
      const normalizedEmail = normalizeInternalAccessEmail(args.email);
      if (isInternalTesterEmail(normalizedEmail)) {
        await auditInternalAccessChange(ctx, {
          grantedRole: "tester",
          active,
          success: true,
          ...omitUndefined({ targetUserId: args.userId, targetEmail: normalizedEmail }),
        });

        const result = await applyInternalAccessGrant(ctx, {
          ...args,
          ...omitUndefined({ email: normalizedEmail }),
          role: "tester",
          notes: args.notes ?? `Internal tester granted via bootstrap at ${new Date(now).toISOString()}`,
        });

        return {
          ...result,
          source: "env",
        };
      }
    }

    await auditInternalAccessChange(ctx, {
      grantedRole: "tester",
      active,
      success: true,
      ...omitUndefined({ targetUserId: args.userId, targetEmail: args.email }),
    });

    const result = await applyInternalAccessGrant(ctx, {
      ...args,
      role: "tester",
      notes: args.notes ?? `Bootstrap granted at ${new Date(now).toISOString()}`,
    });

    return {
      ...result,
      source: "token",
    };
  },
});

/**
 * setVerificationBypassForUser: Enable or disable verification bypass for a user.
 * 
 * AUDIT: Logs verification bypass changes for security and compliance.
 */
export const setVerificationBypassForUser = mutation({
  args: {
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    active: v.boolean(),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: v.optional(internalAccessRoleValidator),
    verificationBypass: v.boolean(),
    active: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireInternalTesterFeatureEnabled();
    const testerUser = await requireInternalTester(ctx);
    const result = await applyInternalAccessGrant(ctx, {
      role: "tester",
      verificationBypass: true,
      active: args.active,
      grantedByUserId: testerUser._id,
      ...omitUndefined({
        userId: args.userId,
        email: args.email,
        notes: args.notes,
      }),
    });

    await auditInternalAccessChange(ctx, {
      actor: {
        _id: testerUser._id,
        ...omitUndefined({ email: testerUser.email, role: testerUser.role }),
      },
      grantedRole: "tester",
      active: args.active,
      success: true,
      ...omitUndefined({ targetUserId: args.userId, targetEmail: args.email }),
    });

    return result;
  },
});

// ===== INTERNAL TESTER EMAIL MANAGEMENT =====

export const listInternalTesterEmails = query({
  args: {},
  returns: v.object({
    emails: v.array(v.string()),
    count: v.number(),
    maxAllowed: v.number(),
    configured: v.boolean(),
  }),
  handler: async (ctx) => {
    requireInternalTesterFeatureEnabled();
    await requireInternalTester(ctx);
    const emails = getInternalTesterEmails();
    return {
      emails: Array.from(emails),
      count: emails.size,
      maxAllowed: MAX_INTERNAL_TESTER_COUNT,
      configured: emails.size > 0,
    };
  },
});

export const addInternalTesterEmail = mutation({
  args: {
    accessToken: v.string(),
    email: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
  }),
  handler: async (_ctx, args) => {
    // Validate bootstrap token
    if (!isValidInternalAccessBootstrapToken(args.accessToken)) {
      throw new ConvexError("Unauthorized bootstrap operation");
    }

    const normalizedEmail = normalizeInternalAccessEmail(args.email);
    if (!normalizedEmail) {
      throw new ConvexError("Invalid email format");
    }

    requireInternalTesterFeatureEnabled();
    const currentEmails = getInternalTesterEmails();
    if (currentEmails.size >= MAX_INTERNAL_TESTER_COUNT && !currentEmails.has(normalizedEmail)) {
      throw new ConvexError(
        `Cannot add more than ${MAX_INTERNAL_TESTER_COUNT} internal tester emails. Remove one first.`,
      );
    }

    return {
      ok: true,
      message: `To add ${normalizedEmail} as an internal tester, update INTERNAL_TESTER_EMAILS env var to: ${[...currentEmails, normalizedEmail].join(",")}`,
    };
  },
});

export const removeInternalTesterEmail = mutation({
  args: {
    accessToken: v.string(),
    email: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
  }),
  handler: async (_ctx, args) => {
    // Validate bootstrap token
    if (!isValidInternalAccessBootstrapToken(args.accessToken)) {
      throw new ConvexError("Unauthorized bootstrap operation");
    }

    const normalizedEmail = normalizeInternalAccessEmail(args.email);
    if (!normalizedEmail) {
      throw new ConvexError("Invalid email format");
    }

    requireInternalTesterFeatureEnabled();
    const currentEmails = getInternalTesterEmails();
    if (!currentEmails.has(normalizedEmail)) {
      return {
        ok: true,
        message: `${normalizedEmail} is not an internal tester`,
      };
    }

    const remaining = [...currentEmails].filter((e) => e !== normalizedEmail);
    return {
      ok: true,
      message: `To remove ${normalizedEmail} from internal testers, update INTERNAL_TESTER_EMAILS env var to: ${remaining.join(",") || "(empty)"}`,
    };
  },
});
