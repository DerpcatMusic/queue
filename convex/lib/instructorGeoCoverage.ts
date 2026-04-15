import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCompactedCoverageCells, getJobMatchCells, queryJobsByCoverage } from "./h3";
import { normalizeWorkRadiusKm } from "./locationRadius";

export async function rebuildInstructorGeoCoverage(
  ctx: MutationCtx,
  args: {
    instructorId: Id<"instructorProfiles">;
    now?: number;
  },
) {
  const existingRows = await ctx.db
    .query("instructorHexCoverage")
    .withIndex("by_instructor", (q) => q.eq("instructorId", args.instructorId))
    .collect();
  await Promise.all(existingRows.map((row) => ctx.db.delete("instructorHexCoverage", row._id)));

  const profile = await ctx.db.get("instructorProfiles", args.instructorId);
  if (!profile || !Number.isFinite(profile.latitude) || !Number.isFinite(profile.longitude)) {
    return { coverageRowCount: 0 };
  }
  const latitude = profile.latitude as number;
  const longitude = profile.longitude as number;

  const sportRows = await ctx.db
    .query("instructorSports")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", args.instructorId))
    .collect();
  const sports = [...new Set(sportRows.map((row) => row.sport))];
  if (sports.length === 0) {
    return { coverageRowCount: 0 };
  }

  const compactedCells = getCompactedCoverageCells(
    latitude,
    longitude,
    normalizeWorkRadiusKm(profile.workRadiusKm),
  );
  const createdAt = args.now ?? Date.now();

  await Promise.all(
    sports.flatMap((sport) =>
      compactedCells.map((coverage) =>
        ctx.db.insert("instructorHexCoverage", {
          instructorId: args.instructorId,
          sport,
          cell: coverage.cell,
          resolution: coverage.resolution,
          createdAt,
        }),
      ),
    ),
  );

  return {
    coverageRowCount: sports.length * compactedCells.length,
  };
}

export async function listInstructorGeoCoverage(
  ctx: QueryCtx,
  instructorId: Id<"instructorProfiles">,
) {
  return await ctx.db
    .query("instructorHexCoverage")
    .withIndex("by_instructor", (q) => q.eq("instructorId", instructorId))
    .collect();
}

export async function queryAvailableJobsForInstructorCoverage(
  ctx: QueryCtx,
  args: {
    instructorId: Id<"instructorProfiles">;
    status: "open" | "filled" | "cancelled" | "completed";
    limit: number;
  },
) {
  const coverageRows = await listInstructorGeoCoverage(ctx, args.instructorId);
  return await queryJobsByCoverage(ctx, {
    coverageRows,
    status: args.status,
    limit: args.limit,
  });
}

export async function isInstructorEligibleForJobByCoverage(
  ctx: QueryCtx,
  args: {
    instructorId: Id<"instructorProfiles">;
    sport: string;
    jobH3Index: string | undefined;
  },
) {
  if (!args.jobH3Index) return false;

  const coverageRows = await ctx.db
    .query("instructorHexCoverage")
    .withIndex("by_instructor_sport", (q) =>
      q.eq("instructorId", args.instructorId).eq("sport", args.sport),
    )
    .collect();
  if (coverageRows.length === 0) return false;

  const matchCells = new Set(getJobMatchCells(args.jobH3Index).map((row) => row.cell));
  return coverageRows.some((row) => matchCells.has(row.cell));
}
