import { ConvexError } from "convex/values";
import type { Id, MutationCtx } from "../_generated/dataModel";
import { mergeInstructorProfiles } from "./authDedupeInstructorMerge";
import {
  canProceedWithEmailDedupe,
  chooseRole,
  getProfilesByUserIds,
  hasIncompatibleRoleMix,
  pickFirstDefined,
  reassignByCollect,
  reassignByIndex,
  selectCanonicalUser,
} from "./authDedupeShared";
import { mergeStudioProfiles } from "./authDedupeStudioMerge";

type UserDoc = import("../_generated/dataModel").Doc<"users">;

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
        table: "userNotifications",
        index: "by_recipient_createdAt",
        field: "recipientUserId",
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
    isAnonymous:
      users.every((user) => user.isAnonymous) && canonicalUser.isAnonymous
        ? true
        : canonicalUser.isAnonymous,
    role: chooseRole(users, canonicalUser),
    isActive: true,
    updatedAt: now,
  });

  return canonicalUser._id;
}
