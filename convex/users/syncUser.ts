import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "./_shared";
import { requireIdentity, requireCurrentUser } from "../lib/auth";
import { omitUndefined } from "../lib/validation";

// syncCurrentUser: mutation that syncs Clerk identity into the `users` record
export const syncCurrentUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx: MutationCtx) => {
    const identity = await requireIdentity(ctx);
    const user = await requireCurrentUser(ctx);
    const now = Date.now();
    const normalizedIdentityEmail = normalizeEmail(identity.email);
    const normalizedCurrentEmail = normalizeEmail(user.email);
    const nextEmail = normalizedCurrentEmail ?? normalizedIdentityEmail;

    const derivedName = [identity.givenName, identity.familyName].filter(Boolean).join(" ").trim();
    const fullName = identity.name ?? (derivedName.length > 0 ? derivedName : undefined);

    await ctx.db.patch("users", user._id, {
      ...omitUndefined({
        email: nextEmail,
        fullName: user.fullName ?? fullName,
        phoneE164: identity.phoneNumber ?? user.phoneE164,
      }),
      isActive: true,
      updatedAt: now,
    });

    return user._id;
  },
});