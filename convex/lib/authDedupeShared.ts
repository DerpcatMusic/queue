import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = MutationCtx | QueryCtx;
type UserDoc = Doc<"users">;
type InstructorProfileDoc = Doc<"instructorProfiles">;
type StudioProfileDoc = Doc<"studioProfiles">;

export function normalizeEmail(email: string | undefined) {
  if (!email) return undefined;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : undefined;
}

export function countDefined(values: unknown[]) {
  return values.filter((value) => value !== undefined && value !== null && value !== "").length;
}

export function pickFirstDefined<T>(...values: Array<T | undefined>) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function maxNumber(...values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) return undefined;
  return Math.max(...defined);
}

export function chooseRole(users: UserDoc[], canonicalUser: UserDoc) {
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

export function hasIncompatibleRoleMix(args: {
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

export async function getProfilesByUserIds<T extends "instructorProfiles" | "studioProfiles">(
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

export async function reassignByIndex(args: {
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

export async function reassignByCollect(args: {
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

export function selectCanonicalUser(args: {
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
