import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { isStripeIdentityVerified } from "../lib/stripeIdentity";
import { omitUndefined } from "../lib/validation";

/**
 * Normalises a name string for comparison:
 * - strips diacritics (accents)
 * - lowercases
 * - collapses runs of whitespace
 * - trims
 */
function normaliseForNameMatch(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true when the holder name from a public registry record matches
 * the instructor's verified legal name (diditLegalName / diditLegalFirstName).
 * Partial matching is accepted for compound / hyphenated names.
 */
export function nameMatchesHolder(
  holderName: string | undefined | null,
  legalFirst: string | undefined | null,
  legalMiddle: string | undefined | null,
  legalLast: string | undefined | null,
  legalFull: string | undefined | null,
): boolean {
  if (!holderName) return false;
  const normHolder = normaliseForNameMatch(holderName);
  if (!normHolder) return false;

  const candidates = [
    normaliseForNameMatch(legalFull),
    [normaliseForNameMatch(legalFirst), normaliseForNameMatch(legalLast)].filter(Boolean).join(" "),
    [
      normaliseForNameMatch(legalFirst),
      normaliseForNameMatch(legalMiddle),
      normaliseForNameMatch(legalLast),
    ]
      .filter(Boolean)
      .join(" "),
    normaliseForNameMatch(legalFirst),
  ].filter((s) => s.length > 0);

  // Exact match
  if (candidates.includes(normHolder)) return true;

  // Partial match: all non-trivial holder words appear in at least one candidate
  const holderWords = normHolder.split(" ").filter((w) => w.length > 2);
  if (holderWords.length === 0) return false;
  return holderWords.every((word) => candidates.some((candidate) => candidate.includes(word)));
}

export type InstructorTrustBadge =
  | "none"
  | "identity_verified"
  | "professionally_registered"
  | "fully_verified";

/**
 * Derives a trust badge from an instructor's verification state.
 *
 * - **fully_verified**: identity confirmed + valid FR registry + holder name matches verified legal name
 * - **professionally_registered**: valid FR registry + holder name matches (no identity yet)
 * - **identity_verified**: Stripe identity confirmed (no FR registry or mismatch)
 * - **none**: nothing verified yet
 */
export function computeInstructorTrustBadge(
  stripeAccount: Pick<Doc<"connectedAccounts">, "provider" | "status"> | null,
  professionalRegistryStatus: Doc<"instructorProfiles">["professionalRegistryStatus"] | undefined,
  professionalRegistryHasValidRegistration: boolean | undefined,
  professionalRegistryExpiresAt: number | undefined,
  professionalRegistryHolderName: string | undefined,
  professionalRegistryCountry: string | undefined,
  diditLegalFirstName: string | undefined,
  diditLegalMiddleName: string | undefined,
  diditLegalLastName: string | undefined,
  diditLegalName: string | undefined,
  now: number,
): InstructorTrustBadge {
  const identityVerified = isStripeIdentityVerified(stripeAccount);
  const isFrance = professionalRegistryCountry?.toUpperCase() === "FR";
  const registryValid =
    isFrance &&
    professionalRegistryStatus === "found" &&
    professionalRegistryHasValidRegistration === true &&
    (!professionalRegistryExpiresAt || professionalRegistryExpiresAt > now);
  const nameMatch =
    isFrance &&
    nameMatchesHolder(
      professionalRegistryHolderName,
      diditLegalFirstName,
      diditLegalMiddleName,
      diditLegalLastName,
      diditLegalName,
    );

  if (identityVerified && registryValid && nameMatch) return "fully_verified";
  if (identityVerified) return "identity_verified";
  if (registryValid && nameMatch) return "professionally_registered";
  return "none";
}

/**
 * Returns the `isNameMatched` flag for the public profile response.
 * Kept separate so callers can reference it independently.
 */
export function isNameMatchedToRegistry(
  _professionalRegistryCountry: string | undefined,
  _professionalRegistryHolderName: string | undefined,
  professionalRegistryNameMatched: boolean | undefined,
): boolean {
  return professionalRegistryNameMatched ?? false;
}

/**
 * Public query — no auth required.
 * Returns instructor public profile enriched with professional registry trust signals
 * so studios can see what kind of verification an instructor has.
 */
export const getInstructorPublicProfileBySlug = query({
  args: {
    slug: v.string(),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      instructorId: v.id("instructorProfiles"),
      displayName: v.string(),
      sports: v.array(v.string()),
      /**
       * Legacy field — always true for backward compatibility.
       * Clients should use `trustBadge` for granular trust signals.
       */
      isVerified: v.boolean(),
      trustBadge: v.union(
        v.literal("none"),
        v.literal("identity_verified"),
        v.literal("professionally_registered"),
        v.literal("fully_verified"),
      ),
      slug: v.string(),
      ...omitUndefined({
        bio: v.string(),
        profileImageUrl: v.string(),
        hourlyRateExpectation: v.number(),
        /**
         * Only set when the instructor has a verified professional registry
         * (professionally_registered or fully_verified badge).
         */
        professionalRegistry: v.object({
          country: v.literal("FR"),
          identifier: v.string(),
          holderName: v.string(),
          issuingAuthority: v.string(),
          expiresOn: v.optional(v.string()),
          hasValidRegistration: v.boolean(),
          isNameMatched: v.boolean(),
          publicProfileUrl: v.optional(v.string()),
        }),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();

    // Public query — no auth required
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!profile) {
      return null;
    }

    const [sportsRows, profileImageUrl, stripeAccounts] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
      profile.profileImageStorageId ? ctx.storage.getUrl(profile.profileImageStorageId) : null,
      ctx.db
        .query("connectedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .order("desc")
        .take(10),
    ]);
    const stripeAccount = stripeAccounts.find((account) => account.provider === "stripe") ?? null;

    const trustBadge = computeInstructorTrustBadge(
      stripeAccount,
      profile.professionalRegistryStatus,
      profile.professionalRegistryHasValidRegistration,
      profile.professionalRegistryExpiresAt,
      profile.professionalRegistryHolderName,
      profile.professionalRegistryCountry,
      profile.diditLegalFirstName,
      profile.diditLegalMiddleName,
      profile.diditLegalLastName,
      profile.diditLegalName,
      now,
    );

    const isFrance = profile.professionalRegistryCountry?.toUpperCase() === "FR";
    const hasRegistry =
      isFrance &&
      profile.professionalRegistryStatus === "found" &&
      profile.professionalRegistryHasValidRegistration === true;

    const professionalRegistry = hasRegistry
      ? {
          country: "FR" as const,
          identifier: profile.professionalRegistryIdentifier!,
          holderName: profile.professionalRegistryHolderName ?? "",
          issuingAuthority: profile.professionalRegistryIssuingAuthority ?? "",
          expiresOn: profile.professionalRegistryExpiresOn,
          hasValidRegistration: profile.professionalRegistryHasValidRegistration ?? false,
          isNameMatched: isNameMatchedToRegistry(
            profile.professionalRegistryCountry,
            profile.professionalRegistryHolderName,
            profile.professionalRegistryNameMatched,
          ),
          publicProfileUrl: profile.professionalRegistryPublicUrl,
        }
      : undefined;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      isVerified: trustBadge !== "none",
      trustBadge,
      slug: profile.slug,
      ...omitUndefined({
        bio: profile.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        hourlyRateExpectation: profile.hourlyRateExpectation,
        professionalRegistry: hasRegistry ? professionalRegistry : undefined,
      }),
    };
  },
});

/**
 * Public query: get instructor profile redirect info by ULID.
 * Returns { slug } if found so old /profiles/instructors/[ulid] URLs
 * can redirect to the new /instructor/{slug} URL.
 */
export const getInstructorProfileRedirect = query({
  args: {
    instructorId: v.id("instructorProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const profile = await ctx.db.get(args.instructorId);
    if (!profile?.slug) {
      return null;
    }
    return { slug: profile.slug };
  },
});

/**
 * Authenticated — instructor views another instructor's profile.
 * Also enriched with trust signals.
 */
export const getInstructorPublicProfileForInstructor = query({
  args: {
    instructorId: v.id("instructorProfiles"),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      instructorId: v.id("instructorProfiles"),
      displayName: v.string(),
      bio: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      hourlyRateExpectation: v.optional(v.number()),
      sports: v.array(v.string()),
      isVerified: v.boolean(),
      trustBadge: v.union(
        v.literal("none"),
        v.literal("identity_verified"),
        v.literal("professionally_registered"),
        v.literal("fully_verified"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user?.isActive || user.role !== "instructor") {
      return null;
    }

    const profile = await ctx.db.get(args.instructorId);
    if (!profile) {
      return null;
    }

    const now = args.now ?? Date.now();
    const [sportsRows, profileImageUrl, stripeAccounts] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", args.instructorId))
        .collect(),
      profile.profileImageStorageId ? ctx.storage.getUrl(profile.profileImageStorageId) : null,
      ctx.db
        .query("connectedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .order("desc")
        .take(10),
    ]);
    const stripeAccount = stripeAccounts.find((account) => account.provider === "stripe") ?? null;

    const trustBadge = computeInstructorTrustBadge(
      stripeAccount,
      profile.professionalRegistryStatus,
      profile.professionalRegistryHasValidRegistration,
      profile.professionalRegistryExpiresAt,
      profile.professionalRegistryHolderName,
      profile.professionalRegistryCountry,
      profile.diditLegalFirstName,
      profile.diditLegalMiddleName,
      profile.diditLegalLastName,
      profile.diditLegalName,
      now,
    );

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      isVerified: trustBadge !== "none",
      trustBadge,
      ...omitUndefined({
        bio: profile.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        hourlyRateExpectation: profile.hourlyRateExpectation,
      }),
    };
  },
});
