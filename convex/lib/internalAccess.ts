import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export const internalAccessRoleValidator = v.union(v.literal("tester"), v.literal("admin"));

export type InternalAccessRole = "tester" | "admin";

export type InternalAccessSummary = {
  role?: InternalAccessRole;
  verificationBypass: boolean;
  canManageInternalAccess: boolean;
  source: "none" | "table" | "env" | "table+env";
};

export function normalizeInternalAccessEmail(email: string | undefined): string | undefined {
  if (!email) {
    return undefined;
  }
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function getEnvInternalAdminEmails() {
  return new Set(
    (process.env.INTERNAL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => normalizeInternalAccessEmail(value))
      .filter((value): value is string => Boolean(value)),
  );
}

async function getLatestActiveGrantForUserId(ctx: Ctx, userId: Doc<"users">["_id"]) {
  return await ctx.db
    .query("internalAccessGrants")
    .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("active", true))
    .order("desc")
    .first();
}

async function getLatestActiveGrantForEmail(ctx: Ctx, email: string) {
  return await ctx.db
    .query("internalAccessGrants")
    .withIndex("by_email_active", (q) => q.eq("email", email).eq("active", true))
    .order("desc")
    .first();
}

export async function resolveInternalAccessForUser(
  ctx: Ctx,
  user: Pick<Doc<"users">, "_id" | "email">,
): Promise<InternalAccessSummary> {
  const normalizedEmail = normalizeInternalAccessEmail(user.email);
  const [grantByUserId, grantByEmail] = await Promise.all([
    getLatestActiveGrantForUserId(ctx, user._id),
    normalizedEmail ? getLatestActiveGrantForEmail(ctx, normalizedEmail) : Promise.resolve(null),
  ]);

  const tableGrant =
    grantByUserId ??
    (grantByEmail && grantByEmail.userId === undefined ? grantByEmail : grantByEmail ?? null);
  const envAdmin = normalizedEmail ? getEnvInternalAdminEmails().has(normalizedEmail) : false;

  const role: InternalAccessRole | undefined = envAdmin ? "admin" : tableGrant?.role;
  const verificationBypass = envAdmin || tableGrant?.verificationBypass === true;
  const canManageInternalAccess = envAdmin || tableGrant?.role === "admin";
  const source: InternalAccessSummary["source"] =
    envAdmin && tableGrant
      ? "table+env"
      : envAdmin
        ? "env"
        : tableGrant
          ? "table"
          : "none";

  return {
    verificationBypass,
    canManageInternalAccess,
    source,
    ...(role ? { role } : {}),
  };
}

export async function resolveInternalAccessForUserId(
  ctx: Ctx,
  userId: Doc<"users">["_id"],
): Promise<InternalAccessSummary> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return {
      verificationBypass: false,
      canManageInternalAccess: false,
      source: "none",
    };
  }
  return await resolveInternalAccessForUser(ctx, user);
}

export function assertSingleInternalAccessTarget(args: {
  userId?: Doc<"users">["_id"];
  email?: string;
}) {
  if (!args.userId && !args.email) {
    throw new ConvexError("Provide either userId or email");
  }
  if (args.userId && args.email) {
    throw new ConvexError("Provide either userId or email, not both");
  }
}
