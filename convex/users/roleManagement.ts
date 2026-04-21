import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { mergeOwnedRoles, resolveOwnedRoles, appRoleValidator } from "./_shared";
import type { AppRole } from "./_shared";
import { auditRoleSwitch } from "../lib/audit";

/**
 * setMyRole: mutation to set user's role
 * 
 * Race condition fix: Re-fetches user and verifies role ownership before patching.
 * Uses Convex OCC (automatic retries) to handle concurrent document changes.
 * 
 * AUDIT: Logs role changes for security and compliance.
 */
export const setMyRole = mutation({
  args: {
    role: v.union(v.literal("instructor"), v.literal("studio")),
  },
  returns: v.id("users"),
  handler: (async (ctx: any, args: any): Promise<any> => {
    // Step 1: Get initial user for identity verification
    const initialUser = await requireCurrentUser(ctx);
    if (!initialUser) {
      throw new ConvexError("User must be synced before role selection");
    }

    // Step 2: Re-fetch user to get latest state (handles concurrent changes)
    // This fetch is part of Convex's OCC - if document changed, mutation will retry
    const user = await ctx.db.get("users", initialUser._id);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const previousRole = user.role;

    // Step 3: Resolve current roles with fresh user state
    // This reads profiles, so another mutation deleting profiles could conflict
    const existingRoles = await resolveOwnedRoles(ctx, user);

    // Step 4: Verify requested role is owned (re-verification after fresh fetch)
    if (!existingRoles.includes(args.role)) {
      // Audit failure
      await auditRoleSwitch(ctx, {
        user: { _id: user._id, email: user.email, role: user.role },
        previousRole: previousRole ?? "unknown",
        newRole: args.role,
        errorMessage: `User does not own the requested role: ${args.role}`,
      });
      throw new ConvexError({
        code: "ROLE_NOT_OWNED",
        message: `User does not own the requested role: ${args.role}`,
      });
    }

    // Step 5: Atomic single-operation patch
    // Convex OCC ensures this only succeeds if document hasn't changed since read
    await ctx.db.patch("users", user._id, {
      role: args.role,
      roles: existingRoles,
      onboardingComplete: existingRoles.includes(args.role) ? user.onboardingComplete : false,
      updatedAt: Date.now(),
    });

    // Audit success
    await auditRoleSwitch(ctx, {
      user: { _id: user._id, email: user.email, role: args.role },
      previousRole: previousRole ?? "unknown",
      newRole: args.role,
    });

    return user._id;
  }) as any,
});

/**
 * switchActiveRole: mutation to switch between owned roles
 * 
 * Race condition fix: 
 * 1. Re-fetches user and profiles to verify role ownership
 * 2. Uses single atomic patch operation
 * 3. Leverages Convex OCC for concurrent switch protection
 * 
 * AUDIT: Logs role switches for security and compliance.
 */
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
    // Step 1: Get initial user for identity verification
    const initialUser = await requireCurrentUser(ctx);

    // Step 2: Re-fetch user to ensure latest state for OCC
    const user = await ctx.db.get("users", initialUser._id);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const previousRole = user.role;

    // Step 3: Re-resolve owned roles with fresh user document
    // This is the critical re-verification step - profiles could have been
    // deleted by another mutation between initial fetch and here
    const roles = await resolveOwnedRoles(ctx, user);

    // Step 4: Verify the requested role is still in owned roles
    // This check happens AFTER re-fetching, ensuring TOCTOU safety
    if (!roles.includes(args.role)) {
      // Audit failure
      await auditRoleSwitch(ctx, {
        user: { _id: user._id, email: user.email, role: user.role },
        previousRole: previousRole ?? "unknown",
        newRole: args.role,
        errorMessage: "Profile not found for requested role. Role may have been removed.",
      });
      throw new ConvexError({
        code: "ROLE_NOT_OWNED",
        message: "Profile not found for requested role. Role may have been removed.",
      });
    }

    // Step 5: Atomic single-operation patch with verified role
    // The patch includes the verified roles array, ensuring consistency
    await ctx.db.patch("users", user._id, {
      role: args.role,
      roles,
      updatedAt: Date.now(),
    });

    // Audit success
    await auditRoleSwitch(ctx, {
      user: { _id: user._id, email: user.email, role: args.role },
      previousRole: previousRole ?? "unknown",
      newRole: args.role,
    });

    return {
      ok: true,
      role: args.role,
      roles,
    };
  }) as any,
});
