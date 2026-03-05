import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { omitUndefined } from "./validation";

export async function rebuildInstructorCoverage(
  ctx: MutationCtx,
  instructorId: Id<"instructorProfiles">,
): Promise<void> {
  const profile = await ctx.db.get("instructorProfiles", instructorId);
  if (!profile) {
    return;
  }

  const [sports, zones, coverageRows] = await Promise.all([
    ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
    ctx.db
      .query("instructorZones")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
    ctx.db
      .query("instructorCoverage")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
  ]);

  const desiredKeys = new Set<string>();
  for (const sportRow of sports) {
    for (const zoneRow of zones) {
      desiredKeys.add(`${sportRow.sport}::${zoneRow.zone}`);
    }
  }

  const existingByKey = new Map<string, (typeof coverageRows)[number]>();
  for (const row of coverageRows) {
    existingByKey.set(`${row.sport}::${row.zone}`, row);
  }

  const toDelete = coverageRows.filter((row) => !desiredKeys.has(`${row.sport}::${row.zone}`));

  const now = Date.now();
  const toInsert: {
    instructorId: Id<"instructorProfiles">;
    sport: string;
    zone: string;
    notificationsEnabled: boolean;
    expoPushToken?: string;
    updatedAt: number;
  }[] = [];

  for (const key of desiredKeys) {
    if (!existingByKey.has(key)) {
      const [sport, zone] = key.split("::");
      if (sport && zone) {
        toInsert.push({
          instructorId,
          sport,
          zone,
          notificationsEnabled: profile.notificationsEnabled ?? false,
          updatedAt: now,
          ...omitUndefined({ expoPushToken: profile.expoPushToken }),
        });
      }
    }
  }

  const toUpdate = coverageRows.filter((row) => {
    if (!desiredKeys.has(`${row.sport}::${row.zone}`)) return false;
    return (
      row.notificationsEnabled !== (profile.notificationsEnabled ?? false) ||
      row.expoPushToken !== profile.expoPushToken
    );
  });

  await Promise.all([
    ...toDelete.map((row) => ctx.db.delete("instructorCoverage", row._id)),
    ...toInsert.map((row) => ctx.db.insert("instructorCoverage", row)),
    ...toUpdate.map((row) =>
      ctx.db.patch("instructorCoverage", row._id, {
        notificationsEnabled: profile.notificationsEnabled ?? false,
        ...omitUndefined({ expoPushToken: profile.expoPushToken }),
        updatedAt: now,
      }),
    ),
  ]);
}
