import { v } from "convex/values";
import { query } from "./_generated/server";
import { getMyInstructorHomeStatsRead } from "./homeRead";

export const getMyInstructorHomeStats = query({
  args: {},
  returns: v.object({
    isVerified: v.boolean(),
    openMatches: v.number(),
    pendingApplications: v.number(),
    thisMonthEarningsAgorot: v.number(),
    totalEarningsAgorot: v.number(),
    paidOutAmountAgorot: v.number(),
    outstandingAmountAgorot: v.number(),
    availableAmountAgorot: v.number(),
    heldAmountAgorot: v.number(),
    currency: v.string(),
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
        boundaryProvider: v.optional(v.string()),
        boundaryId: v.optional(v.string()),
        startTime: v.number(),
        pay: v.number(),
      }),
    ),
    nextCheckInSession: v.union(
      v.null(),
      v.object({
        applicationId: v.id("jobApplications"),
        jobId: v.id("jobs"),
        sport: v.string(),
        studioName: v.string(),
        branchName: v.string(),
        branchAddress: v.optional(v.string()),
        zone: v.string(),
        boundaryProvider: v.optional(v.string()),
        boundaryId: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        pay: v.number(),
        checkInStatus: v.optional(v.union(v.literal("verified"), v.literal("rejected"))),
        checkInReason: v.optional(
          v.union(
            v.literal("verified"),
            v.literal("outside_radius"),
            v.literal("accuracy_too_low"),
            v.literal("sample_too_old"),
            v.literal("outside_check_in_window"),
            v.literal("branch_location_missing"),
          ),
        ),
        checkedInAt: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx) => await getMyInstructorHomeStatsRead(ctx),
});
