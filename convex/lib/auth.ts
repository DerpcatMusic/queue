import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

type UserRole = Doc<"users">["role"];

export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  return identity;
}

export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  const user = await ctx.db.get(userId);

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function requireCurrentUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new ConvexError("Authenticated user is not registered");
  }
  if (!user.isActive) {
    throw new ConvexError("Account disabled");
  }
  return user;
}

export async function requireUserRole(ctx: Ctx, roles: UserRole[]): Promise<Doc<"users">> {
  const user = await requireCurrentUser(ctx);

  if (!roles.includes(user.role)) {
    throw new ConvexError("Not authorized for this operation");
  }

  return user;
}
