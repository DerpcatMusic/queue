import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import {
  requireInstructorProfile,
  requireStudioProfile,
  getLessonLifecycle,
  loadLatestLessonCheckInSummary,
  LessonCheckInSummary,
} from "./_helpers";
import { assertPositiveInteger, omitUndefined, trimOptionalString } from "../lib/validation";

export const checkInstructorConflicts = query({
  args: {
    instructorId: v.id("instructorProfiles"),
    startTime: v.number(),
    endTime: v.number(),
    excludeJobId: v.optional(v.id("jobs")),
  },
  returns: v.object({
    hasConflict: v.boolean(),
    conflictingJobs: v.array(
      v.object({
        jobId: v.id("jobs"),
        sport: v.string(),
        studioName: v.string(),
        startTime: v.number(),
        endTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_filledByInstructor_startTime", (q) =>
        q.eq("filledByInstructorId", args.instructorId),
      )
      .collect();

    const conflictingJobs: any[] = [];

    for (const job of jobs) {
      if (job.status !== "filled") continue;
      if (args.excludeJobId && job._id === args.excludeJobId) continue;
      // Overlap check: existing.startTime < newEndTime AND existing.endTime > newStartTime
      if (job.startTime < args.endTime && job.endTime > args.startTime) {
        const studio = await ctx.db.get("studioProfiles", job.studioId);
        conflictingJobs.push({
          jobId: job._id,
          sport: job.sport,
          studioName: studio?.studioName ?? "Unknown studio",
          startTime: job.startTime,
          endTime: job.endTime,
        });
      }
    }

    return {
      hasConflict: conflictingJobs.length > 0,
      conflictingJobs,
    };
  },
});

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

      // Filter out cancelled jobs - they should not appear in calendar
      const jobs = allJobs.filter((job: any) => job.status !== "cancelled");

      const studioIds = [...new Set(jobs.map((job: any) => job.studioId))];
      const studios = await Promise.all(
        studioIds.map((studioId: any) => ctx.db.get("studioProfiles", studioId)),
      );
      const latestCheckIns = await Promise.all(
        jobs.map((job: any) =>
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

      return jobs.map((job: any) => {
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

    // Filter out cancelled jobs - they should not appear in calendar
    const jobs = allJobs.filter((job: any) => job.status !== "cancelled");

    const instructorIds = [
      ...new Set(
        jobs.map((job: any) => job.filledByInstructorId).filter((id: any): id is any => !!id),
      ),
    ];
    const latestCheckIns = await Promise.all(
      jobs.map((job: any) =>
        loadLatestLessonCheckInSummary(ctx, {
          jobId: job._id,
          instructorId: job.filledByInstructorId ?? undefined,
        }),
      ),
    );
    const instructors = await Promise.all(
      instructorIds.map((instructorId: any) => ctx.db.get("instructorProfiles", instructorId)),
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

    return jobs.map((job: any) => {
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
