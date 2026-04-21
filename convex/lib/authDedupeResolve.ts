import type { Id, MutationCtx, QueryCtx } from "../_generated/dataModel";
import { getProfilesByUserIds, normalizeEmail, selectCanonicalUser } from "./authDedupeShared";

type Ctx = MutationCtx | QueryCtx;
type UserDoc = import("../_generated/dataModel").Doc<"users">;

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

export { normalizeEmail };
