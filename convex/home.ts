import { v } from "convex/values";
import { query } from "./_generated/server";
import { getMyInstructorHomeStatsRead } from "./homeRead";

export const getMyInstructorHomeStats = query({
  args: {},
  returns: v.object({
    isVerified: v.boolean(),
    openMatches: v.number(),
    pendingApplications: v.number(),
    totalEarningsAgorot: v.number(),
    earningsEvents: v.array(
      v.object({
        timestamp: v.number(),
        amountAgorot: v.number(),
      }),
    ),
    lessonEvents: v.array(
      v.object({
        endTime: v.number(),
      }),
    ),
    upcomingSessions: v.array(
      v.object({
        applicationId: v.id("jobApplications"),
        sport: v.string(),
        studioName: v.string(),
        zone: v.string(),
        startTime: v.number(),
        pay: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => await getMyInstructorHomeStatsRead(ctx),
});
