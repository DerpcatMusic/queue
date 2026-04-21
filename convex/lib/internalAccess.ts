import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export const internalAccessRoleValidator = v.literal("tester");

export type InternalAccessRole = "tester";

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

const INTERNAL_TESTER_EMAILS_ENV = "INTERNAL_TESTER_EMAILS";

export function isInternalTesterFeatureEnabled() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv !== "production";
}

export function requireInternalTesterFeatureEnabled() {
  if (!isInternalTesterFeatureEnabled()) {
    throw new ConvexError("Internal tester access is disabled in production");
  }
}

function getEnvInternalTesterEmails() {
  return new Set(
    (process.env[INTERNAL_TESTER_EMAILS_ENV] ?? "")
      .split(",")
      .map((value) => normalizeInternalAccessEmail(value))
      .filter((value): value is string => Boolean(value)),
  );
}

function normalizeGrantedRole(_role: "tester" | undefined): InternalAccessRole {
  return "tester";
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
  if (!isInternalTesterFeatureEnabled()) {
    return {
      verificationBypass: false,
      canManageInternalAccess: false,
      source: "none",
    };
  }

  const normalizedEmail = normalizeInternalAccessEmail(user.email);
  const [grantByUserId, grantByEmail] = await Promise.all([
    getLatestActiveGrantForUserId(ctx, user._id),
    normalizedEmail ? getLatestActiveGrantForEmail(ctx, normalizedEmail) : Promise.resolve(null),
  ]);

  const tableGrant =
    grantByUserId ??
    (grantByEmail && grantByEmail.userId === undefined ? grantByEmail : (grantByEmail ?? null));
  const envTester = normalizedEmail ? getEnvInternalTesterEmails().has(normalizedEmail) : false;

  const role: InternalAccessRole | undefined = envTester || tableGrant ? normalizeGrantedRole(tableGrant?.role) : undefined;
  const canManageInternalAccess = envTester || Boolean(tableGrant);
  const verificationBypass = envTester || canManageInternalAccess || tableGrant?.verificationBypass === true;
  const source: InternalAccessSummary["source"] =
    envTester && tableGrant ? "table+env" : envTester ? "env" : tableGrant ? "table" : "none";

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
