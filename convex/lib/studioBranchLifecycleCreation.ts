import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { safeH3Hierarchy } from "./h3";
import { omitUndefined, trimOptionalString } from "./validation";

function slugifyBranchName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized.length > 0 ? normalized : "branch";
}

export function buildDefaultBranchName(studio: Pick<Doc<"studioProfiles">, "studioName">) {
  return trimOptionalString(studio.studioName) ?? "Main branch";
}

export async function resolveUniqueStudioBranchSlug(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
  name: string,
  excludeBranchId?: Id<"studioBranches">,
) {
  const baseSlug = slugifyBranchName(name);
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const existing = await ctx.db
      .query("studioBranches")
      .withIndex("by_studio_slug", (q) => q.eq("studioId", studioId).eq("slug", candidate))
      .unique();
    if (!existing || existing._id === excludeBranchId) {
      return candidate;
    }
  }
  throw new ConvexError("Unable to generate a unique branch slug");
}

export async function createStudioBranch(
  ctx: MutationCtx,
  args: {
    studioId: Id<"studioProfiles">;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    contactPhone?: string;
    expoPushToken?: string;
    notificationsEnabled?: boolean;
    autoExpireMinutesBefore?: number;
    autoAcceptDefault?: boolean;
    calendarProvider?: Doc<"studioBranches">["calendarProvider"];
    calendarSyncEnabled?: boolean;
    calendarConnectedAt?: number;
    isPrimary?: boolean;
    status?: Doc<"studioBranches">["status"];
    now?: number;
  },
) {
  const now = args.now ?? Date.now();
  const slug = await resolveUniqueStudioBranchSlug(ctx, args.studioId, args.name);
  const h3Hierarchy = safeH3Hierarchy(args.latitude, args.longitude);
  const branchId = await ctx.db.insert("studioBranches", {
    studioId: args.studioId,
    name: args.name,
    slug,
    address: args.address,
    isPrimary: args.isPrimary ?? false,
    status: args.status ?? "active",
    createdAt: now,
    updatedAt: now,
    ...omitUndefined({
      latitude: args.latitude,
      longitude: args.longitude,
      h3Index: h3Hierarchy?.h3Index,
      h3Res8: h3Hierarchy?.h3Res8,
      h3Res7: h3Hierarchy?.h3Res7,
      h3Res4: h3Hierarchy?.h3Res4,
      h3Res5: h3Hierarchy?.h3Res5,
      h3Res6: h3Hierarchy?.h3Res6,
      contactPhone: args.contactPhone,
      expoPushToken: args.expoPushToken,
      notificationsEnabled: args.notificationsEnabled,
      autoExpireMinutesBefore: args.autoExpireMinutesBefore,
      autoAcceptDefault: args.autoAcceptDefault,
      calendarProvider: args.calendarProvider,
      calendarSyncEnabled: args.calendarSyncEnabled,
      calendarConnectedAt: args.calendarConnectedAt,
    }),
  });
  const branch = await ctx.db.get(branchId);
  if (!branch) {
    throw new ConvexError("Failed to create studio branch");
  }
  return branch;
}

export async function ensurePrimaryStudioBranch(
  ctx: MutationCtx,
  studio: Pick<
    Doc<"studioProfiles">,
    | "_id"
    | "studioName"
    | "address"
    | "latitude"
    | "longitude"
    | "h3Index"
    | "h3Res8"
    | "h3Res7"
    | "h3Res4"
    | "h3Res5"
    | "h3Res6"
    | "contactPhone"
    | "expoPushToken"
    | "notificationsEnabled"
    | "autoExpireMinutesBefore"
    | "autoAcceptDefault"
    | "calendarProvider"
    | "calendarSyncEnabled"
    | "calendarConnectedAt"
  >,
  now = Date.now(),
) {
  const existing = await ctx.db
    .query("studioBranches")
    .withIndex("by_studio_primary", (q) => q.eq("studioId", studio._id).eq("isPrimary", true))
    .unique();
  if (existing) {
    return existing;
  }
  return await createStudioBranch(ctx, {
    studioId: studio._id,
    name: buildDefaultBranchName(studio),
    address: studio.address,
    isPrimary: true,
    status: "active",
    calendarProvider: studio.calendarProvider ?? "none",
    calendarSyncEnabled: studio.calendarSyncEnabled ?? false,
    now,
    ...omitUndefined({
      latitude: studio.latitude,
      longitude: studio.longitude,
      h3Index: studio.h3Index,
      h3Res8: studio.h3Res8,
      h3Res7: studio.h3Res7,
      h3Res4: studio.h3Res4,
      h3Res5: studio.h3Res5,
      h3Res6: studio.h3Res6,
      contactPhone: studio.contactPhone,
      expoPushToken: studio.expoPushToken,
      notificationsEnabled: studio.notificationsEnabled,
      autoExpireMinutesBefore: studio.autoExpireMinutesBefore,
      autoAcceptDefault: studio.autoAcceptDefault,
      calendarConnectedAt: studio.calendarConnectedAt,
    }),
  });
}
