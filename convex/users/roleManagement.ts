import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { mergeOwnedRoles, resolveOwnedRoles, appRoleValidator } from "./_shared";
import type { AppRole } from "./_shared";

// setMyRole: mutation to set user's role
export const setMyRole = mutation({
  args: {
    role: v.union(v.literal("instructor"), v.literal("studio")),
  },
  returns: v.id("users"),
  handler: (async (ctx: any, args: any): Promise<any> => {
    const existing = await requireCurrentUser(ctx);
    const existingRoles = await resolveOwnedRoles(ctx, existing);

    if (!existing) {
      throw new ConvexError("User must be synced before role selection");
    }

    if (existing.role === args.role) {
      return existing._id;
    }

    await ctx.db.patch("users", existing._id, {
      role: args.role,
      roles: mergeOwnedRoles(existingRoles, args.role),
      onboardingComplete: existingRoles.includes(args.role) ? existing.onboardingComplete : false,
      updatedAt: Date.now(),
    });

    return existing._id;
  }) as any,
});

// switchActiveRole: mutation to switch between owned roles
export const switchActiveRole = mutation({
  args: {
    role: appRoleValidator,
  },
  returns: v.object({
    ok: v.boolean(),
    role: appRoleValidator,
    roles: v.array(appRoleValidator),
  }),
  handler: (async (ctx: any, args: any): Promise<any> => {
    const user = await requireCurrentUser(ctx);
    const roles = await resolveOwnedRoles(ctx, user);

    if (!roles.includes(args.role)) {
      throw new ConvexError("Profile not found for requested role");
    }

    await ctx.db.patch("users", user._id, {
      role: args.role,
      roles,
      updatedAt: Date.now(),
    });

    return {
      ok: true,
      role: args.role,
      roles,
    };
  }) as any,
});