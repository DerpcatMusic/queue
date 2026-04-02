import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser, requireInternalAdmin } from "./lib/auth";
import {
  assertSingleInternalAccessTarget,
  internalAccessRoleValidator,
  normalizeInternalAccessEmail,
  resolveInternalAccessForUser,
} from "./lib/internalAccess";
import { omitUndefined } from "./lib/validation";

const MAX_NOTES_LENGTH = 240;

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
    const user = await requireCurrentUser(ctx);
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
    await requireInternalAdmin(ctx);
    return await ctx.db
      .query("internalAccessGrants")
      .withIndex("by_role_active", (q) => q.eq("role", "admin").eq("active", true))
      .collect()
      .then(async (adminRows) => {
        const testerRows = await ctx.db
          .query("internalAccessGrants")
          .withIndex("by_role_active", (q) => q.eq("role", "tester").eq("active", true))
          .collect();
        return [...adminRows, ...testerRows].sort((left, right) => right.updatedAt - left.updatedAt);
      });
  },
});

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
    const adminUser = await requireInternalAdmin(ctx);
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

    if (active) {
      await ctx.db.insert("internalAccessGrants", {
        role: args.role,
        verificationBypass,
        active: true,
        createdAt: now,
        updatedAt: now,
        grantedByUserId: adminUser._id,
        ...omitUndefined({
          userId: args.userId,
          email: normalizedEmail,
          notes: normalizeNotes(args.notes),
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
        role: active ? args.role : undefined,
      }),
    };
  },
});
