import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ensurePrimaryStudioBranch } from "./studioBranchLifecycleCreation";
import { ensureStudioEntitlement } from "./studioBranchLifecycleEntitlements";
import { ensureStudioOwnerMembership } from "./studioBranchLifecycleOwnership";
import { omitUndefined } from "./validation";

export async function ensureStudioInfrastructure(
  ctx: MutationCtx,
  studio: Pick<
    Doc<"studioProfiles">,
    | "_id"
    | "userId"
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
  const [branch, membership, entitlement] = await Promise.all([
    ensurePrimaryStudioBranch(ctx, studio, now),
    ensureStudioOwnerMembership(ctx, studio, now),
    ensureStudioEntitlement(ctx, studio._id, now),
  ]);
  return { branch, membership, entitlement };
}

export async function syncStudioProfileFromBranch(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
  branch: Pick<
    Doc<"studioBranches">,
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
  await ctx.db.patch(studioId, {
    address: branch.address,
    updatedAt: now,
    ...omitUndefined({
      latitude: branch.latitude,
      longitude: branch.longitude,
      h3Index: branch.h3Index,
      h3Res8: branch.h3Res8,
      h3Res7: branch.h3Res7,
      h3Res4: branch.h3Res4,
      h3Res5: branch.h3Res5,
      h3Res6: branch.h3Res6,
      contactPhone: branch.contactPhone,
      expoPushToken: branch.expoPushToken,
      notificationsEnabled: branch.notificationsEnabled,
      autoExpireMinutesBefore: branch.autoExpireMinutesBefore,
      autoAcceptDefault: branch.autoAcceptDefault,
      calendarProvider: branch.calendarProvider,
      calendarSyncEnabled: branch.calendarSyncEnabled,
      calendarConnectedAt: branch.calendarConnectedAt,
    }),
  });
}
