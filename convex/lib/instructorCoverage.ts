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

  await Promise.all(
    coverageRows.map((row) => ctx.db.delete("instructorCoverage", row._id)),
  );

  if (sports.length === 0 || zones.length === 0) {
    return;
  }

  const now = Date.now();
  const seen = new Set<string>();

  const rowsToInsert: {
    instructorId: Id<"instructorProfiles">;
    sport: string;
    zone: string;
    notificationsEnabled: boolean;
    expoPushToken?: string;
    updatedAt: number;
  }[] = [];

  for (const sportRow of sports) {
    for (const zoneRow of zones) {
      const key = `${sportRow.sport}::${zoneRow.zone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rowsToInsert.push({
        instructorId,
        sport: sportRow.sport,
        zone: zoneRow.zone,
        notificationsEnabled: profile.notificationsEnabled ?? false,
        updatedAt: now,
        ...omitUndefined({ expoPushToken: profile.expoPushToken }),
      });
    }
  }

  await Promise.all(
    rowsToInsert.map((row) => ctx.db.insert("instructorCoverage", row)),
  );
}
