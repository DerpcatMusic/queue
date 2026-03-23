import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser as getCurrentUserDoc,
  requireCurrentUser,
  requireIdentity,
  requireUserRole,
} from "./lib/auth";
import { normalizeSportType, normalizeZoneId } from "./lib/domainValidation";
import { rebuildInstructorCoverage } from "./lib/instructorCoverage";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "./lib/validation";

const MAX_SPORTS = 12;
const MAX_ZONES = 25;
const MAX_STUDIO_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 220;
const MAX_PHONE_LENGTH = 20;
const MAX_PROFILE_BIO_LENGTH = 280;
const MAX_SOCIAL_LINK_LENGTH = 220;
const PROFILE_IMAGE_UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;
const SOCIAL_LINK_KEYS = [
  "instagram",
  "tiktok",
  "whatsapp",
  "facebook",
  "linkedin",
  "website",
] as const;
const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});
const appRoleValidator = v.union(v.literal("instructor"), v.literal("studio"));

type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
type SocialLinksValue = Partial<Record<SocialLinkKey, string>>;
type AppRole = "instructor" | "studio";

function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : undefined;
}

function createUploadSessionToken(userId: Doc<"users">["_id"], now: number) {
  const entropy = Math.random().toString(36).slice(2, 12);
  return `${String(userId)}:${now}:${entropy}`;
}

function normalizeSocialLinks(socialLinks: SocialLinksValue | undefined): SocialLinksValue {
  const normalized: SocialLinksValue = {};

  for (const key of SOCIAL_LINK_KEYS) {
    const value = normalizeOptionalString(
      socialLinks?.[key],
      MAX_SOCIAL_LINK_LENGTH,
      `${key} link`,
    );
    if (value) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function toOptionalSocialLinksPayload(
  socialLinks: SocialLinksValue | undefined,
): SocialLinksValue | undefined {
  if (!socialLinks) {
    return undefined;
  }

  return Object.keys(socialLinks).length > 0 ? socialLinks : undefined;
}

function mergeOwnedRoles(
  seededRoles: AppRole[],
  userRole: Doc<"users">["role"],
  discoveredRoles?: Partial<Record<AppRole, boolean>>,
) {
  const roleSet = new Set<AppRole>(seededRoles);

  if (userRole === "instructor" || userRole === "studio") {
    roleSet.add(userRole);
  }
  if (discoveredRoles?.instructor) {
    roleSet.add("instructor");
  }
  if (discoveredRoles?.studio) {
    roleSet.add("studio");
  }

  return (["instructor", "studio"] as const).filter((role) => roleSet.has(role));
}

type UserProfileCtx = QueryCtx | MutationCtx;

async function resolveOwnedRoles(ctx: UserProfileCtx, user: Doc<"users">) {
  const seededRoles = (user.roles ?? []).filter(
    (role): role is AppRole => role === "instructor" || role === "studio",
  );

  const [instructorProfile, studioProfile] = await Promise.all([
    getUniqueInstructorProfileByUserId(ctx, user._id),
    getUniqueStudioProfileByUserId(ctx, user._id),
  ]);

  return mergeOwnedRoles(seededRoles, user.role, {
    instructor: instructorProfile !== null,
    studio: studioProfile !== null,
  });
}

function toCurrentUserPayload(user: Doc<"users">, roles: AppRole[]) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    role: user.role,
    roles,
    onboardingComplete: user.onboardingComplete,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
    }),
  };
}

async function getUniqueInstructorProfileByUserId(
  ctx: UserProfileCtx,
  userId: Doc<"users">["_id"],
) {
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple instructor profiles found for this account");
  }
  return profiles[0] ?? null;
}

async function requireInstructorProfileByUserId(ctx: UserProfileCtx, userId: Doc<"users">["_id"]) {
  const profile = await getUniqueInstructorProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }
  return profile;
}

async function getUniqueStudioProfileByUserId(ctx: UserProfileCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  return profiles[0] ?? null;
}

async function requireStudioProfileByUserId(ctx: UserProfileCtx, userId: Doc<"users">["_id"]) {
  const profile = await getUniqueStudioProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Studio profile not found");
  }
  return profile;
}

export const syncCurrentUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
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
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);

    if (!user || !user.isActive) {
      return null;
    }

    const roles = await resolveOwnedRoles(ctx, user);

    return toCurrentUserPayload(user, roles);
  },
});

export const setMyRole = mutation({
  args: {
    role: v.union(v.literal("instructor"), v.literal("studio")),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
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
  },
});

export const switchActiveRole = mutation({
  args: {
    role: appRoleValidator,
  },
  returns: v.object({
    ok: v.boolean(),
    role: appRoleValidator,
    roles: v.array(appRoleValidator),
  }),
  handler: async (ctx, args) => {
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
  },
});

export const createMyProfileImageUploadSession = mutation({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
    sessionToken: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor", "studio"]);
    const now = Date.now();
    const expiresAt = now + PROFILE_IMAGE_UPLOAD_SESSION_TTL_MS;
    const sessionToken = createUploadSessionToken(user._id, now);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const role = user.role === "studio" ? "studio" : "instructor";

    await ctx.db.insert("profileImageUploadSessions", {
      userId: user._id,
      role,
      token: sessionToken,
      createdAt: now,
      expiresAt,
    });

    return {
      uploadUrl,
      sessionToken,
      expiresAt,
    };
  },
});

export const completeMyProfileImageUpload = mutation({
  args: {
    sessionToken: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.object({
    ok: v.boolean(),
    imageUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor", "studio"]);
    const now = Date.now();

    const session = await ctx.db
      .query("profileImageUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    const role = user.role === "studio" ? "studio" : "instructor";
    if (!session || session.userId !== user._id || session.role !== role) {
      throw new ConvexError("Invalid upload session");
    }
    if (session.consumedAt !== undefined) {
      throw new ConvexError("Upload session has already been used");
    }
    if (session.expiresAt < now) {
      throw new ConvexError("Upload session has expired");
    }

    const uploadedFile = await ctx.storage.getMetadata(args.storageId);
    if (!uploadedFile) {
      throw new ConvexError("Uploaded file was not found");
    }
    const contentType = trimOptionalString(uploadedFile.contentType ?? undefined);
    if (!contentType || !contentType.startsWith("image/")) {
      throw new ConvexError("Only image uploads are allowed");
    }

    let previousStorageId:
      | Doc<"instructorProfiles">["profileImageStorageId"]
      | Doc<"studioProfiles">["logoStorageId"];
    if (user.role === "instructor") {
      const profile = await requireInstructorProfileByUserId(ctx, user._id);
      previousStorageId = profile.profileImageStorageId;
      await ctx.db.patch("instructorProfiles", profile._id, {
        profileImageStorageId: args.storageId,
        updatedAt: now,
      });
    } else {
      const profile = await requireStudioProfileByUserId(ctx, user._id);
      previousStorageId = profile.logoStorageId;
      await ctx.db.patch("studioProfiles", profile._id, {
        logoStorageId: args.storageId,
        updatedAt: now,
      });
    }

    await ctx.db.patch("profileImageUploadSessions", session._id, {
      consumedAt: now,
      storageId: args.storageId,
    });

    if (previousStorageId && previousStorageId !== args.storageId) {
      await ctx.storage.delete(previousStorageId);
    }

    const imageUrl = (await ctx.storage.getUrl(args.storageId)) ?? undefined;
    return {
      ok: true,
      ...omitUndefined({ imageUrl }),
    };
  },
});

export const getMyInstructorSettings = query({
  args: {},
  returns: v.union(
    v.object({
      instructorId: v.id("instructorProfiles"),
      displayName: v.string(),
      bio: v.optional(v.string()),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      hourlyRateExpectation: v.optional(v.number()),
      sports: v.array(v.string()),
      profileImageUrl: v.optional(v.string()),
      socialLinks: v.optional(socialLinksValidator),
      address: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return null;
    }

    const profile = await getUniqueInstructorProfileByUserId(ctx, user._id);
    if (!profile) return null;

    const sportsRows = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();

    const sports = [...new Set(sportsRows.map((row) => row.sport))].sort();
    const profileImageUrl = profile.profileImageStorageId
      ? ((await ctx.storage.getUrl(profile.profileImageStorageId)) ?? undefined)
      : undefined;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      notificationsEnabled: profile.notificationsEnabled,
      hasExpoPushToken: Boolean(profile.expoPushToken),
      sports,
      ...omitUndefined({
        bio: profile.bio,
        hourlyRateExpectation: profile.hourlyRateExpectation,
        profileImageUrl,
        socialLinks: toOptionalSocialLinksPayload(profile.socialLinks),
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude,
      }),
      calendarProvider: profile.calendarProvider ?? "none",
      calendarSyncEnabled: profile.calendarSyncEnabled ?? false,
      ...omitUndefined({ calendarConnectedAt: profile.calendarConnectedAt }),
    };
  },
});

export const updateMyInstructorSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    hourlyRateExpectation: v.optional(v.number()),
    sports: v.array(v.string()),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    includeDetectedZone: v.optional(v.boolean()),
    detectedZone: v.optional(v.string()),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  },
  returns: v.object({
    ok: v.boolean(),
    sportsCount: v.number(),
    notificationsEnabled: v.boolean(),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
    zoneAdded: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);

    const profile = await requireInstructorProfileByUserId(ctx, user._id);

    if (
      args.hourlyRateExpectation !== undefined &&
      (!Number.isFinite(args.hourlyRateExpectation) || args.hourlyRateExpectation <= 0)
    ) {
      throw new ConvexError("hourlyRateExpectation must be greater than 0");
    }

    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];
    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > MAX_SPORTS) {
      throw new ConvexError("Too many sports selected");
    }
    const address = normalizeOptionalString(args.address, MAX_ADDRESS_LENGTH, "Address");
    const { latitude, longitude } = normalizeCoordinates(
      omitUndefined({
        latitude: args.latitude,
        longitude: args.longitude,
      }),
    );
    const detectedZone = args.detectedZone ? normalizeZoneId(args.detectedZone) : undefined;

    const hasExpoPushToken = Boolean(trimOptionalString(profile.expoPushToken));
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;

    const calendarProvider = args.calendarProvider;
    const calendarSyncEnabled = calendarProvider !== "none" && args.calendarSyncEnabled;
    const calendarConnectedAt =
      calendarProvider === "none" ? undefined : (profile.calendarConnectedAt ?? now);

    const [existingSports, existingZones] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
      ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
    ]);

    await Promise.all(existingSports.map((row) => ctx.db.delete("instructorSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("instructorSports", {
          instructorId: profile._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    let zoneAdded = false;
    if (args.includeDetectedZone && detectedZone) {
      const existingZoneSet = new Set(existingZones.map((zoneRow) => zoneRow.zone));
      if (!existingZoneSet.has(detectedZone)) {
        if (existingZoneSet.size >= MAX_ZONES) {
          throw new ConvexError("Too many zones selected");
        }
        await ctx.db.insert("instructorZones", {
          instructorId: profile._id,
          zone: detectedZone,
          createdAt: now,
        });
        zoneAdded = true;
      }
    }

    await ctx.db.patch("instructorProfiles", profile._id, {
      notificationsEnabled,
      ...omitUndefined({
        hourlyRateExpectation: args.hourlyRateExpectation,
        address,
        latitude,
        longitude,
      }),
      calendarProvider,
      calendarSyncEnabled,
      ...(calendarConnectedAt !== undefined ? { calendarConnectedAt } : {}),
      updatedAt: now,
    });

    await rebuildInstructorCoverage(ctx, profile._id);

    return {
      ok: true,
      sportsCount: sports.length,
      notificationsEnabled,
      calendarProvider,
      calendarSyncEnabled,
      zoneAdded,
    };
  },
});

export const updateMyInstructorProfileCard = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    sports: v.array(v.string()),
    socialLinks: v.optional(socialLinksValidator),
  },
  returns: v.object({
    ok: v.boolean(),
    displayName: v.string(),
    sportsCount: v.number(),
    socialLinks: v.optional(socialLinksValidator),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);
    const profile = await requireInstructorProfileByUserId(ctx, user._id);

    const displayName = normalizeRequiredString(
      args.displayName,
      MAX_STUDIO_NAME_LENGTH,
      "Display name",
    );
    const bio = normalizeOptionalString(args.bio, MAX_PROFILE_BIO_LENGTH, "Bio");
    const socialLinks = normalizeSocialLinks(args.socialLinks);
    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];

    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > MAX_SPORTS) {
      throw new ConvexError("Too many sports selected");
    }

    const existingSports = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("instructorSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("instructorSports", {
          instructorId: profile._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch("instructorProfiles", profile._id, {
      displayName,
      bio,
      socialLinks,
      updatedAt: now,
    });

    await rebuildInstructorCoverage(ctx, profile._id);

    return {
      ok: true,
      displayName,
      sportsCount: sports.length,
      ...omitUndefined({
        socialLinks: toOptionalSocialLinksPayload(socialLinks),
      }),
    };
  },
});

export const getMyStudioSettings = query({
  args: {},
  returns: v.union(
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      address: v.string(),
      zone: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      bio: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      profileImageUrl: v.optional(v.string()),
      socialLinks: v.optional(socialLinksValidator),
      autoExpireMinutesBefore: v.number(),
      autoAcceptDefault: v.optional(v.boolean()),
      sports: v.array(v.string()),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "studio") {
      return null;
    }

    const profile = await getUniqueStudioProfileByUserId(ctx, user._id);
    if (!profile) return null;

    const hasExpoPushToken = Boolean(trimOptionalString(profile.expoPushToken));
    const notificationsEnabled = Boolean(profile.notificationsEnabled) && hasExpoPushToken;

    const sportsRows = await ctx.db
      .query("studioSports")
      .withIndex("by_studio_id", (q) => q.eq("studioId", profile._id))
      .collect();
    const sports = [...new Set(sportsRows.map((row) => row.sport))].sort();
    const profileImageUrl = profile.logoStorageId
      ? ((await ctx.storage.getUrl(profile.logoStorageId)) ?? undefined)
      : undefined;

    return {
      studioId: profile._id,
      studioName: profile.studioName,
      address: profile.address,
      zone: profile.zone,
      ...omitUndefined({
        bio: profile.bio,
        latitude: profile.latitude,
        longitude: profile.longitude,
        contactPhone: profile.contactPhone,
        profileImageUrl,
        socialLinks: toOptionalSocialLinksPayload(profile.socialLinks),
      }),
      notificationsEnabled,
      hasExpoPushToken,
      autoExpireMinutesBefore: profile.autoExpireMinutesBefore ?? 30,
      autoAcceptDefault: profile.autoAcceptDefault ?? false,
      sports,
      calendarProvider: profile.calendarProvider ?? "none",
      calendarSyncEnabled: profile.calendarSyncEnabled ?? false,
      ...(profile.calendarConnectedAt !== undefined
        ? { calendarConnectedAt: profile.calendarConnectedAt }
        : {}),
    };
  },
});

export const getStudiosWithLocations = query({
  args: {},
  returns: v.array(
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
      profileImageUrl: v.optional(v.string()),
      sport: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const studios = await ctx.db.query("studioProfiles").collect();

    const studiosWithLocation = await Promise.all(
      studios
        .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number")
        .map(async (studio) => {
          const [logoUrl, sportsRow] = await Promise.all([
            studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
            ctx.db
              .query("studioSports")
              .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
              .first(),
          ]);

          return {
            studioId: studio._id,
            studioName: studio.studioName,
            address: studio.address,
            latitude: studio.latitude as number,
            longitude: studio.longitude as number,
            ...omitUndefined({
              profileImageUrl: logoUrl ?? undefined,
              sport: sportsRow?.sport,
            }),
          };
        }),
    );

    return studiosWithLocation;
  },
});

export const updateMyStudioCalendarSettings = mutation({
  args: {
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  },
  returns: v.object({
    ok: v.boolean(),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const profile = await requireStudioProfileByUserId(ctx, user._id);
    const now = Date.now();

    const calendarProvider = args.calendarProvider;
    const calendarSyncEnabled = calendarProvider !== "none" && args.calendarSyncEnabled;
    const calendarConnectedAt =
      calendarProvider === "none" ? undefined : (profile.calendarConnectedAt ?? now);

    await ctx.db.patch("studioProfiles", profile._id, {
      calendarProvider,
      calendarSyncEnabled,
      ...(calendarConnectedAt !== undefined ? { calendarConnectedAt } : {}),
      updatedAt: now,
    });

    return {
      ok: true,
      calendarProvider,
      calendarSyncEnabled,
    };
  },
});

export const updateMyStudioSettings = mutation({
  args: {
    studioName: v.string(),
    address: v.string(),
    zone: v.string(),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
    sports: v.optional(v.array(v.string())),
  },
  returns: v.object({
    ok: v.boolean(),
    zone: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const profile = await requireStudioProfileByUserId(ctx, user._id);

    const studioName = normalizeRequiredString(
      args.studioName,
      MAX_STUDIO_NAME_LENGTH,
      "Studio name",
    );
    const address = normalizeRequiredString(args.address, MAX_ADDRESS_LENGTH, "Address");
    const zone = normalizeZoneId(args.zone);
    const contactPhone = normalizeOptionalString(
      args.contactPhone,
      MAX_PHONE_LENGTH,
      "Contact phone",
    );
    const { latitude, longitude } = normalizeCoordinates(
      omitUndefined({
        latitude: args.latitude,
        longitude: args.longitude,
      }),
    );

    let autoExpireMinutesBefore: number | undefined;
    if (args.autoExpireMinutesBefore !== undefined) {
      const val = args.autoExpireMinutesBefore;
      if (
        !Number.isFinite(val) ||
        !Number.isInteger(val) ||
        val < 5 ||
        val > 120 ||
        val % 5 !== 0
      ) {
        throw new ConvexError("autoExpireMinutesBefore must be 5\u2013120 in 5-min increments");
      }
      autoExpireMinutesBefore = val;
    }

    await ctx.db.patch("studioProfiles", profile._id, {
      studioName,
      address,
      zone,
      ...omitUndefined({
        contactPhone,
        latitude,
        longitude,
        autoExpireMinutesBefore,
        autoAcceptDefault: args.autoAcceptDefault,
      }),
      updatedAt: Date.now(),
    });

    if (args.sports) {
      const existingSports = await ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", profile._id))
        .collect();
      await Promise.all(existingSports.map((s) => ctx.db.delete("studioSports", s._id)));
      const now = Date.now();
      await Promise.all(
        args.sports.map((sport) =>
          ctx.db.insert("studioSports", {
            studioId: profile._id,
            sport: normalizeSportType(sport),
            createdAt: now,
          }),
        ),
      );
    }

    return {
      ok: true,
      zone,
    };
  },
});

export const updateMyStudioProfileCard = mutation({
  args: {
    studioName: v.string(),
    bio: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    sports: v.array(v.string()),
    socialLinks: v.optional(socialLinksValidator),
  },
  returns: v.object({
    ok: v.boolean(),
    studioName: v.string(),
    sportsCount: v.number(),
    socialLinks: v.optional(socialLinksValidator),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["studio"]);
    const profile = await requireStudioProfileByUserId(ctx, user._id);

    const studioName = normalizeRequiredString(
      args.studioName,
      MAX_STUDIO_NAME_LENGTH,
      "Studio name",
    );
    const bio = normalizeOptionalString(args.bio, MAX_PROFILE_BIO_LENGTH, "Bio");
    const contactPhone = normalizeOptionalString(
      args.contactPhone,
      MAX_PHONE_LENGTH,
      "Contact phone",
    );
    const socialLinks = normalizeSocialLinks(args.socialLinks);
    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];

    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > MAX_SPORTS) {
      throw new ConvexError("Too many sports selected");
    }

    const existingSports = await ctx.db
      .query("studioSports")
      .withIndex("by_studio_id", (q) => q.eq("studioId", profile._id))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("studioSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("studioSports", {
          studioId: profile._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch("studioProfiles", profile._id, {
      studioName,
      bio,
      contactPhone,
      socialLinks,
      updatedAt: now,
    });

    return {
      ok: true,
      studioName,
      sportsCount: sports.length,
      ...omitUndefined({
        socialLinks: toOptionalSocialLinksPayload(socialLinks),
      }),
    };
  },
});

export const getMyStudioNotificationSettings = query({
  args: {},
  returns: v.union(
    v.object({
      studioId: v.id("studioProfiles"),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "studio") {
      return null;
    }

    const profile = await getUniqueStudioProfileByUserId(ctx, user._id);
    if (!profile) {
      return null;
    }

    const hasExpoPushToken = Boolean(trimOptionalString(profile.expoPushToken));
    const notificationsEnabled = Boolean(profile.notificationsEnabled) && hasExpoPushToken;

    return {
      studioId: profile._id,
      notificationsEnabled,
      hasExpoPushToken,
    };
  },
});

export const updateMyStudioNotificationSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    notificationsEnabled: v.boolean(),
    hasExpoPushToken: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["studio"]);
    const profile = await requireStudioProfileByUserId(ctx, user._id);

    const nextPushToken = trimOptionalString(args.expoPushToken) ?? profile.expoPushToken;
    const hasExpoPushToken = Boolean(trimOptionalString(nextPushToken));
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;

    await ctx.db.patch("studioProfiles", profile._id, {
      ...omitUndefined({ expoPushToken: nextPushToken }),
      notificationsEnabled,
      updatedAt: Date.now(),
    });

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
    };
  },
});
