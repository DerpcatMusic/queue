import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { getDistanceMeters } from "../jobs/jobConstants";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { getCompactedCoverageCells, getCoveragePreviewPolygons } from "../lib/h3";
import { DEFAULT_WORK_RADIUS_KM, normalizeWorkRadiusKm } from "../lib/locationRadius";
import { omitUndefined } from "../lib/validation";
import { ErrorCode } from "../lib/errors";

async function requireInstructorProfileByUserId(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError({
      code: ErrorCode.MULTIPLE_PROFILES_FOUND,
      message: "Multiple instructor profiles found for this account",
    });
  }
  const profile = profiles[0] ?? null;
  if (!profile) {
    throw new ConvexError({
      code: ErrorCode.INSTRUCTOR_PROFILE_NOT_FOUND,
      message: "Instructor profile not found",
    });
  }
  return profile;
}

export const getInstructorMapStudios = query({
  args: {
    workRadiusKm: v.optional(v.number()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      zone: v.string(),
      h3Index: v.optional(v.string()),
      latitude: v.number(),
      longitude: v.number(),
      distanceMeters: v.optional(v.number()),
      address: v.optional(v.string()),
      logoImageUrl: v.optional(v.string()),
      mapMarkerColor: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user?.isActive || user.role !== "instructor") {
      return [];
    }

    const instructor = await requireInstructorProfileByUserId(ctx, user._id);
    if (!instructor) {
      return [];
    }

    const latitude = Number.isFinite(args.latitude) ? args.latitude : instructor.latitude;
    const longitude = Number.isFinite(args.longitude) ? args.longitude : instructor.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const workRadiusKm = normalizeWorkRadiusKm(
      args.workRadiusKm ?? instructor.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM,
    );
    const maxDistanceMeters = workRadiusKm * 1000;
    const coverageCells = getCompactedCoverageCells(latitude!, longitude!, workRadiusKm);

    const branchByStudioId = new Map<string, Doc<"studioBranches">>();
    const branchesByCoverage = await Promise.all(
      coverageCells.map((coverage) => {
        switch (coverage.resolution) {
          case 9:
            return ctx.db
              .query("studioBranches")
              .withIndex("by_h3_index", (q) => q.eq("h3Index", coverage.cell))
              .collect();
          case 8:
            return ctx.db
              .query("studioBranches")
              .withIndex("by_h3_res8", (q) => q.eq("h3Res8", coverage.cell))
              .collect();
          case 7:
            return ctx.db
              .query("studioBranches")
              .withIndex("by_h3_res7", (q) => q.eq("h3Res7", coverage.cell))
              .collect();
          case 6:
            return ctx.db
              .query("studioBranches")
              .withIndex("by_h3_res6", (q) => q.eq("h3Res6", coverage.cell))
              .collect();
          case 5:
            return ctx.db
              .query("studioBranches")
              .withIndex("by_h3_res5", (q) => q.eq("h3Res5", coverage.cell))
              .collect();
          case 4:
            return ctx.db
              .query("studioBranches")
              .withIndex("by_h3_res4", (q) => q.eq("h3Res4", coverage.cell))
              .collect();
          default:
            return Promise.resolve([]);
        }
      }),
    );
    for (const branches of branchesByCoverage) {
      for (const branch of branches) {
        if (branch.status !== "active") continue;
        if (!branchByStudioId.has(String(branch.studioId))) {
          branchByStudioId.set(String(branch.studioId), branch);
        }
      }
    }

    if (branchByStudioId.size === 0) return [];

    const studioIds = [...branchByStudioId.keys()];
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId as Id<"studioProfiles">)),
    );
    const logoUrls = await Promise.all(
      studios.map((studio) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );

    return studios
      .map((studio, index) => {
        if (!studio) return null;
        const branch = branchByStudioId.get(String(studio._id));
        if (!branch || branch.latitude === undefined || branch.longitude === undefined) return null;
        const distanceMeters = getDistanceMeters(
          { latitude: latitude!, longitude: longitude! },
          { latitude: branch.latitude, longitude: branch.longitude },
        );
        if (distanceMeters > maxDistanceMeters) return null;
        return {
          studioId: studio._id,
          studioName: studio.studioName,
          zone: branch.zone ?? studio.zone ?? branch.address,
          latitude: branch.latitude!,
          longitude: branch.longitude!,
          distanceMeters,
          ...omitUndefined({
            h3Index: branch.h3Index,
            address: branch.address,
            logoImageUrl: logoUrls[index] ?? undefined,
            mapMarkerColor: studio.mapMarkerColor,
          }),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  },
});

export const getInstructorMapCoverage = query({
  args: {
    workRadiusKm: v.optional(v.number()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      cell: v.string(),
      resolution: v.number(),
      boundary: v.array(
        v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user?.isActive || user.role !== "instructor") {
      return [];
    }

    const instructor = await requireInstructorProfileByUserId(ctx, user._id);
    if (!instructor) {
      return [];
    }

    const latitude = Number.isFinite(args.latitude) ? args.latitude : instructor.latitude;
    const longitude = Number.isFinite(args.longitude) ? args.longitude : instructor.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const workRadiusKm = normalizeWorkRadiusKm(
      args.workRadiusKm ?? instructor.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM,
    );

    return getCoveragePreviewPolygons(latitude!, longitude!, workRadiusKm);
  },
});
