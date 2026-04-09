import { ConvexError, v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import { DEFAULT_BOUNDARY_PROVIDER, replaceInstructorBoundarySubscriptions } from "./lib/boundaries";
import { normalizeZoneId } from "./lib/domainValidation";
import { rebuildInstructorCoverage } from "./lib/instructorCoverage";

const MAX_INSTRUCTOR_ZONES = 25;

async function requireInstructorProfileId(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  if (user.role !== "instructor") {
    throw new ConvexError("Only instructor users can manage zones");
  }

  const profile = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();

  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }

  return profile._id;
}

export const getMyInstructorZones = query({
  args: {},
  returns: v.object({
    zoneIds: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const instructorId = await requireInstructorProfileId(ctx);
    const zoneLinks = await ctx.db
      .query("instructorZones")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect();

    const zoneIds = zoneLinks.map((zoneLink) => zoneLink.zone).sort();
    return { zoneIds };
  },
});

export const setMyInstructorZones = mutation({
  args: {
    zoneIds: v.array(v.string()),
  },
  returns: v.object({
    zoneCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const instructorId = await requireInstructorProfileId(ctx);
    const uniqueZoneIds = [...new Set(args.zoneIds.map((zoneId) => normalizeZoneId(zoneId)))];

    if (uniqueZoneIds.length > MAX_INSTRUCTOR_ZONES) {
      throw new ConvexError("Too many zones selected");
    }

    const existingZoneLinks = await ctx.db
      .query("instructorZones")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect();

    await Promise.all(
      existingZoneLinks.map((existingZoneLink) =>
        ctx.db.delete("instructorZones", existingZoneLink._id),
      ),
    );

    const now = Date.now();
    await Promise.all(
      uniqueZoneIds.map((zone) =>
        ctx.db.insert("instructorZones", {
          instructorId,
          zone,
          createdAt: now,
        }),
      ),
    );

    await replaceInstructorBoundarySubscriptions(ctx, {
      instructorId,
      provider: DEFAULT_BOUNDARY_PROVIDER,
      boundaryIds: uniqueZoneIds,
    });

    await rebuildInstructorCoverage(ctx, instructorId);

    return { zoneCount: uniqueZoneIds.length };
  },
});
