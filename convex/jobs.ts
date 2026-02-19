import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  APPLICATION_STATUSES,
  REQUIRED_LEVELS,
  SESSION_LANGUAGES,
} from "./constants";
import { requireUserRole } from "./lib/auth";
import { isKnownZoneId, normalizeSportType } from "./lib/domainValidation";
import { assertPositiveInteger, omitUndefined, trimOptionalString } from "./lib/validation";

const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUSES);
const REQUIRED_LEVEL_SET = new Set<string>(REQUIRED_LEVELS);
const SESSION_LANGUAGE_SET = new Set<string>(SESSION_LANGUAGES);

function assertPositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConvexError(`${fieldName} must be greater than 0`);
  }
}

function normalizeRequired(value: string | undefined, fieldName: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ConvexError(`${fieldName} is required`);
  }
  return trimmed;
}

function normalizeTimeZone(value: string | undefined) {
  const trimmed = trimOptionalString(value);
  if (!trimmed) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(0);
  } catch {
    throw new ConvexError("Invalid timeZone");
  }
  return trimmed;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function ensureOneOf(value: string, validValues: Set<string>, fieldName: string) {
  if (!validValues.has(value)) {
    throw new ConvexError(`Invalid ${fieldName}`);
  }
}

export const getServerNow = query({
  args: {
    minuteBucket: v.optional(v.number()),
  },
  returns: v.object({
    now: v.number(),
  }),
  handler: async () => {
    return { now: Date.now() };
  },
});

async function requireInstructorProfile(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);
  const profile = await ctx.db
    .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

  if (!profile) throw new ConvexError("Instructor profile not found");

  return profile;
}

async function requireStudioProfile(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserRole(ctx, ["studio"]);
  const studio = await ctx.db
    .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

  if (!studio) throw new ConvexError("Studio profile not found");

  return studio;
}

function toDisplayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function enqueueUserNotification(
  ctx: MutationCtx,
  args: {
    recipientUserId: Id<"users">;
    actorUserId?: Id<"users">;
    kind: Doc<"userNotifications">["kind"];
    title: string;
    body: string;
    jobId?: Id<"jobs">;
    applicationId?: Id<"jobApplications">;
  },
) {
  const createdAt = Date.now();
  await ctx.db.insert("userNotifications", {
    recipientUserId: args.recipientUserId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    ...omitUndefined({
      actorUserId: args.actorUserId,
      jobId: args.jobId,
      applicationId: args.applicationId,
    }),
    createdAt,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.userPushNotifications.sendUserPushNotification,
    {
      userId: args.recipientUserId,
      title: args.title,
      body: args.body,
      data: {
        type: args.kind,
        ...omitUndefined({
          jobId: args.jobId ? String(args.jobId) : undefined,
          applicationId: args.applicationId ? String(args.applicationId) : undefined,
        }),
      },
    },
  );
}

export const postJob = mutation({
  args: {
    sport: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    timeZone: v.optional(v.string()),
    pay: v.number(),
    note: v.optional(v.string()),
    requiredLevel: v.optional(
      v.union(
        v.literal("beginner_friendly"),
        v.literal("all_levels"),
        v.literal("intermediate"),
        v.literal("advanced"),
      ),
    ),
    maxParticipants: v.optional(v.number()),
    equipmentProvided: v.optional(v.boolean()),
    sessionLanguage: v.optional(
      v.union(
        v.literal("hebrew"),
        v.literal("english"),
        v.literal("arabic"),
        v.literal("russian"),
      ),
    ),
    isRecurring: v.optional(v.boolean()),
    cancellationDeadlineHours: v.optional(v.number()),
    applicationDeadline: v.optional(v.number()),
  },
  returns: v.object({
    jobId: v.id("jobs"),
  }),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    const now = Date.now();

    const sport = normalizeSportType(args.sport);
    const studioZone = normalizeRequired(studio.zone, "studio zone");
    const timeZone = normalizeTimeZone(args.timeZone);

    assertPositiveNumber(args.pay, "pay");
    if (!Number.isFinite(args.startTime) || !Number.isFinite(args.endTime)) {
      throw new ConvexError("startTime and endTime must be finite numbers");
    }
    if (args.endTime <= args.startTime) {
      throw new ConvexError("endTime must be after startTime");
    }

    if (args.requiredLevel) {
      ensureOneOf(args.requiredLevel, REQUIRED_LEVEL_SET, "requiredLevel");
    }
    if (args.sessionLanguage) {
      ensureOneOf(args.sessionLanguage, SESSION_LANGUAGE_SET, "sessionLanguage");
    }
    if (args.maxParticipants !== undefined) {
      assertPositiveInteger(args.maxParticipants, "maxParticipants");
    }
    if (args.cancellationDeadlineHours !== undefined) {
      assertPositiveInteger(
        args.cancellationDeadlineHours,
        "cancellationDeadlineHours",
      );
    }
    if (args.applicationDeadline !== undefined) {
      if (!Number.isFinite(args.applicationDeadline)) {
        throw new ConvexError("applicationDeadline must be a finite number");
      }
      if (args.applicationDeadline <= now) {
        throw new ConvexError("applicationDeadline must be in the future");
      }
      if (args.applicationDeadline > args.startTime) {
        throw new ConvexError("applicationDeadline must be before startTime");
      }
    }

    const jobId = await ctx.db.insert("jobs", {
      studioId: studio._id,
      zone: studioZone,
      sport,
      startTime: args.startTime,
      endTime: args.endTime,
      pay: args.pay,
      status: "open",
      postedAt: now,
      ...omitUndefined({
        timeZone,
        note: trimOptionalString(args.note),
        requiredLevel: args.requiredLevel,
        maxParticipants: args.maxParticipants,
        equipmentProvided: args.equipmentProvided,
        sessionLanguage: args.sessionLanguage,
        isRecurring: args.isRecurring,
        cancellationDeadlineHours: args.cancellationDeadlineHours,
        applicationDeadline: args.applicationDeadline,
      }),
    });

    if (studio.zone !== studioZone) {
      await ctx.db.patch("studioProfiles", studio._id, {
        zone: studioZone,
        updatedAt: now,
      });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.sendJobNotifications,
      { jobId },
    );
    await ctx.scheduler.runAfter(
      Math.max(args.endTime - now, 0),
      internal.jobs.closeJobIfStillOpen,
      { jobId },
    );

    return { jobId };
  },
});

export const getAvailableJobsForInstructor = query({
  args: {
    limit: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      sport: v.string(),
      zone: v.string(),
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
      postedAt: v.number(),
      requiredLevel: v.optional(
        v.union(
          v.literal("beginner_friendly"),
          v.literal("all_levels"),
          v.literal("intermediate"),
          v.literal("advanced"),
        ),
      ),
      maxParticipants: v.optional(v.number()),
      equipmentProvided: v.optional(v.boolean()),
      sessionLanguage: v.optional(
        v.union(
          v.literal("hebrew"),
          v.literal("english"),
          v.literal("arabic"),
          v.literal("russian"),
        ),
      ),
      isRecurring: v.optional(v.boolean()),
      cancellationDeadlineHours: v.optional(v.number()),
      applicationDeadline: v.optional(v.number()),
      applicationStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("accepted"),
          v.literal("rejected"),
          v.literal("withdrawn"),
        ),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = args.now ?? Date.now();

    const [sports, zones] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
        .collect(),
      ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
        .collect(),
    ]);

    if (sports.length === 0 || zones.length === 0) {
      return [];
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const uniqueSports = [...new Set(sports.map((row) => row.sport))];
    const zoneSet = new Set(
      zones.map((row) => trimOptionalString(row.zone) ?? row.zone),
    );
    const fetchPerSport = Math.min(
      Math.max(Math.ceil((limit * 3) / uniqueSports.length), 30),
      200,
    );

    const openJobsBySport = await Promise.all(
      uniqueSports.map((sport) =>
        ctx.db
          .query("jobs")
          .withIndex("by_sport_and_status", (q) =>
            q.eq("sport", sport).eq("status", "open"),
          )
          .order("desc")
          .take(fetchPerSport),
      ),
    );

    const matchingById = new Map<Id<"jobs">, Doc<"jobs">>();
    for (const jobsForSport of openJobsBySport) {
      for (const job of jobsForSport) {
        const normalizedJobZone = trimOptionalString(job.zone);
        if (
          normalizedJobZone &&
          isKnownZoneId(normalizedJobZone) &&
          !zoneSet.has(normalizedJobZone)
        ) {
          continue;
        }
        if (job.startTime <= now) continue;
        matchingById.set(job._id, job);
      }
    }

    const matchingJobs = [...matchingById.values()]
      .sort((a, b) => b.postedAt - a.postedAt)
      .slice(0, limit);

    if (matchingJobs.length === 0) {
      return [];
    }

    const applicationByJobId = new Map<string, Doc<"jobApplications">>();
    const matchingApplications = await Promise.all(
      matchingJobs.map((job) =>
        ctx.db
          .query("jobApplications")
          .withIndex("by_job_and_instructor", (q) =>
            q.eq("jobId", job._id).eq("instructorId", instructor._id),
          )
          .unique(),
      ),
    );

    for (const application of matchingApplications) {
      if (!application) continue;
      applicationByJobId.set(String(application.jobId), application);
    }

    const studioIds = [...new Set(matchingJobs.map((job) => job.studioId))];
    const studioById = new Map<string, Doc<"studioProfiles">>();
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    for (let i = 0; i < studioIds.length; i += 1) {
      const studioId = studioIds[i];
      const studio = studios[i];
      if (studio) {
        studioById.set(String(studioId), studio);
      }
    }

    return matchingJobs.map((job) => {
      const studio = studioById.get(String(job.studioId));
      const application = applicationByJobId.get(String(job._id));
      return {
        jobId: job._id,
        studioId: job.studioId,
        studioName: studio?.studioName ?? "Unknown studio",
        sport: job.sport,
        zone: trimOptionalString(job.zone) ?? job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        ...omitUndefined({
          timeZone: job.timeZone,
          note: job.note,
          requiredLevel: job.requiredLevel,
          maxParticipants: job.maxParticipants,
          equipmentProvided: job.equipmentProvided,
          sessionLanguage: job.sessionLanguage,
          isRecurring: job.isRecurring,
          cancellationDeadlineHours: job.cancellationDeadlineHours,
          applicationDeadline: job.applicationDeadline,
          applicationStatus: application?.status,
        }),
      };
    });
  },
});

export const getMyApplications = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      applicationId: v.id("jobApplications"),
      jobId: v.id("jobs"),
      instructorId: v.id("instructorProfiles"),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("withdrawn"),
      ),
      appliedAt: v.number(),
      message: v.optional(v.string()),
      studioName: v.string(),
      sport: v.string(),
      zone: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      pay: v.number(),
      note: v.optional(v.string()),
      jobStatus: v.union(
        v.literal("open"),
        v.literal("filled"),
        v.literal("cancelled"),
        v.literal("completed"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);

    const rawLimit = args.limit ?? 100;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 250);

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor_appliedAt", (q) =>
        q.eq("instructorId", instructor._id),
      )
      .order("desc")
      .take(limit);

    const jobs = await Promise.all(
      applications.map((application) => ctx.db.get("jobs", application.jobId)),
    );
    const jobById = new Map<string, Doc<"jobs">>();
    for (const job of jobs) {
      if (job) {
        jobById.set(String(job._id), job);
      }
    }

    const studioIds = [...new Set(jobs.filter(isPresent).map((job) => job.studioId))];
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    const studioById = new Map<string, Doc<"studioProfiles">>();
    for (let i = 0; i < studioIds.length; i += 1) {
      const studioId = studioIds[i];
      const studio = studios[i];
      if (studio) {
        studioById.set(String(studioId), studio);
      }
    }

    const rows = [];
    for (const application of applications) {
      const job = jobById.get(String(application.jobId));
      if (!job) continue;
      const studio = studioById.get(String(job.studioId));

      rows.push({
        applicationId: application._id,
        jobId: application.jobId,
        instructorId: application.instructorId,
        status: application.status,
        appliedAt: application.appliedAt,
        studioName: studio?.studioName ?? "Unknown studio",
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        jobStatus: job.status,
        ...omitUndefined({
          message: application.message,
          timeZone: job.timeZone,
          note: job.note,
        }),
      });
    }

    return rows;
  },
});

export const applyToJob = mutation({
  args: {
    jobId: v.id("jobs"),
    message: v.optional(v.string()),
  },
  returns: v.object({
    applicationId: v.id("jobApplications"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);

    const [sports, zones, job] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
        .collect(),
      ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
        .collect(),
      ctx.db.get("jobs", args.jobId),
    ]);

    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "open") throw new ConvexError("Job is not open");

    const now = Date.now();
    if (job.applicationDeadline !== undefined && now > job.applicationDeadline) {
      throw new ConvexError("Application deadline has passed");
    }
    if (now >= job.startTime) {
      throw new ConvexError("Job has already started");
    }

    const sportSet = new Set(sports.map((row) => row.sport));
    const zoneSet = new Set(
      zones.map((row) => trimOptionalString(row.zone) ?? row.zone),
    );
    const normalizedJobZone = trimOptionalString(job.zone);
    if (!sportSet.has(job.sport)) {
      throw new ConvexError("You are not eligible for this job");
    }
    if (
      normalizedJobZone !== undefined &&
      isKnownZoneId(normalizedJobZone) &&
      !zoneSet.has(normalizedJobZone)
    ) {
      throw new ConvexError("You are not eligible for this job");
    }

    const existing = await ctx.db
      .query("jobApplications")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", args.jobId).eq("instructorId", instructor._id),
      )
      .unique();

    const message = trimOptionalString(args.message);

    let applicationId: Id<"jobApplications">;
    if (existing) {
      if (existing.status === "accepted") {
        throw new ConvexError("Application already accepted");
      }

      await ctx.db.patch("jobApplications", existing._id, {
        status: "pending",
        ...omitUndefined({ message }),
        updatedAt: now,
      });
      applicationId = existing._id;
    } else {
      applicationId = await ctx.db.insert("jobApplications", {
        jobId: args.jobId,
        instructorId: instructor._id,
        status: "pending",
        appliedAt: now,
        updatedAt: now,
        ...omitUndefined({ message }),
      });
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        actorUserId: instructor.userId,
        kind: "application_received",
        title: "New application received",
        body: `${instructor.displayName} applied to teach ${toDisplayLabel(job.sport)}.`,
        jobId: job._id,
        applicationId,
      });
    }

    return { applicationId, status: "pending" as const };
  },
});

export const getMyStudioJobs = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      sport: v.string(),
      zone: v.string(),
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
      postedAt: v.number(),
      applicationsCount: v.number(),
      pendingApplicationsCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
      .order("desc")
      .take(limit);

    const applicationsByJob = await Promise.all(
      jobs.map((job) =>
        ctx.db
          .query("jobApplications")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect(),
      ),
    );

    const rows = [];
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) continue;
      const applications =
        applicationsByJob[i] ?? ([] as Doc<"jobApplications">[]);

      rows.push({
        jobId: job._id,
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        applicationsCount: applications.length,
        pendingApplicationsCount: applications.filter((a) => a.status === "pending").length,
        ...omitUndefined({
          timeZone: job.timeZone,
          note: job.note,
        }),
      });
    }

    return rows;
  },
});

export const getMyStudioJobsWithApplications = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      sport: v.string(),
      zone: v.string(),
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
      postedAt: v.number(),
      applicationsCount: v.number(),
      pendingApplicationsCount: v.number(),
      applications: v.array(
        v.object({
          applicationId: v.id("jobApplications"),
          instructorId: v.id("instructorProfiles"),
          instructorName: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("accepted"),
            v.literal("rejected"),
            v.literal("withdrawn"),
          ),
          appliedAt: v.number(),
          message: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
      .order("desc")
      .take(limit);

    const applicationsByJob = await Promise.all(
      jobs.map((job) =>
        ctx.db
          .query("jobApplications")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect(),
      ),
    );

    const instructorIds = [
      ...new Set(
        applicationsByJob
          .flat()
          .map((application) => application.instructorId),
      ),
    ];
    const profiles = await Promise.all(
      instructorIds.map((instructorId) =>
        ctx.db.get("instructorProfiles", instructorId),
      ),
    );
    const profileById = new Map<string, Doc<"instructorProfiles">>();
    for (let i = 0; i < instructorIds.length; i += 1) {
      const instructorId = instructorIds[i];
      const profile = profiles[i];
      if (profile) {
        profileById.set(String(instructorId), profile);
      }
    }

    const rows = [];
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) continue;
      const applications =
        applicationsByJob[i] ?? ([] as Doc<"jobApplications">[]);

      const sortedApplications = [...applications].sort((a, b) => {
        const statusRank: Record<Doc<"jobApplications">["status"], number> = {
          pending: 0,
          accepted: 1,
          rejected: 2,
          withdrawn: 3,
        };
        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
        }
        return b.appliedAt - a.appliedAt;
      });

      rows.push({
        jobId: job._id,
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        applicationsCount: applications.length,
        pendingApplicationsCount: applications.filter((a) => a.status === "pending")
          .length,
        ...omitUndefined({
          timeZone: job.timeZone,
          note: job.note,
        }),
        applications: sortedApplications.map((application) => {
          const profile = profileById.get(String(application.instructorId));
          return {
            applicationId: application._id,
            instructorId: application.instructorId,
            instructorName: profile?.displayName ?? "Unknown instructor",
            status: application.status,
            appliedAt: application.appliedAt,
            ...omitUndefined({ message: application.message }),
          };
        }),
      });
    }

    return rows;
  },
});

export const reviewApplication = mutation({
  args: {
    applicationId: v.id("jobApplications"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    const application = await ctx.db.get("jobApplications", args.applicationId);
    if (!application) throw new ConvexError("Application not found");

    if (!APPLICATION_STATUS_SET.has(args.status)) {
      throw new ConvexError("Invalid application status");
    }

    const job = await ctx.db.get("jobs", application.jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.studioId !== studio._id) {
      throw new ConvexError("Not authorized for this job");
    }

    if (args.status === "accepted") {
      const now = Date.now();
      if (job.status !== "open") {
        throw new ConvexError("Job is not open");
      }
      if (now >= job.endTime) {
        throw new ConvexError("Job already ended");
      }
      await ctx.db.patch("jobs", job._id, {
        status: "filled",
        filledByInstructorId: application.instructorId,
      });

      const competingApplications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      const uniqueInstructorIds = [
        ...new Set(competingApplications.map((row) => row.instructorId)),
      ];
      const profiles = await Promise.all(
        uniqueInstructorIds.map((instructorId) =>
          ctx.db.get("instructorProfiles", instructorId),
        ),
      );
      const profileById = new Map<string, Doc<"instructorProfiles">>();
      for (let i = 0; i < uniqueInstructorIds.length; i += 1) {
        const instructorId = uniqueInstructorIds[i];
        const profile = profiles[i];
        if (profile) {
          profileById.set(String(instructorId), profile);
        }
      }

      for (const row of competingApplications) {
        await ctx.db.patch("jobApplications", row._id, {
          status: row._id === application._id ? "accepted" : "rejected",
          updatedAt: Date.now(),
        });

        const profile = profileById.get(String(row.instructorId));
        if (!profile) continue;

        const isAccepted = row._id === application._id;
        await enqueueUserNotification(ctx, {
          recipientUserId: profile.userId,
          actorUserId: studio.userId,
          kind: isAccepted ? "application_accepted" : "application_rejected",
          title: isAccepted ? "Application accepted" : "Application rejected",
          body: isAccepted
            ? `You were assigned to teach ${toDisplayLabel(job.sport)}.`
            : `Another instructor was selected for ${toDisplayLabel(job.sport)}.`,
          jobId: job._id,
          applicationId: row._id,
        });
      }

      await ctx.scheduler.runAfter(
        Math.max(job.startTime - now, 0),
        internal.jobs.emitLessonLifecycleEvent,
        {
          jobId: job._id,
          instructorId: application.instructorId,
          event: "lesson_started",
        },
      );
      await ctx.scheduler.runAfter(
        Math.max(job.endTime - now, 0),
        internal.jobs.emitLessonLifecycleEvent,
        {
          jobId: job._id,
          instructorId: application.instructorId,
          event: "lesson_completed",
        },
      );
    } else {
      await ctx.db.patch("jobApplications", application._id, {
        status: "rejected",
        updatedAt: Date.now(),
      });

      const profile = await ctx.db.get(
        "instructorProfiles",
        application.instructorId,
      );
      if (profile) {
        await enqueueUserNotification(ctx, {
          recipientUserId: profile.userId,
          actorUserId: studio.userId,
          kind: "application_rejected",
          title: "Application rejected",
          body: `The studio passed on your ${toDisplayLabel(job.sport)} application.`,
          jobId: job._id,
          applicationId: application._id,
        });
      }
    }

    return { ok: true };
  },
});

export const emitLessonLifecycleEvent = internalMutation({
  args: {
    jobId: v.id("jobs"),
    instructorId: v.id("instructorProfiles"),
    event: v.union(v.literal("lesson_started"), v.literal("lesson_completed")),
  },
  returns: v.object({ emitted: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    const instructor = await ctx.db.get("instructorProfiles", args.instructorId);
    if (!job || !instructor) {
      return { emitted: false };
    }

    if (job.filledByInstructorId !== instructor._id) {
      return { emitted: false };
    }
    if (job.status === "cancelled" || job.status === "open") {
      return { emitted: false };
    }

    const now = Date.now();
    if (args.event === "lesson_started" && now < job.startTime) {
      return { emitted: false };
    }
    if (args.event === "lesson_completed" && now < job.endTime) {
      return { emitted: false };
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const studioName = studio?.studioName ?? "Your studio";

    if (args.event === "lesson_completed" && job.status === "filled") {
      await ctx.db.patch("jobs", job._id, { status: "completed" });
    }

    await enqueueUserNotification(ctx, {
      recipientUserId: instructor.userId,
      kind: args.event,
      title: args.event === "lesson_started" ? "Lesson started" : "Lesson completed",
      body:
        args.event === "lesson_started"
          ? `${toDisplayLabel(job.sport)} at ${studioName} is now live.`
          : `${toDisplayLabel(job.sport)} at ${studioName} is marked complete.`,
      jobId: job._id,
      ...(studio?.userId !== undefined ? { actorUserId: studio.userId } : {}),
    });

    return { emitted: true };
  },
});

export const markLessonCompleted = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized for this lesson");
    }
    if (job.status === "cancelled") {
      throw new ConvexError("Cancelled lessons cannot be completed");
    }
    if (job.status === "completed") {
      return { ok: true };
    }

    const now = Date.now();
    if (now + FIVE_MINUTES_MS < job.endTime) {
      throw new ConvexError("Lesson can be completed near or after end time");
    }

    await ctx.db.patch("jobs", job._id, { status: "completed" });

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        actorUserId: instructor.userId,
        kind: "lesson_completed",
        title: "Lesson marked complete",
        body: `${instructor.displayName} marked ${toDisplayLabel(job.sport)} as complete.`,
        jobId: job._id,
      });
    }

    return { ok: true };
  },
});

export const closeJobIfStillOpen = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      return { updated: false };
    }
    if (job.status !== "open") {
      return { updated: false };
    }
    if (Date.now() < job.endTime) {
      return { updated: false };
    }

    await ctx.db.patch("jobs", job._id, { status: "cancelled" });
    return { updated: true };
  },
});
