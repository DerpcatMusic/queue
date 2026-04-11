import { geospatial } from "../components";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeWorkRadiusKm } from "./locationRadius";

type Ctx = QueryCtx | MutationCtx;

function toPoint(latitude: number | undefined, longitude: number | undefined) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    latitude: latitude!,
    longitude: longitude!,
  };
}

export function getInstructorGeoKey(
  instructorId: Id<"instructorProfiles">,
  sport: string,
) {
  return `instructor:${String(instructorId)}:${sport}`;
}

export function getStudioBranchGeoKey(branchId: Id<"studioBranches">) {
  return `branch:${String(branchId)}`;
}

export async function syncInstructorGeospatialCoverage(
  ctx: MutationCtx,
  instructorId: Id<"instructorProfiles">,
) {
  const profile = await ctx.db.get("instructorProfiles", instructorId);
  if (!profile) {
    return;
  }

  const [sportRows, existingRows] = await Promise.all([
    ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
    ctx.db
      .query("instructorGeoCoverage")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
  ]);

  const point = toPoint(profile.latitude, profile.longitude);
  const workRadiusKm = profile.workRadiusKm;
  const hasLocation = point !== null && workRadiusKm !== undefined;

  const desiredSports = new Set(sportRows.map((row) => row.sport));
  const existingBySport = new Map(existingRows.map((row) => [row.sport, row]));
  const now = Date.now();

  if (!hasLocation) {
    await Promise.all(
      existingRows.map(async (row) => {
        await geospatial.remove(ctx, row.geospatialKey);
        await ctx.db.delete("instructorGeoCoverage", row._id);
      }),
    );
    return;
  }

  for (const row of existingRows) {
    if (!desiredSports.has(row.sport)) {
      await geospatial.remove(ctx, row.geospatialKey);
      await ctx.db.delete("instructorGeoCoverage", row._id);
    }
  }

  for (const sport of desiredSports) {
    const geospatialKey = getInstructorGeoKey(instructorId, sport);
    const existing = existingBySport.get(sport);
    const desiredRow = {
      instructorId,
      sport,
      geospatialKey,
      latitude: point.latitude,
      longitude: point.longitude,
      workRadiusKm: normalizeWorkRadiusKm(workRadiusKm),
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch("instructorGeoCoverage", existing._id, desiredRow);
    } else {
      await ctx.db.insert("instructorGeoCoverage", desiredRow);
    }
    await geospatial.insert(ctx, geospatialKey, point, {
      kind: "instructor",
      sport,
    }, normalizeWorkRadiusKm(workRadiusKm) * 1000);
  }
}

export async function syncStudioBranchGeospatialLocation(
  ctx: MutationCtx,
  branch: Doc<"studioBranches">,
) {
  const key = getStudioBranchGeoKey(branch._id);
  const point = toPoint(branch.latitude, branch.longitude);
  if (branch.status !== "active" || !point) {
    await geospatial.remove(ctx, key);
    return;
  }

  await geospatial.insert(ctx, key, point, {
    kind: "branch",
  }, branch._creationTime);
}

export async function findNearbyStudioBranchIdsForInstructor(
  ctx: Ctx,
  args: {
    instructorLatitude: number;
    instructorLongitude: number;
    workRadiusKm: number;
    limit: number;
  },
) {
  const result = await geospatial.nearest(ctx, {
    point: {
      latitude: args.instructorLatitude,
      longitude: args.instructorLongitude,
    },
    limit: args.limit,
    maxDistance: normalizeWorkRadiusKm(args.workRadiusKm) * 1000,
    filter: (q) => q.eq("kind", "branch"),
  });
  return result.map((row) => ({
    branchId: row.key.replace(/^branch:/, "") as Id<"studioBranches">,
    distanceMeters: row.distance,
    latitude: row.coordinates.latitude,
    longitude: row.coordinates.longitude,
  }));
}

export async function findNearbyInstructorsForBranch(
  ctx: Ctx,
  args: {
    branchLatitude: number;
    branchLongitude: number;
    sport: string;
    limit: number;
  },
) {
  const result = await geospatial.nearest(ctx, {
    point: {
      latitude: args.branchLatitude,
      longitude: args.branchLongitude,
    },
    limit: args.limit,
    maxDistance: 1000 * 50,
    filter: (q) => q.eq("kind", "instructor").eq("sport", args.sport),
  });

  return result.map((row) => ({
    instructorKey: row.key,
    instructorId: row.key.split(":")[1] as Id<"instructorProfiles">,
    distanceMeters: row.distance,
    latitude: row.coordinates.latitude,
    longitude: row.coordinates.longitude,
  }));
}
