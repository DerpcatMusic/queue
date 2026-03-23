import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { dedupeUsersByEmail, normalizeEmail, resolveCanonicalUserByEmail } from "./lib/authDedupe";
import { ResendMagicLink } from "./resendMagicLink";
import { ResendOTP } from "./resendOtp";

const providers: any[] = [ResendOTP, ResendMagicLink];

export function resolveLinkedUserId(args: {
  existingUserId: Id<"users"> | null | undefined;
  matchedUserIdsByEmail: readonly Id<"users">[];
  email: string | undefined;
}) {
  const { matchedUserIdsByEmail, email } = args;
  const existingUserId = args.existingUserId ?? undefined;
  const matchedUserId = matchedUserIdsByEmail[0];

  if (existingUserId && matchedUserIdsByEmail.includes(existingUserId)) {
    return existingUserId;
  }

  if (matchedUserIdsByEmail.length > 1) {
    throw new ConvexError("Ambiguous account resolution for this email");
  }

  if (existingUserId && matchedUserId && existingUserId !== matchedUserId) {
    throw new ConvexError("Email is already linked to a different account");
  }

  if (existingUserId) {
    return existingUserId;
  }

  if (matchedUserId) {
    return matchedUserId;
  }

  if (email) {
    return undefined;
  }
  return undefined;
}

export function canResolveLinkedUserByEmail(email: string | undefined, isEmailVerified: boolean) {
  return Boolean(email) && isEmailVerified;
}

export function resolveProfileEmailVerified(args: {
  profile: Record<string, unknown>;
  provider: {
    type?: string | undefined;
    allowDangerousEmailAccountLinking?: boolean | undefined;
  };
}) {
  const { profile, provider } = args;
  const explicitEmailVerified = profile.emailVerified;
  if (explicitEmailVerified === true) {
    return true;
  }
  if (explicitEmailVerified === false) {
    return false;
  }

  const rawEmailVerified = profile.email_verified;
  if (rawEmailVerified === true || rawEmailVerified === "true") {
    return true;
  }
  if (rawEmailVerified === false || rawEmailVerified === "false") {
    return false;
  }

  return (
    (provider.type === "oauth" || provider.type === "oidc") &&
    provider.allowDangerousEmailAccountLinking !== false
  );
}

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isAllowedRedirectTarget(redirectTo: string) {
  if (redirectTo.startsWith("/")) {
    return true;
  }
  if (redirectTo.startsWith("queue://") || redirectTo.startsWith("exp://")) {
    return true;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(redirectTo)) {
    return true;
  }

  const siteOrigin = normalizeOrigin(process.env.SITE_URL);
  const convexSiteOrigin = normalizeOrigin(process.env.CONVEX_SITE_URL);

  try {
    const candidateOrigin = new URL(redirectTo).origin;
    return candidateOrigin === siteOrigin || candidateOrigin === convexSiteOrigin;
  } catch {
    return false;
  }
}

function getFallbackRedirectTarget() {
  return process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "http://localhost:3000";
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(Apple);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    async redirect({ redirectTo }) {
      if (isAllowedRedirectTarget(redirectTo)) {
        return redirectTo;
      }
      return getFallbackRedirectTarget();
    },
    async createOrUpdateUser(ctx, args) {
      const now = Date.now();
      const fullName = typeof args.profile.name === "string" ? args.profile.name : undefined;
      const rawEmail = typeof args.profile.email === "string" ? args.profile.email : undefined;
      const email = normalizeEmail(rawEmail);
      const phone = typeof args.profile.phone === "string" ? args.profile.phone : undefined;
      const image = typeof args.profile.image === "string" ? args.profile.image : undefined;
      const isEmailVerified = resolveProfileEmailVerified({
        profile: args.profile,
        provider: args.provider,
      });
      const emailVerificationTime = isEmailVerified ? now : undefined;
      const phoneVerificationTime = args.profile.phoneVerified === true ? now : undefined;
      const isAnonymous =
        typeof args.profile.isAnonymous === "boolean" ? args.profile.isAnonymous : undefined;

      const emailMatches = canResolveLinkedUserByEmail(email, isEmailVerified)
        ? await ((ctx.db.query("users") as any)
            .withIndex("by_email", (q: any) => q.eq("email", email))
            .collect() as Promise<Array<{ _id: Id<"users"> }>>)
        : [];
      const normalizedEmailMatches = emailMatches.map((row) => row._id);
      let linkedUserId: Id<"users"> | null | undefined = null;
      const dedupedUserId =
        canResolveLinkedUserByEmail(email, isEmailVerified) && normalizedEmailMatches.length > 1
          ? await dedupeUsersByEmail({
              ctx,
              normalizedEmail: email!,
              preferredUserId: args.existingUserId,
              now,
              requireVerifiedUser: true,
              emailOwnershipVerified: isEmailVerified,
            })
          : null;
      if (dedupedUserId) {
        linkedUserId = dedupedUserId;
      } else if (
        canResolveLinkedUserByEmail(email, isEmailVerified) &&
        normalizedEmailMatches.length > 1
      ) {
        linkedUserId = await resolveCanonicalUserByEmail({
          ctx,
          normalizedEmail: email!,
          preferredUserId: args.existingUserId,
        });
      }
      if (!linkedUserId) {
        linkedUserId = resolveLinkedUserId({
          existingUserId: args.existingUserId,
          matchedUserIdsByEmail: normalizedEmailMatches,
          email,
        });
      }

      if (linkedUserId) {
        await ctx.db.patch("users", linkedUserId, {
          isActive: true,
          updatedAt: now,
          ...(fullName ? { fullName } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phoneE164: phone } : {}),
          ...(image ? { image } : {}),
          ...(emailVerificationTime ? { emailVerificationTime } : {}),
          ...(phoneVerificationTime ? { phoneVerificationTime } : {}),
          ...(isAnonymous !== undefined ? { isAnonymous } : {}),
        });
        return linkedUserId;
      }

      const userId = await ctx.db.insert("users", {
        role: "pending",
        roles: [],
        onboardingComplete: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...(fullName ? { fullName } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phoneE164: phone } : {}),
        ...(image ? { image } : {}),
        ...(emailVerificationTime ? { emailVerificationTime } : {}),
        ...(phoneVerificationTime ? { phoneVerificationTime } : {}),
        ...(isAnonymous !== undefined ? { isAnonymous } : {}),
      });
      return userId;
    },
  },
});
