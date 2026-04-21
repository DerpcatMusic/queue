import type { Id, MutationCtx } from "../_generated/dataModel";
import {
  countDefined,
  pickFirstDefined,
  reassignByCollect,
  reassignByIndex,
} from "./authDedupeShared";

export async function mergeStudioProfiles(args: {
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
