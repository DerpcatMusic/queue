import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rebuildInstructorCoverage } from "./instructorCoverage";

type Ctx = MutationCtx | QueryCtx;

type UserDoc = Doc<"users">;
type InstructorProfileDoc = Doc<"instructorProfiles">;
type StudioProfileDoc = Doc<"studioProfiles">;

export function normalizeEmail(email: string | undefined) {
  if (!email) return undefined;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : undefined;
}

function countDefined(values: unknown[]) {
  return values.filter((value) => value !== undefined && value !== null && value !== "").length;
}

function pickFirstDefined<T>(...values: Array<T | undefined>) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function maxNumber(...values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) return undefined;
  return Math.max(...defined);
}

function selectCanonicalUser(args: {
  users: UserDoc[];
  preferredUserId?: Id<"users"> | null | undefined;
  instructorProfilesByUserId: Map<Id<"users">, InstructorProfileDoc[]>;
  studioProfilesByUserId: Map<Id<"users">, StudioProfileDoc[]>;
}) {
  const { users, preferredUserId, instructorProfilesByUserId, studioProfilesByUserId } = args;
  return [...users].sort((left, right) => {
    const leftScore =
      (left._id === preferredUserId ? 10_000 : 0) +
      (left.role !== "pending" ? 500 : 0) +
      (left.onboardingComplete ? 250 : 0) +
      (left.isActive ? 100 : 0) +
      (left.emailVerificationTime ? 50 : 0) +
      ((instructorProfilesByUserId.get(left._id)?.length ?? 0) > 0 ? 80 : 0) +
      ((studioProfilesByUserId.get(left._id)?.length ?? 0) > 0 ? 80 : 0) +
      countDefined([left.fullName, left.phoneE164, left.image]);
    const rightScore =
      (right._id === preferredUserId ? 10_000 : 0) +
      (right.role !== "pending" ? 500 : 0) +
      (right.onboardingComplete ? 250 : 0) +
      (right.isActive ? 100 : 0) +
      (right.emailVerificationTime ? 50 : 0) +
      ((instructorProfilesByUserId.get(right._id)?.length ?? 0) > 0 ? 80 : 0) +
      ((studioProfilesByUserId.get(right._id)?.length ?? 0) > 0 ? 80 : 0) +
      countDefined([right.fullName, right.phoneE164, right.image]);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left._id.localeCompare(right._id);
  })[0];
}

export async function resolveCanonicalUserByEmail(args: {
  ctx: Ctx;
  normalizedEmail: string;
  preferredUserId?: Id<"users"> | null;
}) {
  const users = (await ((args.ctx.db as any).query("users") as any)
    .withIndex("by_email", (q: any) => q.eq("email", args.normalizedEmail))
    .collect()) as UserDoc[];

  if (users.length === 0) {
    return null;
  }
  if (users.length === 1) {
    return users[0]!._id;
  }

  const userIds = users.map((user) => user._id);
  const [instructorProfilesByUserId, studioProfilesByUserId] = await Promise.all([
    getProfilesByUserIds(args.ctx, "instructorProfiles", userIds),
    getProfilesByUserIds(args.ctx, "studioProfiles", userIds),
  ]);
  const canonicalUser = selectCanonicalUser({
    users,
    preferredUserId: args.preferredUserId,
    instructorProfilesByUserId,
    studioProfilesByUserId,
  });
  return canonicalUser?._id ?? null;
}

function chooseRole(users: UserDoc[], canonicalUser: UserDoc) {
  if (canonicalUser.role !== "pending") {
    return canonicalUser.role;
  }
  const nonPending = users.find((user) => user.role !== "pending");
  return nonPending?.role ?? canonicalUser.role;
}

export function canProceedWithEmailDedupe(args: {
  requireVerifiedUser?: boolean | undefined;
  emailOwnershipVerified?: boolean | undefined;
  users: Array<{
    emailVerificationTime?: number | undefined;
  }>;
}) {
  if (!args.requireVerifiedUser) {
    return true;
  }

  if (args.emailOwnershipVerified) {
    return true;
  }

  return args.users.some((user) => user.emailVerificationTime !== undefined);
}

function hasIncompatibleRoleMix(args: {
  users: UserDoc[];
  instructorProfilesByUserId: Map<Id<"users">, InstructorProfileDoc[]>;
  studioProfilesByUserId: Map<Id<"users">, StudioProfileDoc[]>;
}) {
  const { users, instructorProfilesByUserId, studioProfilesByUserId } = args;
  const hasInstructorProfile = users.some(
    (user) => (instructorProfilesByUserId.get(user._id)?.length ?? 0) > 0,
  );
  const hasStudioProfile = users.some(
    (user) => (studioProfilesByUserId.get(user._id)?.length ?? 0) > 0,
  );
  if (hasInstructorProfile && hasStudioProfile) {
    return true;
  }

  const explicitRoles = new Set(
    users.filter((user) => user.role !== "pending").map((user) => user.role),
  );
  return explicitRoles.has("instructor") && explicitRoles.has("studio");
}

async function getProfilesByUserIds<T extends "instructorProfiles" | "studioProfiles">(
  ctx: Ctx,
  table: T,
  userIds: Id<"users">[],
) {
  const results = await Promise.all(
    userIds.map(
      (userId) =>
        ((ctx.db as any).query(table) as any)
          .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
          .collect() as Promise<Array<Doc<T>>>,
    ),
  );
  const byUserId = new Map<Id<"users">, Array<Doc<T>>>();
  for (let index = 0; index < userIds.length; index += 1) {
    byUserId.set(userIds[index]!, results[index] ?? []);
  }
  return byUserId;
}

async function reassignByIndex(args: {
  ctx: MutationCtx;
  table: string;
  index: string;
  field: string;
  fromId: string;
  toId: string;
}) {
  const rows = await ((args.ctx.db as any).query(args.table) as any)
    .withIndex(args.index, (q: any) => q.eq(args.field, args.fromId))
    .collect();
  await Promise.all(
    rows.map((row: { _id: string }) =>
      (args.ctx.db as any).patch(args.table, row._id, { [args.field]: args.toId }),
    ),
  );
}

async function reassignByCollect(args: {
  ctx: MutationCtx;
  table: string;
  field: string;
  fromId: string;
  toId: string;
}) {
  const rows = await ((args.ctx.db as any).query(args.table) as any).collect();
  await Promise.all(
    rows
      .filter((row: Record<string, unknown>) => row[args.field] === args.fromId)
      .map((row: { _id: string }) =>
        (args.ctx.db as any).patch(args.table, row._id, { [args.field]: args.toId }),
      ),
  );
}

async function mergeInstructorProfiles(args: {
  ctx: MutationCtx;
  canonicalUserId: Id<"users">;
  userIds: Id<"users">[];
  now: number;
}) {
  const profiles = (
    await Promise.all(
      args.userIds.map((userId) =>
        args.ctx.db
          .query("instructorProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .collect(),
      ),
    )
  ).flat();

  if (profiles.length === 0) {
    return;
  }

  const canonicalProfile = [...profiles].sort((left, right) => {
    const leftScore =
      (left.userId === args.canonicalUserId ? 1_000 : 0) +
      (left.diditVerificationStatus === "approved" ? 200 : 0) +
      (left.diditSessionId ? 50 : 0) +
      countDefined([left.bio, left.address, left.expoPushToken, left.hourlyRateExpectation]);
    const rightScore =
      (right.userId === args.canonicalUserId ? 1_000 : 0) +
      (right.diditVerificationStatus === "approved" ? 200 : 0) +
      (right.diditSessionId ? 50 : 0) +
      countDefined([right.bio, right.address, right.expoPushToken, right.hourlyRateExpectation]);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left._id.localeCompare(right._id);
  })[0]!;

  const sports = new Set<string>();
  const zones = new Set<string>();
  for (const profile of profiles) {
    const [profileSports, profileZones] = await Promise.all([
      args.ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
      args.ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
    ]);
    for (const row of profileSports) sports.add(row.sport);
    for (const row of profileZones) zones.add(row.zone);
  }

  await args.ctx.db.patch("instructorProfiles", canonicalProfile._id, {
    userId: args.canonicalUserId,
    displayName:
      pickFirstDefined(
        canonicalProfile.displayName,
        profiles.find((p) => p._id !== canonicalProfile._id)?.displayName,
      ) ?? canonicalProfile.displayName,
    bio: pickFirstDefined(canonicalProfile.bio, ...profiles.map((profile) => profile.bio)),
    socialLinks: pickFirstDefined(
      canonicalProfile.socialLinks,
      ...profiles.map((profile) => profile.socialLinks),
    ),
    address: pickFirstDefined(
      canonicalProfile.address,
      ...profiles.map((profile) => profile.address),
    ),
    latitude: pickFirstDefined(
      canonicalProfile.latitude,
      ...profiles.map((profile) => profile.latitude),
    ),
    longitude: pickFirstDefined(
      canonicalProfile.longitude,
      ...profiles.map((profile) => profile.longitude),
    ),
    expoPushToken: pickFirstDefined(
      canonicalProfile.expoPushToken,
      ...profiles.map((profile) => profile.expoPushToken),
    ),
    notificationsEnabled: profiles.some((profile) => profile.notificationsEnabled),
    profileImageStorageId: pickFirstDefined(
      canonicalProfile.profileImageStorageId,
      ...profiles.map((profile) => profile.profileImageStorageId),
    ),
    hourlyRateExpectation: pickFirstDefined(
      canonicalProfile.hourlyRateExpectation,
      ...profiles.map((profile) => profile.hourlyRateExpectation),
    ),
    calendarProvider: pickFirstDefined(
      canonicalProfile.calendarProvider,
      ...profiles.map((profile) => profile.calendarProvider),
    ),
    calendarSyncEnabled: profiles.some((profile) => profile.calendarSyncEnabled === true),
    calendarConnectedAt: pickFirstDefined(
      canonicalProfile.calendarConnectedAt,
      ...profiles.map((profile) => profile.calendarConnectedAt),
    ),
    diditSessionId: pickFirstDefined(
      canonicalProfile.diditSessionId,
      ...profiles.map((profile) => profile.diditSessionId),
    ),
    diditVerificationStatus: pickFirstDefined(
      profiles.find((profile) => profile.diditVerificationStatus === "approved")
        ?.diditVerificationStatus,
      canonicalProfile.diditVerificationStatus,
      ...profiles.map((profile) => profile.diditVerificationStatus),
    ),
    diditStatusRaw: pickFirstDefined(
      canonicalProfile.diditStatusRaw,
      ...profiles.map((profile) => profile.diditStatusRaw),
    ),
    diditDecision: pickFirstDefined(
      canonicalProfile.diditDecision,
      ...profiles.map((profile) => profile.diditDecision),
    ),
    diditLastEventAt: maxNumber(...profiles.map((profile) => profile.diditLastEventAt)),
    diditVerifiedAt: pickFirstDefined(
      canonicalProfile.diditVerifiedAt,
      ...profiles.map((profile) => profile.diditVerifiedAt),
    ),
    diditLegalFirstName: pickFirstDefined(
      canonicalProfile.diditLegalFirstName,
      ...profiles.map((profile) => profile.diditLegalFirstName),
    ),
    diditLegalMiddleName: pickFirstDefined(
      canonicalProfile.diditLegalMiddleName,
      ...profiles.map((profile) => profile.diditLegalMiddleName),
    ),
    diditLegalLastName: pickFirstDefined(
      canonicalProfile.diditLegalLastName,
      ...profiles.map((profile) => profile.diditLegalLastName),
    ),
    diditLegalName: pickFirstDefined(
      canonicalProfile.diditLegalName,
      ...profiles.map((profile) => profile.diditLegalName),
    ),
    updatedAt: args.now,
  });

  for (const row of await args.ctx.db
    .query("instructorSports")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", canonicalProfile._id))
    .collect()) {
    await args.ctx.db.delete("instructorSports", row._id);
  }
  for (const row of await args.ctx.db
    .query("instructorZones")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", canonicalProfile._id))
    .collect()) {
    await args.ctx.db.delete("instructorZones", row._id);
  }
  for (const row of await args.ctx.db
    .query("instructorCoverage")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", canonicalProfile._id))
    .collect()) {
    await args.ctx.db.delete("instructorCoverage", row._id);
  }

  for (const sport of sports) {
    await args.ctx.db.insert("instructorSports", {
      instructorId: canonicalProfile._id,
      sport,
      createdAt: args.now,
    });
  }
  for (const zone of zones) {
    await args.ctx.db.insert("instructorZones", {
      instructorId: canonicalProfile._id,
      zone,
      createdAt: args.now,
    });
  }

  for (const duplicateProfile of profiles) {
    if (duplicateProfile._id === canonicalProfile._id) {
      continue;
    }
    await Promise.all([
      reassignByIndex({
        ctx: args.ctx,
        table: "calendarIntegrations",
        index: "by_instructor_provider",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "jobs",
        index: "by_filledByInstructor_startTime",
        field: "filledByInstructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "jobApplications",
        index: "by_instructor",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "diditEvents",
        index: "by_instructor",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "notificationLog",
        index: "by_instructor",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payments",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payouts",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "paymentOrders",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payoutSchedules",
        field: "instructorId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
    ]);

    for (const row of await args.ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", duplicateProfile._id))
      .collect()) {
      await args.ctx.db.delete("instructorSports", row._id);
    }
    for (const row of await args.ctx.db
      .query("instructorZones")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", duplicateProfile._id))
      .collect()) {
      await args.ctx.db.delete("instructorZones", row._id);
    }
    for (const row of await args.ctx.db
      .query("instructorCoverage")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", duplicateProfile._id))
      .collect()) {
      await args.ctx.db.delete("instructorCoverage", row._id);
    }
    await args.ctx.db.delete("instructorProfiles", duplicateProfile._id);
  }

  await rebuildInstructorCoverage(args.ctx, canonicalProfile._id);
}

async function mergeStudioProfiles(args: {
  ctx: MutationCtx;
  canonicalUserId: Id<"users">;
  userIds: Id<"users">[];
  now: number;
}) {
  const profiles = (
    await Promise.all(
      args.userIds.map((userId) =>
        args.ctx.db
          .query("studioProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .collect(),
      ),
    )
  ).flat();

  if (profiles.length === 0) {
    return;
  }

  const canonicalProfile = [...profiles].sort((left, right) => {
    const leftScore =
      (left.userId === args.canonicalUserId ? 1_000 : 0) +
      countDefined([left.bio, left.contactPhone, left.expoPushToken, left.logoStorageId]);
    const rightScore =
      (right.userId === args.canonicalUserId ? 1_000 : 0) +
      countDefined([right.bio, right.contactPhone, right.expoPushToken, right.logoStorageId]);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left._id.localeCompare(right._id);
  })[0]!;

  const sports = new Set<string>();
  for (const profile of profiles) {
    const profileSports = await args.ctx.db
      .query("studioSports")
      .withIndex("by_studio_id", (q) => q.eq("studioId", profile._id))
      .collect();
    for (const row of profileSports) sports.add(row.sport);
  }

  await args.ctx.db.patch("studioProfiles", canonicalProfile._id, {
    userId: args.canonicalUserId,
    studioName:
      pickFirstDefined(
        canonicalProfile.studioName,
        ...profiles.map((profile) => profile.studioName),
      ) ?? canonicalProfile.studioName,
    bio: pickFirstDefined(canonicalProfile.bio, ...profiles.map((profile) => profile.bio)),
    socialLinks: pickFirstDefined(
      canonicalProfile.socialLinks,
      ...profiles.map((profile) => profile.socialLinks),
    ),
    address:
      pickFirstDefined(canonicalProfile.address, ...profiles.map((profile) => profile.address)) ??
      canonicalProfile.address,
    zone:
      pickFirstDefined(canonicalProfile.zone, ...profiles.map((profile) => profile.zone)) ??
      canonicalProfile.zone,
    latitude: pickFirstDefined(
      canonicalProfile.latitude,
      ...profiles.map((profile) => profile.latitude),
    ),
    longitude: pickFirstDefined(
      canonicalProfile.longitude,
      ...profiles.map((profile) => profile.longitude),
    ),
    contactPhone: pickFirstDefined(
      canonicalProfile.contactPhone,
      ...profiles.map((profile) => profile.contactPhone),
    ),
    expoPushToken: pickFirstDefined(
      canonicalProfile.expoPushToken,
      ...profiles.map((profile) => profile.expoPushToken),
    ),
    notificationsEnabled: profiles.some((profile) => profile.notificationsEnabled === true),
    logoStorageId: pickFirstDefined(
      canonicalProfile.logoStorageId,
      ...profiles.map((profile) => profile.logoStorageId),
    ),
    autoExpireMinutesBefore: pickFirstDefined(
      canonicalProfile.autoExpireMinutesBefore,
      ...profiles.map((profile) => profile.autoExpireMinutesBefore),
    ),
    calendarProvider: pickFirstDefined(
      canonicalProfile.calendarProvider,
      ...profiles.map((profile) => profile.calendarProvider),
    ),
    calendarSyncEnabled: profiles.some((profile) => profile.calendarSyncEnabled === true),
    calendarConnectedAt: pickFirstDefined(
      canonicalProfile.calendarConnectedAt,
      ...profiles.map((profile) => profile.calendarConnectedAt),
    ),
    updatedAt: args.now,
  });

  for (const row of await args.ctx.db
    .query("studioSports")
    .withIndex("by_studio_id", (q) => q.eq("studioId", canonicalProfile._id))
    .collect()) {
    await args.ctx.db.delete("studioSports", row._id);
  }
  for (const sport of sports) {
    await args.ctx.db.insert("studioSports", {
      studioId: canonicalProfile._id,
      sport,
      createdAt: args.now,
    });
  }

  for (const duplicateProfile of profiles) {
    if (duplicateProfile._id === canonicalProfile._id) {
      continue;
    }

    await Promise.all([
      reassignByCollect({
        ctx: args.ctx,
        table: "calendarIntegrations",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "jobs",
        index: "by_studio",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "jobApplications",
        index: "by_studio",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "jobApplicationStats",
        index: "by_studio",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payments",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payouts",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "paymentOrders",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payoutSchedules",
        field: "studioId",
        fromId: duplicateProfile._id,
        toId: canonicalProfile._id,
      }),
    ]);

    for (const row of await args.ctx.db
      .query("studioSports")
      .withIndex("by_studio_id", (q) => q.eq("studioId", duplicateProfile._id))
      .collect()) {
      await args.ctx.db.delete("studioSports", row._id);
    }
    await args.ctx.db.delete("studioProfiles", duplicateProfile._id);
  }
}

export async function dedupeUsersByEmail(args: {
  ctx: MutationCtx;
  normalizedEmail: string;
  preferredUserId?: Id<"users"> | null;
  now?: number;
  requireVerifiedUser?: boolean;
  emailOwnershipVerified?: boolean;
}) {
  const now = args.now ?? Date.now();
  const users = (await ((args.ctx.db as any).query("users") as any)
    .withIndex("by_email", (q: any) => q.eq("email", args.normalizedEmail))
    .collect()) as UserDoc[];

  if (users.length === 0) {
    return null;
  }
  if (users.length === 1) {
    return users[0]!._id as Id<"users">;
  }

  const userIds = users.map((user: UserDoc) => user._id);
  const [instructorProfilesByUserId, studioProfilesByUserId] = await Promise.all([
    getProfilesByUserIds(args.ctx, "instructorProfiles", userIds),
    getProfilesByUserIds(args.ctx, "studioProfiles", userIds),
  ]);
  if (
    !canProceedWithEmailDedupe({
      requireVerifiedUser: args.requireVerifiedUser,
      emailOwnershipVerified: args.emailOwnershipVerified,
      users,
    })
  ) {
    return null;
  }
  if (hasIncompatibleRoleMix({ users, instructorProfilesByUserId, studioProfilesByUserId })) {
    return null;
  }
  const canonicalUser = selectCanonicalUser({
    users,
    preferredUserId: args.preferredUserId,
    instructorProfilesByUserId,
    studioProfilesByUserId,
  });
  if (!canonicalUser) {
    throw new ConvexError("Unable to resolve canonical account for duplicate email");
  }

  const duplicateUsers = users.filter((user: UserDoc) => user._id !== canonicalUser._id);
  await Promise.all([
    mergeInstructorProfiles({
      ctx: args.ctx,
      canonicalUserId: canonicalUser._id,
      userIds,
      now,
    }),
    mergeStudioProfiles({
      ctx: args.ctx,
      canonicalUserId: canonicalUser._id,
      userIds,
      now,
    }),
  ]);

  for (const duplicateUser of duplicateUsers) {
    await Promise.all([
      reassignByIndex({
        ctx: args.ctx,
        table: "authAccounts",
        index: "userIdAndProvider",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "authSessions",
        index: "userId",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "profileImageUploadSessions",
        index: "by_user",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "calendarIntegrations",
        index: "by_user_provider",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payments",
        index: "by_studio_user",
        field: "studioUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payments",
        index: "by_instructor_user",
        field: "instructorUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payouts",
        index: "by_instructor_user",
        field: "instructorUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payoutDestinations",
        index: "by_user",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payoutDestinationOnboarding",
        index: "by_user",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payoutDestinationEvents",
        index: "by_user",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "paymentOrders",
        index: "by_studio_user",
        field: "studioUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "paymentOrders",
        index: "by_instructor_user",
        field: "instructorUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "ledgerEntries",
        index: "by_instructor_bucket",
        field: "instructorUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payoutReleaseRules",
        index: "by_user",
        field: "userId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "payoutSchedules",
        index: "by_instructor_user",
        field: "instructorUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByIndex({
        ctx: args.ctx,
        table: "userNotifications",
        index: "by_recipient_createdAt",
        field: "recipientUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payouts",
        field: "studioUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "paymentOrders",
        field: "studioUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "ledgerEntries",
        field: "studioUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "payoutSchedules",
        field: "studioUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
      reassignByCollect({
        ctx: args.ctx,
        table: "userNotifications",
        field: "actorUserId",
        fromId: duplicateUser._id,
        toId: canonicalUser._id,
      }),
    ]);

    await args.ctx.db.patch("users", duplicateUser._id, {
      email: undefined,
      emailVerificationTime: undefined,
      isActive: false,
      updatedAt: now,
    });
  }

  await args.ctx.db.patch("users", canonicalUser._id, {
    email: args.normalizedEmail,
    emailVerificationTime: pickFirstDefined(
      canonicalUser.emailVerificationTime,
      ...duplicateUsers.map((user: UserDoc) => user.emailVerificationTime),
    ),
    fullName: pickFirstDefined(
      canonicalUser.fullName,
      canonicalUser.name,
      ...duplicateUsers.map((user: UserDoc) => user.fullName ?? user.name),
    ),
    name: pickFirstDefined(
      canonicalUser.name,
      canonicalUser.fullName,
      ...duplicateUsers.map((user: UserDoc) => user.name ?? user.fullName),
    ),
    phoneE164: pickFirstDefined(
      canonicalUser.phoneE164,
      ...duplicateUsers.map((user: UserDoc) => user.phoneE164),
    ),
    image: pickFirstDefined(
      canonicalUser.image,
      ...duplicateUsers.map((user: UserDoc) => user.image),
    ),
    isAnonymous: duplicateUsers.every((user: UserDoc) => user.isAnonymous === true)
      ? true
      : canonicalUser.isAnonymous,
    isActive: true,
    role: chooseRole(users, canonicalUser),
    onboardingComplete: users.some((user: UserDoc) => user.onboardingComplete),
    updatedAt: now,
  });

  return canonicalUser._id;
}
