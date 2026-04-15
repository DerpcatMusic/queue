import { v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { resolveInternalAccessForUser } from "../lib/internalAccess";
import { omitUndefined } from "../lib/validation";
import type { Doc } from "../_generated/dataModel";
import type { UserProfileCtx } from "./_shared";
import { mergeOwnedRoles, resolveOwnedRoles, getUniqueInstructorProfileByUserId, getUniqueStudioProfileByUserId } from "./_shared";
import { appRoleValidator } from "./_shared";

// Private helpers needed by getCurrentUser query
async function toCurrentUserPayload(ctx: UserProfileCtx, user: Doc<"users">, roles: Array<"instructor" | "studio">) {
  const internalAccess = await resolveInternalAccessForUser(ctx, user);

  return {
    _id: user._id,
    _creationTime: user._creationTime,
    role: user.role,
    roles,
    onboardingComplete: user.onboardingComplete,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    hasVerificationBypass: internalAccess.verificationBypass,
    ...omitUndefined({
      email: user.email,
      fullName: user.fullName,
      phoneE164: user.phoneE164,
      name: user.name,
      image: user.image,
      emailVerificationTime: user.emailVerificationTime,
      phone: user.phone,
      phoneVerificationTime: user.phoneVerificationTime,
      isAnonymous: user.isAnonymous,
      internalRole: internalAccess.role,
    }),
  };
}

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
      roles: v.array(appRoleValidator),
      onboardingComplete: v.boolean(),
      email: v.optional(v.string()),
      fullName: v.optional(v.string()),
      phoneE164: v.optional(v.string()),
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      isActive: v.boolean(),
      internalRole: v.optional(v.union(v.literal("tester"), v.literal("admin"))),
      hasVerificationBypass: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx: QueryCtx) => {
    const user = await getCurrentUserDoc(ctx);

    if (!user || !user.isActive) {
      return null;
    }

    const roles = await resolveOwnedRoles(ctx, user);

    return await toCurrentUserPayload(ctx, user, roles);
  },
});