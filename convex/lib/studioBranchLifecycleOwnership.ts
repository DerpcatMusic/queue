import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ErrorCode } from "./errors";

export async function ensureStudioOwnerMembership(
  ctx: MutationCtx,
  studio: Pick<Doc<"studioProfiles">, "_id" | "userId">,
  now = Date.now(),
) {
  const existing = await ctx.db
    .query("studioMemberships")
    .withIndex("by_studio_user", (q) => q.eq("studioId", studio._id).eq("userId", studio.userId))
    .unique();
  if (existing) {
    if (existing.role !== "owner" || existing.status !== "active") {
      await ctx.db.patch(existing._id, {
        role: "owner",
        status: "active",
        updatedAt: now,
      });
      const refreshed = await ctx.db.get(existing._id);
      if (refreshed) return refreshed;
    } else {
      return existing;
    }
  }

  const membershipId = await ctx.db.insert("studioMemberships", {
    studioId: studio._id,
    userId: studio.userId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(membershipId);
  if (!created) {
    throw new ConvexError({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Failed to create studio membership",
    });
  }
  return created;
}
