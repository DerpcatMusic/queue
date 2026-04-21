import type { Id, MutationCtx } from "../_generated/dataModel";
import { countDefined, maxNumber, pickFirstDefined, reassignByIndex } from "./authDedupeShared";

export async function mergeInstructorProfiles(args: {
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
  for (const profile of profiles) {
    const profileSports = await args.ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();
    for (const row of profileSports) sports.add(row.sport);
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

  for (const sport of sports) {
    await args.ctx.db.insert("instructorSports", {
      instructorId: canonicalProfile._id,
      sport,
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
    ]);

    for (const row of await args.ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", duplicateProfile._id))
      .collect()) {
      await args.ctx.db.delete("instructorSports", row._id);
    }
    await args.ctx.db.delete("instructorProfiles", duplicateProfile._id);
  }
}
