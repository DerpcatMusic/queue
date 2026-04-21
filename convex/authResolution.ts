import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { dedupeUsersByEmail, normalizeEmail, resolveCanonicalUserByEmail } from "./lib/authDedupe";

const EMAIL_ACCOUNT_PROVIDER_IDS = ["resend", "resend-otp"] as const;

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

async function findMatchedUserIdsFromEmailAccounts(
  ctx: any,
  normalizedEmail: string,
): Promise<Id<"users">[]> {
  const matchedUserIds = new Set<string>();

  for (const providerId of EMAIL_ACCOUNT_PROVIDER_IDS) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q: any) =>
        q.eq("provider", providerId).eq("providerAccountId", normalizedEmail),
      )
      .unique();

    if (account?.userId) {
      matchedUserIds.add(String(account.userId));
    }
  }

  return Array.from(matchedUserIds) as Id<"users">[];
}

async function findMatchedUserIdsFromProviderAccountHint(
  ctx: any,
  profile: Record<string, unknown>,
): Promise<Id<"users">[]> {
  const providerAccountIdHint =
    typeof profile.providerAccountIdHint === "string" ? profile.providerAccountIdHint : undefined;
  const providerAccountProviders = Array.isArray(profile.providerAccountProviders)
    ? profile.providerAccountProviders.filter(
        (providerId): providerId is string =>
          typeof providerId === "string" && providerId.length > 0,
      )
    : [];

  if (!providerAccountIdHint || providerAccountProviders.length === 0) {
    return [];
  }

  const matchedUserIds = new Set<string>();
  for (const providerId of providerAccountProviders) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q: any) =>
        q.eq("provider", providerId).eq("providerAccountId", providerAccountIdHint),
      )
      .unique();

    if (account?.userId) {
      matchedUserIds.add(String(account.userId));
    }
  }

  return Array.from(matchedUserIds) as Id<"users">[];
}

export async function resolveAuthenticatedUser(
  ctx: any,
  args: {
    existingUserId: Id<"users"> | null | undefined;
    profile: Record<string, unknown>;
    provider: {
      type?: string | undefined;
      allowDangerousEmailAccountLinking?: boolean | undefined;
    };
  },
) {
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

  const hintedMatchedUserIds = await findMatchedUserIdsFromProviderAccountHint(ctx, args.profile);
  const emailMatches = canResolveLinkedUserByEmail(email, isEmailVerified)
    ? await ((ctx.db.query("users") as any)
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .collect() as Promise<Array<{ _id: Id<"users"> }>>)
    : [];
  const accountMatchedUserIds = canResolveLinkedUserByEmail(email, isEmailVerified)
    ? await findMatchedUserIdsFromEmailAccounts(ctx, email!)
    : [];
  const normalizedEmailMatches = Array.from(
    new Set([
      ...hintedMatchedUserIds.map((userId) => String(userId)),
      ...emailMatches.map((row) => String(row._id)),
      ...accountMatchedUserIds.map((userId) => String(userId)),
    ]),
  ) as Id<"users">[];
  const preferredHintedUserId = hintedMatchedUserIds.length === 1 ? hintedMatchedUserIds[0] : null;
  let linkedUserId: Id<"users"> | null | undefined = preferredHintedUserId;
  const dedupedUserId =
    canResolveLinkedUserByEmail(email, isEmailVerified) && normalizedEmailMatches.length > 1
      ? await dedupeUsersByEmail({
          ctx,
          normalizedEmail: email!,
          ...(args.existingUserId !== undefined ? { preferredUserId: args.existingUserId } : {}),
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
      ...(args.existingUserId !== undefined ? { preferredUserId: args.existingUserId } : {}),
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

    if (email && isEmailVerified) {
      const duplicateUsers = await ((ctx.db.query("users") as any)
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .collect() as Promise<Array<{ _id: Id<"users"> }>>);
      if (duplicateUsers.length > 1) {
        const dedupedUserId = await dedupeUsersByEmail({
          ctx,
          normalizedEmail: email,
          preferredUserId: linkedUserId,
          now,
          requireVerifiedUser: true,
          emailOwnershipVerified: true,
        });
        if (dedupedUserId) {
          linkedUserId = dedupedUserId;
        }
      }
    }

    return linkedUserId;
  }

  return await ctx.db.insert("users", {
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
}
