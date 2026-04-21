import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import { assertPositiveInteger, omitUndefined } from "../lib/validation";
import type { LessonCheckInSummary } from "./_helpers";
import {
  getLessonLifecycle,
  loadLatestLessonCheckInSummary,
  requireInstructorProfile,
  requireStudioProfile,
} from "./_helpers";

export const getMyCalendarTimeline = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    limit: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      lessonId: v.id("jobs"),
      roleView: v.union(v.literal("instructor"), v.literal("studio")),
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      studioProfileImageUrl: v.optional(v.string()),
      instructorId: v.optional(v.id("instructorProfiles")),
      instructorName: v.optional(v.string()),
      instructorProfileImageUrl: v.optional(v.string()),
      sport: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      pay: v.number(),
      note: v.optional(v.string()),
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
    }),
  ),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.startTime) || !Number.isFinite(args.endTime)) {
      throw new ConvexError("startTime and endTime must be finite numbers");
    }
    if (args.endTime < args.startTime) {
      throw new ConvexError("endTime must be greater than or equal to startTime");
    }

    const actor = await requireUserRole(ctx, ["instructor", "studio"]);
    const now = args.now ?? Date.now();
    const rawLimit = args.limit ?? 400;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 1000);

    if (actor.role === "instructor") {
      const instructor = await requireInstructorProfile(ctx);
      const allJobs = await ctx.db
        .query("jobs")
        .withIndex("by_filledByInstructor_startTime", (q) =>
          q
            .eq("filledByInstructorId", instructor._id)
            .gte("startTime", args.startTime)
            .lte("startTime", args.endTime),
        )
        .order("asc")
        .take(limit);

      const jobs = allJobs.filter((job) => job.status !== "cancelled");

      const studioIds = [...new Set(jobs.map((job) => job.studioId))];
      const studios = await Promise.all(
        studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
      );
      const latestCheckIns = await Promise.all(
        jobs.map((job) =>
          loadLatestLessonCheckInSummary(ctx, {
            jobId: job._id,
            instructorId: instructor._id,
          }),
        ),
      );
      const studioById = new Map<string, any>();
      const studioProfileImageUrlById = new Map<string, string | undefined>();
      const checkInByJobId = new Map<string, LessonCheckInSummary>();
      for (let i = 0; i < studioIds.length; i += 1) {
        const studioId = studioIds[i];
        const studio = studios[i];
        if (studio) {
          studioById.set(String(studioId), studio);
          const imageUrl = studio.logoStorageId
            ? ((await ctx.storage.getUrl(studio.logoStorageId)) ?? undefined)
            : undefined;
          studioProfileImageUrlById.set(String(studioId), imageUrl);
        }
      }
      for (let i = 0; i < jobs.length; i += 1) {
        const latestCheckIn = latestCheckIns[i];
        if (latestCheckIn) {
          checkInByJobId.set(String(jobs[i]!._id), latestCheckIn);
        }
      }

      return jobs.map((job) => {
        const studio = studioById.get(String(job.studioId));
        const lifecycle = getLessonLifecycle(job.status, now, job.startTime, job.endTime);
        return {
          lessonId: job._id,
          roleView: "instructor" as const,
          studioId: job.studioId,
          studioName: studio?.studioName ?? "Unknown studio",
          instructorId: instructor._id,
          instructorName: instructor.displayName,
          sport: job.sport,
          startTime: job.startTime,
          endTime: job.endTime,
          pay: job.pay,
          status: job.status,
          lifecycle,
          ...omitUndefined({
            studioProfileImageUrl: studioProfileImageUrlById.get(String(job.studioId)),
            timeZone: job.timeZone,
            note: job.note,
            ...checkInByJobId.get(String(job._id)),
          }),
        };
      });
    }

    const studio = await requireStudioProfile(ctx);
    const allJobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_startTime", (q) =>
        q
          .eq("studioId", studio._id)
          .gte("startTime", args.startTime)
          .lte("startTime", args.endTime),
      )
      .order("asc")
      .take(limit);

    const jobs = allJobs.filter((job) => job.status !== "cancelled");

    const instructorIds = [
      ...new Set(
        jobs
          .map((job) => job.filledByInstructorId)
          .filter((id): id is NonNullable<typeof id> => !!id),
      ),
    ];
    const latestCheckIns = await Promise.all(
      jobs.map((job) =>
        loadLatestLessonCheckInSummary(ctx, {
          jobId: job._id,
          instructorId: job.filledByInstructorId ?? undefined,
        }),
      ),
    );
    const instructors = await Promise.all(
      instructorIds.map((instructorId) => ctx.db.get("instructorProfiles", instructorId)),
    );
    const instructorById = new Map<string, any>();
    const instructorProfileImageUrlById = new Map<string, string | undefined>();
    const checkInByJobId = new Map<string, LessonCheckInSummary>();
    for (let i = 0; i < instructorIds.length; i += 1) {
      const instructorId = instructorIds[i];
      const profile = instructors[i];
      if (profile) {
        instructorById.set(String(instructorId), profile);
        const imageUrl = profile.profileImageStorageId
          ? ((await ctx.storage.getUrl(profile.profileImageStorageId)) ?? undefined)
          : undefined;
        instructorProfileImageUrlById.set(String(instructorId), imageUrl);
      }
    }
    for (let i = 0; i < jobs.length; i += 1) {
      const latestCheckIn = latestCheckIns[i];
      if (latestCheckIn) {
        checkInByJobId.set(String(jobs[i]!._id), latestCheckIn);
      }
    }
    const studioProfileImageUrl = studio.logoStorageId
      ? ((await ctx.storage.getUrl(studio.logoStorageId)) ?? undefined)
      : undefined;

    return jobs.map((job) => {
      const instructor = job.filledByInstructorId
        ? instructorById.get(String(job.filledByInstructorId))
        : undefined;
      const lifecycle = getLessonLifecycle(job.status, now, job.startTime, job.endTime);

      return {
        lessonId: job._id,
        roleView: "studio" as const,
        studioId: studio._id,
        studioName: studio.studioName,
        sport: job.sport,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        lifecycle,
        ...omitUndefined({
          studioProfileImageUrl,
          instructorId: job.filledByInstructorId,
          instructorName: instructor?.displayName,
          instructorProfileImageUrl: job.filledByInstructorId
            ? instructorProfileImageUrlById.get(String(job.filledByInstructorId))
            : undefined,
          timeZone: job.timeZone,
          note: job.note,
          ...checkInByJobId.get(String(job._id)),
        }),
      };
    });
  },
});
