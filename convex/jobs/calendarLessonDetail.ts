import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import { omitUndefined, trimOptionalString } from "../lib/validation";
import {
  getLessonLifecycle,
  loadLatestLessonCheckInSummary,
  requireInstructorProfile,
  requireStudioProfile,
} from "./_helpers";

export const getMyCalendarLessonDetail = query({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.union(
    v.null(),
    v.object({
      lessonId: v.id("jobs"),
      roleView: v.union(v.literal("instructor"), v.literal("studio")),
      sport: v.string(),
      status: v.union(
        v.literal("open"),
        v.literal("filled"),
        v.literal("cancelled"),
        v.literal("completed"),
      ),
      lifecycle: v.union(
        v.literal("upcoming"),
        v.literal("live"),
        v.literal("past"),
        v.literal("cancelled"),
      ),
      startTime: v.number(),
      endTime: v.number(),
      pay: v.number(),
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      studioProfileImageUrl: v.optional(v.string()),
      instructorId: v.optional(v.id("instructorProfiles")),
      instructorName: v.optional(v.string()),
      instructorProfileImageUrl: v.optional(v.string()),
      note: v.optional(v.string()),
      timeZone: v.optional(v.string()),
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
      checkInDistanceMeters: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const actor = await requireUserRole(ctx, ["instructor", "studio"]);
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (!studio) {
      return null;
    }

    const studioProfileImageUrl = studio.logoStorageId
      ? ((await ctx.storage.getUrl(studio.logoStorageId)) ?? undefined)
      : undefined;

    if (actor.role === "instructor") {
      const instructor = await requireInstructorProfile(ctx);
      if (job.filledByInstructorId !== instructor._id) {
        return null;
      }
      const latestCheckIn = await loadLatestLessonCheckInSummary(ctx, {
        jobId: job._id,
        instructorId: instructor._id,
      });

      return {
        lessonId: job._id,
        roleView: "instructor" as const,
        sport: job.sport,
        status: job.status,
        lifecycle: getLessonLifecycle(job.status, Date.now(), job.startTime, job.endTime),
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        studioId: studio._id,
        studioName: studio.studioName,
        ...omitUndefined({
          studioProfileImageUrl,
          instructorId: instructor._id,
          instructorName: instructor.displayName,
          note: trimOptionalString(job.note),
          timeZone: job.timeZone,
          ...latestCheckIn,
        }),
      };
    }

    const studioProfile = await requireStudioProfile(ctx);
    if (job.studioId !== studioProfile._id) {
      return null;
    }

    const instructor = job.filledByInstructorId
      ? await ctx.db.get("instructorProfiles", job.filledByInstructorId)
      : null;
    const latestCheckIn = await loadLatestLessonCheckInSummary(ctx, {
      jobId: job._id,
      instructorId: job.filledByInstructorId ?? undefined,
    });
    const instructorProfileImageUrl = instructor?.profileImageStorageId
      ? ((await ctx.storage.getUrl(instructor.profileImageStorageId)) ?? undefined)
      : undefined;

    return {
      lessonId: job._id,
      roleView: "studio" as const,
      sport: job.sport,
      status: job.status,
      lifecycle: getLessonLifecycle(job.status, Date.now(), job.startTime, job.endTime),
      startTime: job.startTime,
      endTime: job.endTime,
      zone: trimOptionalString(job.zone) ?? job.zone,
      pay: job.pay,
      studioId: studio._id,
      studioName: studio.studioName,
      ...omitUndefined({
        studioProfileImageUrl,
        instructorId: job.filledByInstructorId,
        instructorName: instructor?.displayName,
        instructorProfileImageUrl,
        note: trimOptionalString(job.note),
        timeZone: job.timeZone,
        ...latestCheckIn,
      }),
    };
  },
});
