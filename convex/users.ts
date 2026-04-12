import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser as getCurrentUserDoc,
  requireCurrentUser,
  requireIdentity,
  requireUserRole,
} from "./lib/auth";
import { resolveBoundaryAssignment } from "./lib/boundaries";
import { normalizeSportType, normalizeZoneId } from "./lib/domainValidation";
import { getWatchZoneCells, safeH3Index } from "./lib/h3";
import { syncInstructorGeospatialCoverage } from "./lib/geospatial";
import { rebuildInstructorCoverage } from "./lib/instructorCoverage";
import { resolveInternalAccessForUser } from "./lib/internalAccess";
import { isStripeIdentityVerified } from "./lib/stripeIdentity";
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  getDefaultNotificationPreferencesForRole,
  getNotificationPreferenceKeysForRole,
  type NotificationPreferenceKey,
} from "./lib/notificationPreferences";
import {
  ensurePrimaryStudioBranch,
  ensureStudioInfrastructure,
  getPrimaryStudioBranch,
  getStudioEntitlement,
  listStudioBranches,
  requireStudioOwnerContext,
  syncStudioProfileFromBranch,
} from "./lib/studioBranches";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "./lib/validation";
import { DEFAULT_WORK_RADIUS_KM, normalizeWorkRadiusKm } from "./lib/locationRadius";

const MAX_SPORTS = 12;
const MAX_ZONES = 25;
const MAX_STUDIO_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 220;
const MAX_PHONE_LENGTH = 20;
const MAX_PROFILE_BIO_LENGTH = 280;
const MAX_SOCIAL_LINK_LENGTH = 220;
const PROFILE_IMAGE_UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;
const LESSON_REMINDER_MINUTES_OPTIONS = [15, 30, 45, 60] as const;
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

function normalizeLessonReminderMinutes(value: number) {
  if (
    !LESSON_REMINDER_MINUTES_OPTIONS.includes(
      value as (typeof LESSON_REMINDER_MINUTES_OPTIONS)[number],
    )
  ) {
    throw new ConvexError("lessonReminderMinutesBefore must be one of 15, 30, 45, or 60");
  }
  return value;
}

const studioBranchSummaryValidator = v.object({
  branchId: v.id("studioBranches"),
  name: v.string(),
  slug: v.string(),
  address: v.string(),
  zone: v.string(),
  isPrimary: v.boolean(),
  status: v.union(v.literal("active"), v.literal("archived")),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  contactPhone: v.optional(v.string()),
  notificationsEnabled: v.optional(v.boolean()),
  lessonReminderMinutesBefore: v.optional(v.number()),
  autoExpireMinutesBefore: v.optional(v.number()),
  autoAcceptDefault: v.optional(v.boolean()),
  calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
  calendarSyncEnabled: v.boolean(),
  calendarConnectedAt: v.optional(v.number()),
});
const studioEntitlementSummaryValidator = v.object({
  planKey: v.union(v.literal("free"), v.literal("growth"), v.literal("custom")),
  maxBranches: v.number(),
  branchesFeatureEnabled: v.boolean(),
  subscriptionStatus: v.union(
    v.literal("active"),
    v.literal("trialing"),
    v.literal("past_due"),
    v.literal("canceled"),
  ),
  activeBranchCount: v.number(),
});
const publicStudioBranchValidator = v.object({
  branchId: v.id("studioBranches"),
  studioId: v.id("studioProfiles"),
  name: v.string(),
  address: v.string(),
  zone: v.string(),
  isPrimary: v.boolean(),
  status: v.union(v.literal("active"), v.literal("archived")),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  contactPhone: v.optional(v.string()),
});

type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
type SocialLinksValue = Partial<Record<SocialLinkKey, string>>;
type AppRole = "instructor" | "studio";

function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : undefined;
}

function normalizeOptionalMapMarkerColor(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return undefined;
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new ConvexError("Map marker color must be a 6-digit hex color");
  }
  return normalized;
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

async function toCurrentUserPayload(ctx: UserProfileCtx, user: Doc<"users">, roles: AppRole[]) {
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
      internalRole: v.optional(v.union(v.literal("tester"), v.literal("admin"))),
      hasVerificationBypass: v.boolean(),
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

    return await toCurrentUserPayload(ctx, user, roles);
  },
});

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
      lessonReminderMinutesBefore: v.number(),
      hourlyRateExpectation: v.optional(v.number()),
      sports: v.array(v.string()),
      profileImageUrl: v.optional(v.string()),
      socialLinks: v.optional(socialLinksValidator),
      address: v.optional(v.string()),
      addressCity: v.optional(v.string()),
      addressStreet: v.optional(v.string()),
      addressNumber: v.optional(v.string()),
      addressFloor: v.optional(v.string()),
      addressPostalCode: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      workRadiusKm: v.optional(v.number()),
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
      lessonReminderMinutesBefore: profile.lessonReminderMinutesBefore ?? 30,
      sports,
      ...omitUndefined({
        bio: profile.bio,
        hourlyRateExpectation: profile.hourlyRateExpectation,
        profileImageUrl,
        socialLinks: toOptionalSocialLinksPayload(profile.socialLinks),
        address: profile.address,
        addressCity: profile.addressCity,
        addressStreet: profile.addressStreet,
        addressNumber: profile.addressNumber,
        addressFloor: profile.addressFloor,
        addressPostalCode: profile.addressPostalCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
      }),
      calendarProvider: profile.calendarProvider ?? "none",
      calendarSyncEnabled: profile.calendarSyncEnabled ?? false,
      workRadiusKm: profile.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM,
      ...omitUndefined({ calendarConnectedAt: profile.calendarConnectedAt }),
    };
  },
});

export const updateMyInstructorSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
    lessonReminderMinutesBefore: v.optional(v.number()),
    hourlyRateExpectation: v.optional(v.number()),
    sports: v.array(v.string()),
    address: v.optional(v.string()),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    workRadiusKm: v.optional(v.number()),
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
    const addressCity = normalizeOptionalString(
      args.addressCity,
      MAX_ADDRESS_LENGTH,
      "AddressCity",
    );
    const addressStreet = normalizeOptionalString(
      args.addressStreet,
      MAX_ADDRESS_LENGTH,
      "AddressStreet",
    );
    const addressNumber = normalizeOptionalString(args.addressNumber, 20, "AddressNumber");
    const addressFloor = normalizeOptionalString(args.addressFloor, 20, "AddressFloor");
    const addressPostalCode = normalizeOptionalString(
      args.addressPostalCode,
      20,
      "AddressPostalCode",
    );
    const workRadiusKm = normalizeWorkRadiusKm(args.workRadiusKm ?? profile.workRadiusKm);
    const { latitude, longitude } = normalizeCoordinates(
      omitUndefined({
        latitude: args.latitude,
        longitude: args.longitude,
      }),
    );
    const detectedZone = args.detectedZone ? normalizeZoneId(args.detectedZone) : undefined;

    const nextPushToken =
      trimOptionalString(args.expoPushToken) ?? trimOptionalString(profile.expoPushToken);
    const nextHasExpoPushToken = Boolean(nextPushToken);
    const notificationsEnabled = args.notificationsEnabled && nextHasExpoPushToken;
    const lessonReminderMinutesBefore =
      args.lessonReminderMinutesBefore !== undefined
        ? normalizeLessonReminderMinutes(args.lessonReminderMinutesBefore)
        : (profile.lessonReminderMinutesBefore ?? 30);

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
      lessonReminderMinutesBefore,
      ...omitUndefined({
        expoPushToken: nextPushToken,
        hourlyRateExpectation: args.hourlyRateExpectation,
        address,
        addressCity,
        addressStreet,
        addressNumber,
        addressFloor,
        addressPostalCode,
        latitude,
        longitude,
        workRadiusKm,
        h3Index: safeH3Index(latitude, longitude),
      }),
      calendarProvider,
      calendarSyncEnabled,
      ...(calendarConnectedAt !== undefined ? { calendarConnectedAt } : {}),
      updatedAt: now,
    });

    await rebuildInstructorCoverage(ctx, profile._id);
    await syncInstructorGeospatialCoverage(ctx, profile._id);

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

export const updateMyInstructorNotificationSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    notificationsEnabled: v.boolean(),
    hasExpoPushToken: v.boolean(),
    lessonReminderMinutesBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);
    const profile = await requireInstructorProfileByUserId(ctx, user._id);

    const nextPushToken =
      trimOptionalString(args.expoPushToken) ?? trimOptionalString(profile.expoPushToken);
    const hasExpoPushToken = Boolean(nextPushToken);
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;
    const lessonReminderMinutesBefore = profile.lessonReminderMinutesBefore ?? 30;

    await ctx.db.patch("instructorProfiles", profile._id, {
      notificationsEnabled,
      ...omitUndefined({
        expoPushToken: nextPushToken,
      }),
      updatedAt: now,
    });

    await rebuildInstructorCoverage(ctx, profile._id);

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore,
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
    await syncInstructorGeospatialCoverage(ctx, profile._id);

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
      addressCity: v.optional(v.string()),
      addressStreet: v.optional(v.string()),
      addressNumber: v.optional(v.string()),
      addressFloor: v.optional(v.string()),
      addressPostalCode: v.optional(v.string()),
      zone: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      bio: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      lessonReminderMinutesBefore: v.number(),
      profileImageUrl: v.optional(v.string()),
      socialLinks: v.optional(socialLinksValidator),
      autoExpireMinutesBefore: v.number(),
      autoAcceptDefault: v.optional(v.boolean()),
      mapMarkerColor: v.optional(v.string()),
      sports: v.array(v.string()),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
      primaryBranch: v.optional(studioBranchSummaryValidator),
      branchesSummary: v.array(
        v.object({
          branchId: v.id("studioBranches"),
          name: v.string(),
          isPrimary: v.boolean(),
          status: v.union(v.literal("active"), v.literal("archived")),
        }),
      ),
      entitlement: studioEntitlementSummaryValidator,
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
    const [primaryBranch, branches, entitlement] = await Promise.all([
      getPrimaryStudioBranch(ctx, profile._id),
      listStudioBranches(ctx, profile._id),
      getStudioEntitlement(ctx, profile._id),
    ]);

    const hasExpoPushToken = Boolean(
      trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken),
    );
    const notificationsEnabled =
      Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled) &&
      hasExpoPushToken;

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
      address: primaryBranch?.address ?? profile.address,
      zone: primaryBranch?.zone ?? profile.zone,
      ...omitUndefined({
        bio: profile.bio,
        latitude: primaryBranch?.latitude ?? profile.latitude,
        longitude: primaryBranch?.longitude ?? profile.longitude,
        contactPhone: primaryBranch?.contactPhone ?? profile.contactPhone,
        profileImageUrl,
        socialLinks: toOptionalSocialLinksPayload(profile.socialLinks),
        mapMarkerColor: profile.mapMarkerColor,
        addressCity: profile.addressCity,
        addressStreet: profile.addressStreet,
        addressNumber: profile.addressNumber,
        addressFloor: profile.addressFloor,
        addressPostalCode: profile.addressPostalCode,
      }),
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore:
        primaryBranch?.lessonReminderMinutesBefore ??
        profile.lessonReminderMinutesBefore ??
        DEFAULT_LESSON_REMINDER_MINUTES,
      autoExpireMinutesBefore:
        primaryBranch?.autoExpireMinutesBefore ?? profile.autoExpireMinutesBefore ?? 30,
      autoAcceptDefault: primaryBranch?.autoAcceptDefault ?? profile.autoAcceptDefault ?? false,
      sports,
      calendarProvider: primaryBranch?.calendarProvider ?? profile.calendarProvider ?? "none",
      calendarSyncEnabled:
        primaryBranch?.calendarSyncEnabled ?? profile.calendarSyncEnabled ?? false,
      ...(primaryBranch?.calendarConnectedAt !== undefined
        ? { calendarConnectedAt: primaryBranch.calendarConnectedAt }
        : profile.calendarConnectedAt !== undefined
          ? { calendarConnectedAt: profile.calendarConnectedAt }
          : {}),
      ...(primaryBranch
        ? {
            primaryBranch: {
              branchId: primaryBranch._id,
              name: primaryBranch.name,
              slug: primaryBranch.slug,
              address: primaryBranch.address,
              zone: primaryBranch.zone,
              isPrimary: primaryBranch.isPrimary,
              status: primaryBranch.status,
              calendarProvider: primaryBranch.calendarProvider ?? "none",
              calendarSyncEnabled: primaryBranch.calendarSyncEnabled ?? false,
              ...omitUndefined({
                latitude: primaryBranch.latitude,
                longitude: primaryBranch.longitude,
                contactPhone: primaryBranch.contactPhone,
                notificationsEnabled: primaryBranch.notificationsEnabled,
                lessonReminderMinutesBefore: primaryBranch.lessonReminderMinutesBefore,
                autoExpireMinutesBefore: primaryBranch.autoExpireMinutesBefore,
                autoAcceptDefault: primaryBranch.autoAcceptDefault,
                calendarConnectedAt: primaryBranch.calendarConnectedAt,
              }),
            },
          }
        : {}),
      branchesSummary: branches.map((branch) => ({
        branchId: branch._id,
        name: branch.name,
        isPrimary: branch.isPrimary,
        status: branch.status,
      })),
      entitlement: {
        planKey: entitlement?.planKey ?? "free",
        maxBranches: entitlement?.maxBranches ?? 1,
        branchesFeatureEnabled: entitlement?.branchesFeatureEnabled ?? false,
        subscriptionStatus: entitlement?.subscriptionStatus ?? "active",
        activeBranchCount: branches.filter((branch) => branch.status === "active").length,
      },
    };
  },
});

export const getInstructorMapStudios = query({
  args: {
    workRadiusKm: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      zone: v.string(),
      latitude: v.number(),
      longitude: v.number(),
      address: v.optional(v.string()),
      logoImageUrl: v.optional(v.string()),
      mapMarkerColor: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return [];
    }

    const instructor = await requireInstructorProfileByUserId(ctx, user._id);
    if (!instructor) {
      return [];
    }

    const hasLocation =
      Number.isFinite(instructor.latitude) &&
      Number.isFinite(instructor.longitude);

    if (!hasLocation) return [];

    const workRadiusKm = normalizeWorkRadiusKm(
      args.workRadiusKm ?? instructor.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM,
    );
    const hexCells = getWatchZoneCells(
      instructor.latitude!,
      instructor.longitude!,
      workRadiusKm,
    );

    // Query studioBranches by h3Index for each cell
    const branchByStudioId = new Map<string, Doc<"studioBranches">>();
    const CHUNK_SIZE = 200;
    for (let i = 0; i < hexCells.length; i += CHUNK_SIZE) {
      const chunk = hexCells.slice(i, i + CHUNK_SIZE);
      const branchesByCell = await Promise.all(
        chunk.map((hex) =>
          ctx.db
            .query("studioBranches")
            .withIndex("by_h3_index", (q) => q.eq("h3Index", hex))
            .collect()
        )
      );
      for (const branches of branchesByCell) {
        for (const branch of branches) {
          if (!branchByStudioId.has(String(branch.studioId))) {
            branchByStudioId.set(String(branch.studioId), branch);
          }
        }
      }
    }

    if (branchByStudioId.size === 0) return [];

    const studioIds = [...branchByStudioId.keys()];
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId as Id<"studioProfiles">)),
    );
    const logoUrls = await Promise.all(
      studios.map((studio) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );

    return studios
      .map((studio, index) => {
        if (!studio) return null;
        const branch = branchByStudioId.get(String(studio._id));
        if (!branch || branch.latitude === undefined || branch.longitude === undefined) return null;
        return {
          studioId: studio._id,
          studioName: studio.studioName,
          zone: branch.zone ?? studio.zone ?? "",
          latitude: branch.latitude!,
          longitude: branch.longitude!,
          ...omitUndefined({
            address: branch.address,
            logoImageUrl: logoUrls[index] ?? undefined,
            mapMarkerColor: studio.mapMarkerColor,
          }),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  },
});

export const getStudioPublicProfileForInstructor = query({
  args: {
    studioId: v.id("studioProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      address: v.string(),
      zone: v.string(),
      bio: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      mapMarkerColor: v.optional(v.string()),
      sports: v.array(v.string()),
      branches: v.array(publicStudioBranchValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return null;
    }

    const studio = await ctx.db.get(args.studioId);
    if (!studio) {
      return null;
    }

    const [sportsRows, branches, profileImageUrl, primaryBranch] = await Promise.all([
      ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", args.studioId))
        .collect(),
      listStudioBranches(ctx, args.studioId, "active"),
      studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      getPrimaryStudioBranch(ctx, args.studioId),
    ]);

    return {
      studioId: studio._id,
      studioName: studio.studioName,
      address: primaryBranch?.address ?? studio.address,
      zone: primaryBranch?.zone ?? studio.zone,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      branches: branches.map((branch) => ({
        branchId: branch._id,
        studioId: branch.studioId,
        name: branch.name,
        address: branch.address,
        zone: branch.zone,
        isPrimary: branch.isPrimary,
        status: branch.status,
        ...omitUndefined({
          latitude: branch.latitude,
          longitude: branch.longitude,
          contactPhone: branch.contactPhone,
        }),
      })),
      ...omitUndefined({
        bio: studio.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        contactPhone: primaryBranch?.contactPhone ?? studio.contactPhone,
        mapMarkerColor: studio.mapMarkerColor,
      }),
    };
  },
});

export const getInstructorPublicProfileBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!profile) {
      return null;
    }

    const [sportsRows, zoneRows, profileImageUrl, stripeAccounts] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
      ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
      profile.profileImageStorageId ? ctx.storage.getUrl(profile.profileImageStorageId) : null,
      ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .order("desc")
        .take(10),
    ]);
    const stripeAccount = stripeAccounts.find((account) => account.provider === "stripe") ?? null;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      zones: [...new Set(zoneRows.map((row) => row.zone))].sort(),
      isVerified: isStripeIdentityVerified(stripeAccount),
      slug: profile.slug,
      ...omitUndefined({
        bio: profile.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        hourlyRateExpectation: profile.hourlyRateExpectation,
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
    if (!profile || !profile.slug) {
      return null;
    }
    return { slug: profile.slug };
  },
});

/**
 * Public query: get studio profile redirect info by ULID.
 * Returns { slug } if found so old /profiles/studios/[ulid] URLs
 * can redirect to the new /studio/[slug] URL.
 */
export const getStudioProfileRedirect = query({
  args: {
    studioId: v.id("studioProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const studio = await ctx.db.get(args.studioId);
    if (!studio || !studio.slug) {
      return null;
    }
    return { slug: studio.slug };
  },
});

export const getStudioPublicProfileBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const studio = await ctx.db
      .query("studioProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!studio) {
      return null;
    }

    const [sportsRows, branches, profileImageUrl, primaryBranch] = await Promise.all([
      ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
        .collect(),
      ctx.db
        .query("studioBranches")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
        .collect(),
      studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ctx.db
        .query("studioBranches")
        .withIndex("by_studio_primary", (q) => q.eq("studioId", studio._id).eq("isPrimary", true))
        .first(),
    ]);

    return {
      studioId: studio._id,
      studioName: studio.studioName,
      address: primaryBranch?.address ?? studio.address,
      zone: primaryBranch?.zone ?? studio.zone,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      branches: branches.map((branch) => ({
        branchId: branch._id,
        studioId: branch.studioId,
        name: branch.name,
        address: branch.address,
        zone: branch.zone,
        isPrimary: branch.isPrimary,
        status: branch.status,
        ...omitUndefined({
          latitude: branch.latitude,
          longitude: branch.longitude,
          contactPhone: branch.contactPhone,
        }),
      })),
      slug: studio.slug,
      isVerified: studio.diditVerificationStatus === "approved",
      ...omitUndefined({
        bio: studio.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        contactPhone: primaryBranch?.contactPhone ?? studio.contactPhone,
      }),
    };
  },
});

export const getInstructorPublicProfileForInstructor = query({
  args: {
    instructorId: v.id("instructorProfiles"),
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
      zones: v.array(v.string()),
      isVerified: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return null;
    }

    const profile = await ctx.db.get(args.instructorId);
    if (!profile) {
      return null;
    }

    const [sportsRows, zoneRows, profileImageUrl, stripeAccounts] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", args.instructorId))
        .collect(),
      ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", args.instructorId))
        .collect(),
      profile.profileImageStorageId ? ctx.storage.getUrl(profile.profileImageStorageId) : null,
      ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .order("desc")
        .take(10),
    ]);
    const stripeAccount = stripeAccounts.find((account) => account.provider === "stripe") ?? null;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      zones: [...new Set(zoneRows.map((row) => row.zone))].sort(),
      isVerified: isStripeIdentityVerified(stripeAccount),
      ...omitUndefined({
        bio: profile.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        hourlyRateExpectation: profile.hourlyRateExpectation,
      }),
    };
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
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const branch = await ensurePrimaryStudioBranch(ctx, studio, now);

    const calendarProvider = args.calendarProvider;
    const calendarSyncEnabled = calendarProvider !== "none" && args.calendarSyncEnabled;
    const calendarConnectedAt =
      calendarProvider === "none" ? undefined : (branch.calendarConnectedAt ?? now);

    await ctx.db.patch("studioBranches", branch._id, {
      calendarProvider,
      calendarSyncEnabled,
      ...(calendarConnectedAt !== undefined ? { calendarConnectedAt } : {}),
      updatedAt: now,
    });
    const updatedBranch = await ctx.db.get(branch._id);
    if (updatedBranch) {
      await syncStudioProfileFromBranch(ctx, studio._id, updatedBranch, now);
    }

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
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    zone: v.string(),
    boundaryProvider: v.optional(v.string()),
    boundaryId: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
    mapMarkerColor: v.optional(v.string()),
    sports: v.optional(v.array(v.string())),
  },
  returns: v.object({
    ok: v.boolean(),
    zone: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

    const studioName = normalizeRequiredString(
      args.studioName,
      MAX_STUDIO_NAME_LENGTH,
      "Studio name",
    );
    const address = normalizeRequiredString(args.address, MAX_ADDRESS_LENGTH, "Address");
    const addressCity = normalizeOptionalString(
      args.addressCity,
      MAX_ADDRESS_LENGTH,
      "AddressCity",
    );
    const addressStreet = normalizeOptionalString(
      args.addressStreet,
      MAX_ADDRESS_LENGTH,
      "AddressStreet",
    );
    const addressNumber = normalizeOptionalString(args.addressNumber, 20, "AddressNumber");
    const addressFloor = normalizeOptionalString(args.addressFloor, 20, "AddressFloor");
    const addressPostalCode = normalizeOptionalString(
      args.addressPostalCode,
      20,
      "AddressPostalCode",
    );
    const zone = normalizeZoneId(args.zone);
    const boundaryAssignment = resolveBoundaryAssignment(
      omitUndefined({
        provider: args.boundaryProvider,
        boundaryId: args.boundaryId,
        legacyZone: zone,
      }),
    );
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
    const mapMarkerColor = normalizeOptionalMapMarkerColor(args.mapMarkerColor);

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

    await ctx.db.patch("studioProfiles", studio._id, {
      studioName,
      address,
      zone,
      ...boundaryAssignment,
      ...omitUndefined({
        contactPhone,
        latitude,
        longitude,
        mapMarkerColor,
        autoExpireMinutesBefore,
        autoAcceptDefault: args.autoAcceptDefault,
        addressCity,
        addressStreet,
        addressNumber,
        addressFloor,
        addressPostalCode,
        h3Index: safeH3Index(latitude, longitude),
      }),
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      address,
      zone,
      ...boundaryAssignment,
      ...omitUndefined({
        contactPhone,
        latitude,
        longitude,
        autoExpireMinutesBefore,
        autoAcceptDefault: args.autoAcceptDefault,
        h3Index: safeH3Index(latitude, longitude),
      }),
      updatedAt: now,
    });

    if (args.sports) {
      const existingSports = await ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
        .collect();
      await Promise.all(existingSports.map((s) => ctx.db.delete("studioSports", s._id)));
      await Promise.all(
        args.sports.map((sport) =>
          ctx.db.insert("studioSports", {
            studioId: studio._id,
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
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

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
      .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("studioSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("studioSports", {
          studioId: studio._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch("studioProfiles", studio._id, {
      studioName,
      bio,
      contactPhone,
      socialLinks,
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      contactPhone,
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
      lessonReminderMinutesBefore: v.number(),
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
    const primaryBranch = await getPrimaryStudioBranch(ctx, profile._id);

    const hasExpoPushToken = Boolean(
      trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken),
    );
    const notificationsEnabled =
      Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled) &&
      hasExpoPushToken;

    return {
      studioId: profile._id,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore: 30,
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
    lessonReminderMinutesBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

    const nextPushToken = trimOptionalString(args.expoPushToken) ?? primaryBranch.expoPushToken;
    const hasExpoPushToken = Boolean(trimOptionalString(nextPushToken));
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;

    await ctx.db.patch("studioProfiles", studio._id, {
      ...omitUndefined({ expoPushToken: nextPushToken }),
      notificationsEnabled,
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      ...omitUndefined({ expoPushToken: nextPushToken }),
      notificationsEnabled,
      updatedAt: now,
    });

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore: 30,
    };
  },
});

export const getMyNotificationSettings = query({
  args: {},
  returns: v.union(
    v.object({
      role: appRoleValidator,
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      lessonReminderMinutesBefore: v.number(),
      availablePreferenceKeys: v.array(
        v.union(
          v.literal("job_offer"),
          v.literal("insurance_renewal"),
          v.literal("application_received"),
          v.literal("application_updates"),
          v.literal("lesson_reminder"),
          v.literal("lesson_updates"),
        ),
      ),
      preferences: v.object({
        job_offer: v.boolean(),
        insurance_renewal: v.boolean(),
        application_received: v.boolean(),
        application_updates: v.boolean(),
        lesson_reminder: v.boolean(),
        lesson_updates: v.boolean(),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || (user.role !== "instructor" && user.role !== "studio")) {
      return null;
    }

    const preferenceDefaults = getDefaultNotificationPreferencesForRole(user.role);
    const preferenceRows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of preferenceRows) {
      preferenceDefaults[row.key] = row.enabled;
    }

    if (user.role === "instructor") {
      const profile = await getUniqueInstructorProfileByUserId(ctx, user._id);
      if (!profile) {
        return null;
      }
      const hasExpoPushToken = Boolean(trimOptionalString(profile.expoPushToken));
      return {
        role: "instructor" as const,
        notificationsEnabled: profile.notificationsEnabled && hasExpoPushToken,
        hasExpoPushToken,
        lessonReminderMinutesBefore:
          profile.lessonReminderMinutesBefore ?? DEFAULT_LESSON_REMINDER_MINUTES,
        availablePreferenceKeys: [...getNotificationPreferenceKeysForRole("instructor")],
        preferences: preferenceDefaults,
      };
    }

    const profile = await getUniqueStudioProfileByUserId(ctx, user._id);
    if (!profile) {
      return null;
    }
    const primaryBranch = await getPrimaryStudioBranch(ctx, profile._id);
    const pushToken = trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken);
    const hasExpoPushToken = Boolean(pushToken);
    return {
      role: "studio" as const,
      notificationsEnabled:
        Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled) &&
        hasExpoPushToken,
      hasExpoPushToken,
      lessonReminderMinutesBefore:
        primaryBranch?.lessonReminderMinutesBefore ??
        profile.lessonReminderMinutesBefore ??
        DEFAULT_LESSON_REMINDER_MINUTES,
      availablePreferenceKeys: [...getNotificationPreferenceKeysForRole("studio")],
      preferences: preferenceDefaults,
    };
  },
});

export const updateMyNotificationSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
    lessonReminderMinutesBefore: v.optional(v.number()),
    preferenceUpdates: v.optional(
      v.array(
        v.object({
          key: v.union(
            v.literal("job_offer"),
            v.literal("insurance_renewal"),
            v.literal("application_received"),
            v.literal("application_updates"),
            v.literal("lesson_reminder"),
            v.literal("lesson_updates"),
          ),
          enabled: v.boolean(),
        }),
      ),
    ),
  },
  returns: v.object({
    ok: v.boolean(),
    notificationsEnabled: v.boolean(),
    hasExpoPushToken: v.boolean(),
    lessonReminderMinutesBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireCurrentUser(ctx);
    if (user.role !== "instructor" && user.role !== "studio") {
      throw new ConvexError("Notification settings are unavailable for this user");
    }

    const allowedKeys = new Set<NotificationPreferenceKey>(
      getNotificationPreferenceKeysForRole(user.role),
    );
    for (const row of args.preferenceUpdates ?? []) {
      if (!allowedKeys.has(row.key)) {
        throw new ConvexError(
          `Notification preference ${row.key} is not available for ${user.role}`,
        );
      }
    }

    const lessonReminderMinutesBefore =
      args.lessonReminderMinutesBefore !== undefined
        ? normalizeLessonReminderMinutes(args.lessonReminderMinutesBefore)
        : undefined;

    if (user.role === "instructor") {
      const profile = await requireInstructorProfileByUserId(ctx, user._id);
      const nextPushToken =
        trimOptionalString(args.expoPushToken) ?? trimOptionalString(profile.expoPushToken);
      const hasExpoPushToken = Boolean(nextPushToken);
      const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;
      await ctx.db.patch("instructorProfiles", profile._id, {
        notificationsEnabled,
        ...(lessonReminderMinutesBefore !== undefined ? { lessonReminderMinutesBefore } : {}),
        ...omitUndefined({ expoPushToken: nextPushToken }),
        updatedAt: now,
      });
      await rebuildInstructorCoverage(ctx, profile._id);

      for (const row of args.preferenceUpdates ?? []) {
        const existing = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user_key", (q) => q.eq("userId", user._id).eq("key", row.key))
          .unique();
        if (existing) {
          await ctx.db.patch(existing._id, {
            enabled: row.enabled,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("notificationPreferences", {
            userId: user._id,
            key: row.key,
            enabled: row.enabled,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return {
        ok: true,
        notificationsEnabled,
        hasExpoPushToken,
        lessonReminderMinutesBefore:
          lessonReminderMinutesBefore ??
          profile.lessonReminderMinutesBefore ??
          DEFAULT_LESSON_REMINDER_MINUTES,
      };
    }

    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);
    const nextPushToken =
      trimOptionalString(args.expoPushToken) ??
      trimOptionalString(primaryBranch.expoPushToken ?? studio.expoPushToken);
    const hasExpoPushToken = Boolean(nextPushToken);
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;
    const nextLessonReminderMinutes =
      lessonReminderMinutesBefore ??
      primaryBranch.lessonReminderMinutesBefore ??
      studio.lessonReminderMinutesBefore ??
      DEFAULT_LESSON_REMINDER_MINUTES;

    await ctx.db.patch("studioProfiles", studio._id, {
      notificationsEnabled,
      lessonReminderMinutesBefore: nextLessonReminderMinutes,
      ...omitUndefined({ expoPushToken: nextPushToken }),
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      notificationsEnabled,
      lessonReminderMinutesBefore: nextLessonReminderMinutes,
      ...omitUndefined({ expoPushToken: nextPushToken }),
      updatedAt: now,
    });

    for (const row of args.preferenceUpdates ?? []) {
      const existing = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_key", (q) => q.eq("userId", user._id).eq("key", row.key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          enabled: row.enabled,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("notificationPreferences", {
          userId: user._id,
          key: row.key,
          enabled: row.enabled,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore: nextLessonReminderMinutes,
    };
  },
});

export const touchMyNotificationClientState = mutation({
  args: {
    localReminderCoverageUntil: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();

    await ctx.db.patch("users", user._id, {
      notificationClientLastSeenAt: now,
      ...omitUndefined({
        notificationLocalRemindersCoverageUntil: args.localReminderCoverageUntil,
      }),
      updatedAt: now,
    });

    return { ok: true };
  },
});
