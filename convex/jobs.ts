import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { APPLICATION_STATUSES, REQUIRED_LEVELS, SESSION_LANGUAGES } from "./constants";
import { requireUserRole } from "./lib/auth";
import { isKnownZoneId, normalizeSportType, normalizeZoneId } from "./lib/domainValidation";
import { hasCoverageKey, loadInstructorEligibility } from "./lib/instructorEligibility";
import {
  assertPositiveInteger,
  assertValidJobApplicationDeadline,
  omitUndefined,
  trimOptionalString,
} from "./lib/validation";

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

function getUniqueIdsInOrder<T extends string>(ids: ReadonlyArray<T>) {
  return [...new Set(ids)];
}

async function scheduleGoogleCalendarSyncForUser(
  ctx: MutationCtx,
  userId: Id<"users"> | undefined,
) {
  if (!userId) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.calendar.syncGoogleCalendarForUser, {
    userId,
  });
}

async function loadLatestPaymentDetailsByJobId(
  ctx: QueryCtx,
  args: {
    jobIds: ReadonlyArray<Id<"jobs">>;
    instructorUserId: Id<"users">;
  },
) {
  const uniqueJobIds = getUniqueIdsInOrder(args.jobIds);
  const payments = await Promise.all(
    uniqueJobIds.map((jobId) =>
      ctx.db
        .query("payments")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .order("desc")
        .first(),
    ),
  );

  const paymentByJobId = new Map<string, Doc<"payments">>();
  for (let index = 0; index < uniqueJobIds.length; index += 1) {
    const payment = payments[index];
    if (payment && payment.instructorUserId === args.instructorUserId) {
      paymentByJobId.set(String(uniqueJobIds[index]), payment);
    }
  }

  const paymentIds = [...paymentByJobId.values()].map((payment) => payment._id);
  const [payouts, invoices] = await Promise.all([
    Promise.all(
      paymentIds.map((paymentId) =>
        ctx.db
          .query("payouts")
          .withIndex("by_payment", (q) => q.eq("paymentId", paymentId))
          .order("desc")
          .first(),
      ),
    ),
    Promise.all(
      paymentIds.map((paymentId) =>
        ctx.db
          .query("invoices")
          .withIndex("by_payment", (q) => q.eq("paymentId", paymentId))
          .order("desc")
          .first(),
      ),
    ),
  ]);

  const payoutByPaymentId = new Map<string, Doc<"payouts">>();
  for (let index = 0; index < paymentIds.length; index += 1) {
    const payout = payouts[index];
    if (payout) {
      payoutByPaymentId.set(String(paymentIds[index]), payout);
    }
  }

  const invoiceByPaymentId = new Map<string, Doc<"invoices">>();
  for (let index = 0; index < paymentIds.length; index += 1) {
    const invoice = invoices[index];
    if (invoice) {
      invoiceByPaymentId.set(String(paymentIds[index]), invoice);
    }
  }

  const paymentDetailsByJobId = new Map<
    string,
    {
      status: Doc<"payments">["status"];
      payoutStatus?: Doc<"payouts">["status"];
      externalInvoiceUrl?: string;
    }
  >();

  for (const [jobId, payment] of paymentByJobId.entries()) {
    const payout = payoutByPaymentId.get(String(payment._id));
    const invoice = invoiceByPaymentId.get(String(payment._id));
    paymentDetailsByJobId.set(jobId, {
      status: payment.status,
      ...omitUndefined({
        payoutStatus: payout?.status,
        externalInvoiceUrl: invoice?.externalInvoiceUrl,
      }),
    });
  }

  return paymentDetailsByJobId;
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

export const getInstructorTabCounts = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.object({
    jobsBadgeCount: v.number(),
    calendarBadgeCount: v.number(),
  }),
  handler: async (ctx, args) => {
    let instructor: Awaited<ReturnType<typeof requireInstructorProfile>>;
    try {
      instructor = await requireInstructorProfile(ctx);
    } catch (error) {
      if (error instanceof ConvexError) {
        return { jobsBadgeCount: 0, calendarBadgeCount: 0 };
      }
      throw error;
    }
    const now = args.now ?? Date.now();

    const eligibility = await loadInstructorEligibility(ctx, instructor._id);
    let jobsBadgeCount = 0;

    if (eligibility.coverageCount > 0) {
      const fetchPerPair = Math.min(
        Math.max(Math.ceil((BADGE_COUNT_CAP * 2) / eligibility.coveragePairs.length), 8),
        60,
      );
      const openJobsByCoveragePair = await Promise.all(
        eligibility.coveragePairs.map(({ sport, zone }) =>
          ctx.db
            .query("jobs")
            .withIndex("by_sport_zone_status_postedAt", (q) =>
              q.eq("sport", sport).eq("zone", zone).eq("status", "open"),
            )
            .order("desc")
            .take(fetchPerPair),
        ),
      );

      const matchingById = new Set<string>();
      for (const jobsForPair of openJobsByCoveragePair) {
        for (const job of jobsForPair) {
          const normalizedJobZone = trimOptionalString(job.zone);
          if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
            continue;
          }
          if (!hasCoverageKey(eligibility, job.sport, normalizedJobZone)) {
            continue;
          }
          if (job.startTime <= now) continue;
          if (job.applicationDeadline !== undefined && job.applicationDeadline < now) {
            continue;
          }

          matchingById.add(String(job._id));
          if (matchingById.size >= BADGE_COUNT_CAP) break;
        }
        if (matchingById.size >= BADGE_COUNT_CAP) break;
      }

      jobsBadgeCount = matchingById.size;
    }

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .collect();
    const acceptedJobIds = [
      ...new Set(
        applications
          .filter((application) => application.status === "accepted")
          .map((application) => application.jobId),
      ),
    ];
    const acceptedJobs = await Promise.all(
      acceptedJobIds.map((jobId) => ctx.db.get("jobs", jobId)),
    );

    let calendarBadgeCount = 0;
    for (const job of acceptedJobs) {
      if (!job) continue;
      if (job.status === "cancelled" || job.status === "completed") continue;
      if (job.endTime <= now) continue;
      calendarBadgeCount += 1;
      if (calendarBadgeCount >= BADGE_COUNT_CAP) break;
    }

    return {
      jobsBadgeCount: clampBadgeCount(jobsBadgeCount),
      calendarBadgeCount: clampBadgeCount(calendarBadgeCount),
    };
  },
});

export const getStudioTabCounts = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.object({
    jobsBadgeCount: v.number(),
    calendarBadgeCount: v.number(),
  }),
  handler: async (ctx, args) => {
    let studio: Awaited<ReturnType<typeof requireStudioProfile>>;
    try {
      studio = await requireStudioProfile(ctx);
    } catch (error) {
      if (error instanceof ConvexError) {
        return { jobsBadgeCount: 0, calendarBadgeCount: 0 };
      }
      throw error;
    }
    const now = args.now ?? Date.now();
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
      .collect();
    const activeJobs = jobs.filter(
      (job) => (job.status === "open" || job.status === "filled") && job.endTime > now,
    );
    const activeJobIdSet = new Set(activeJobs.map((job) => String(job._id)));
    const calendarBadgeCount = clampBadgeCount(activeJobs.length);

    let jobsBadgeCount = 0;
    if (activeJobIdSet.size > 0) {
      if (USE_JOB_APPLICATION_STATS) {
        const stats = await ctx.db
          .query("jobApplicationStats")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect();

        for (const stat of stats) {
          if (!activeJobIdSet.has(String(stat.jobId))) continue;
          jobsBadgeCount += stat.pendingApplicationsCount;
          if (jobsBadgeCount >= BADGE_COUNT_CAP) break;
        }
      } else {
        const applications = await ctx.db
          .query("jobApplications")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect();
        for (const application of applications) {
          if (!activeJobIdSet.has(String(application.jobId))) continue;
          if (application.status !== "pending") continue;
          jobsBadgeCount += 1;
          if (jobsBadgeCount >= BADGE_COUNT_CAP) break;
        }
      }
    }

    return {
      jobsBadgeCount: clampBadgeCount(jobsBadgeCount),
      calendarBadgeCount,
    };
  },
});

async function requireInstructorProfile(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple instructor profiles found for this account");
  }
  const profile = profiles[0];

  if (!profile) throw new ConvexError("Instructor profile not found");

  return profile;
}

async function requireStudioProfile(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserRole(ctx, ["studio"]);
  const studios = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .take(2);
  if (studios.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  const studio = studios[0];

  if (!studio) throw new ConvexError("Studio profile not found");

  return studio;
}

async function recomputeJobApplicationStats(ctx: MutationCtx, job: Doc<"jobs">) {
  if (!USE_JOB_APPLICATION_STATS) return;

  const applications = await ctx.db
    .query("jobApplications")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .collect();

  const applicationsCount = applications.length;
  const pendingApplicationsCount = applications.filter(
    (application) => application.status === "pending",
  ).length;
  const existing = await ctx.db
    .query("jobApplicationStats")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .unique();
  const next = {
    studioId: job.studioId,
    applicationsCount,
    pendingApplicationsCount,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, next);
    return;
  }

  await ctx.db.insert("jobApplicationStats", {
    jobId: job._id,
    ...next,
  });
}

function toDisplayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_AUTO_EXPIRE_MINUTES = 30;
const BADGE_COUNT_CAP = 99;
const USE_JOB_APPLICATION_STATS = process.env.ENABLE_JOB_APPLICATION_STATS !== "0";
const USE_STUDIO_APPLICATIONS_BY_STUDIO = process.env.ENABLE_STUDIO_APPLICATIONS_BY_STUDIO !== "0";

function clampBadgeCount(value: number) {
  return Math.min(Math.max(value, 0), BADGE_COUNT_CAP);
}

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

  await ctx.scheduler.runAfter(0, internal.userPushNotifications.sendUserPushNotification, {
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
  });
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
      v.union(v.literal("hebrew"), v.literal("english"), v.literal("arabic"), v.literal("russian")),
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
    const studioZone = normalizeZoneId(normalizeRequired(studio.zone, "studio zone"));
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
      assertPositiveInteger(args.cancellationDeadlineHours, "cancellationDeadlineHours");
    }
    assertValidJobApplicationDeadline({
      now,
      startTime: args.startTime,
      applicationDeadline: args.applicationDeadline,
    });

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

    await ctx.scheduler.runAfter(0, internal.notifications.sendJobNotifications, { jobId });
    await ctx.scheduler.runAfter(
      Math.max(args.endTime - now, 0),
      internal.jobs.closeJobIfStillOpen,
      { jobId },
    );

    const expireMinutes = studio.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES;
    const expireAt = args.startTime - expireMinutes * 60 * 1000;
    const expireDelay = Math.max(expireAt - now, 0);
    if (expireAt > now) {
      await ctx.scheduler.runAfter(expireDelay, internal.jobs.autoExpireUnfilledJob, { jobId });
    }

    await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);

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
      studioImageUrl: v.optional(v.string()),
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

    const eligibility = await loadInstructorEligibility(ctx, instructor._id);
    if (eligibility.coverageCount === 0) {
      return [];
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const fetchPerPair = Math.min(
      Math.max(Math.ceil((limit * 2) / eligibility.coveragePairs.length), 8),
      80,
    );

    const openJobsByCoveragePair = await Promise.all(
      eligibility.coveragePairs.map(({ sport, zone }) =>
        ctx.db
          .query("jobs")
          .withIndex("by_sport_zone_status_postedAt", (q) =>
            q.eq("sport", sport).eq("zone", zone).eq("status", "open"),
          )
          .order("desc")
          .take(fetchPerPair),
      ),
    );

    const matchingById = new Map<Id<"jobs">, Doc<"jobs">>();
    for (const jobsForPair of openJobsByCoveragePair) {
      for (const job of jobsForPair) {
        const normalizedJobZone = trimOptionalString(job.zone);
        if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
          continue;
        }
        const zoneSetForSport = eligibility.coverageBySport.get(job.sport);
        if (!zoneSetForSport?.has(normalizedJobZone)) {
          continue;
        }
        if (job.startTime <= now) continue;
        if (job.applicationDeadline !== undefined && job.applicationDeadline < now) {
          continue;
        }
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
    const matchingJobIdSet = new Set(matchingJobs.map((job) => String(job._id)));
    const instructorApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .collect();

    for (const application of instructorApplications) {
      const jobId = String(application.jobId);
      if (!matchingJobIdSet.has(jobId)) continue;
      const existing = applicationByJobId.get(jobId);
      if (!existing) {
        applicationByJobId.set(jobId, application);
        continue;
      }
      const existingUpdatedAt = existing.updatedAt ?? existing.appliedAt;
      const nextUpdatedAt = application.updatedAt ?? application.appliedAt;
      if (nextUpdatedAt > existingUpdatedAt) {
        applicationByJobId.set(jobId, application);
      }
    }

    const studioIds = [...new Set(matchingJobs.map((job) => job.studioId))];
    const studioById = new Map<string, Doc<"studioProfiles">>();
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    const studioImageUrls = await Promise.all(
      studios.map((studio) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );
    const studioImageUrlById = new Map<string, string>();
    for (let i = 0; i < studioIds.length; i += 1) {
      const studioId = studioIds[i];
      const studio = studios[i];
      const studioImageUrl = studioImageUrls[i];
      if (studio) {
        studioById.set(String(studioId), studio);
      }
      if (studioImageUrl) {
        studioImageUrlById.set(String(studioId), studioImageUrl);
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
          studioImageUrl: studioImageUrlById.get(String(job.studioId)),
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
      paymentDetails: v.optional(
        v.object({
          status: v.string(),
          payoutStatus: v.optional(v.string()),
          externalInvoiceUrl: v.optional(v.string()),
        }),
      ),
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
      .withIndex("by_instructor_appliedAt", (q) => q.eq("instructorId", instructor._id))
      .order("desc")
      .take(limit);

    const applicationJobIds = getUniqueIdsInOrder(
      applications.map((application) => application.jobId),
    );
    const jobs = await Promise.all(applicationJobIds.map((jobId) => ctx.db.get("jobs", jobId)));
    const jobById = new Map<string, Doc<"jobs">>();
    for (let index = 0; index < applicationJobIds.length; index += 1) {
      const job = jobs[index];
      if (job) {
        jobById.set(String(applicationJobIds[index]), job);
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

    const paymentDetailsByJobId = await loadLatestPaymentDetailsByJobId(ctx, {
      jobIds: applicationJobIds
        .map((jobId) => jobById.get(String(jobId)))
        .filter((job): job is Doc<"jobs"> =>
          Boolean(job && (job.status === "completed" || job.status === "filled")),
        )
        .map((job) => job._id),
      instructorUserId: instructor.userId,
    });

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
          paymentDetails: paymentDetailsByJobId.get(String(job._id)),
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

    const [eligibility, job] = await Promise.all([
      loadInstructorEligibility(ctx, instructor._id),
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

    const normalizedJobZone = trimOptionalString(job.zone);
    if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
      throw new ConvexError("Job has invalid zone configuration");
    }
    if (!hasCoverageKey(eligibility, job.sport, normalizedJobZone)) {
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
        studioId: job.studioId,
        status: "pending",
        ...omitUndefined({ message }),
        updatedAt: now,
      });
      applicationId = existing._id;
    } else {
      applicationId = await ctx.db.insert("jobApplications", {
        jobId: args.jobId,
        studioId: job.studioId,
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

    await recomputeJobApplicationStats(ctx, job);

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
    const jobIds = new Set(jobs.map((job) => String(job._id)));
    const statsByJobId = new Map<string, Doc<"jobApplicationStats">>();
    const fallbackApplicationsByJobId = new Map<string, Doc<"jobApplications">[]>();
    if (USE_JOB_APPLICATION_STATS) {
      const stats = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
        .collect();
      for (const stat of stats) {
        const jobId = String(stat.jobId);
        if (!jobIds.has(jobId)) continue;
        statsByJobId.set(jobId, stat);
      }
    } else {
      const applicationsByJob = await Promise.all(
        jobs.map((job) =>
          ctx.db
            .query("jobApplications")
            .withIndex("by_job", (q) => q.eq("jobId", job._id))
            .collect(),
        ),
      );
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        if (!job) continue;
        fallbackApplicationsByJobId.set(String(job._id), applicationsByJob[i] ?? []);
      }
    }

    const rows = [];
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) continue;
      const stat = statsByJobId.get(String(job._id));

      rows.push({
        jobId: job._id,
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        applicationsCount:
          stat?.applicationsCount ??
          (fallbackApplicationsByJobId.get(String(job._id)) ?? []).length,
        pendingApplicationsCount:
          stat?.pendingApplicationsCount ??
          (fallbackApplicationsByJobId.get(String(job._id)) ?? []).filter(
            (application) => application.status === "pending",
          ).length,
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
    const jobIds = new Set(jobs.map((job) => String(job._id)));
    const statsByJobId = new Map<string, Doc<"jobApplicationStats">>();
    if (USE_JOB_APPLICATION_STATS) {
      const stats = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
        .collect();
      for (const stat of stats) {
        const jobId = String(stat.jobId);
        if (!jobIds.has(jobId)) continue;
        statsByJobId.set(jobId, stat);
      }
    }

    const studioApplications = USE_STUDIO_APPLICATIONS_BY_STUDIO
      ? await ctx.db
          .query("jobApplications")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect()
      : (
          await Promise.all(
            jobs.map((job) =>
              ctx.db
                .query("jobApplications")
                .withIndex("by_job", (q) => q.eq("jobId", job._id))
                .collect(),
            ),
          )
        ).flat();
    const applicationsByJobId = new Map<string, Doc<"jobApplications">[]>();
    for (const application of studioApplications) {
      const jobId = String(application.jobId);
      if (!jobIds.has(jobId)) continue;
      const existing = applicationsByJobId.get(jobId);
      if (existing) {
        existing.push(application);
      } else {
        applicationsByJobId.set(jobId, [application]);
      }
    }

    const instructorIds = [
      ...new Set(
        studioApplications
          .filter((application) => jobIds.has(String(application.jobId)))
          .map((application) => application.instructorId),
      ),
    ];
    const profiles = await Promise.all(
      instructorIds.map((instructorId) => ctx.db.get("instructorProfiles", instructorId)),
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
        applicationsByJobId.get(String(job._id)) ?? ([] as Doc<"jobApplications">[]);
      const stat = statsByJobId.get(String(job._id));

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
        applicationsCount: stat?.applicationsCount ?? applications.length,
        pendingApplicationsCount:
          stat?.pendingApplicationsCount ??
          applications.filter((a) => a.status === "pending").length,
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
      instructorId: v.optional(v.id("instructorProfiles")),
      instructorName: v.optional(v.string()),
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
      lifecycle: v.union(
        v.literal("upcoming"),
        v.literal("live"),
        v.literal("past"),
        v.literal("cancelled"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const getLifecycle = (
      status: Doc<"jobs">["status"],
      nowValue: number,
      startTime: number,
      endTime: number,
    ): "upcoming" | "live" | "past" | "cancelled" => {
      if (status === "cancelled") return "cancelled";
      if (nowValue < startTime) return "upcoming";
      if (nowValue <= endTime) return "live";
      return "past";
    };

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
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_filledByInstructor_startTime", (q) =>
          q
            .eq("filledByInstructorId", instructor._id)
            .gte("startTime", args.startTime)
            .lte("startTime", args.endTime),
        )
        .order("asc")
        .take(limit);

      const studioIds = [...new Set(jobs.map((job) => job.studioId))];
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

      return jobs.map((job) => {
        const studio = studioById.get(String(job.studioId));
        const lifecycle = getLifecycle(job.status, now, job.startTime, job.endTime);
        return {
          lessonId: job._id,
          roleView: "instructor" as const,
          studioId: job.studioId,
          studioName: studio?.studioName ?? "Unknown studio",
          instructorId: instructor._id,
          instructorName: instructor.displayName,
          sport: job.sport,
          zone: trimOptionalString(job.zone) ?? job.zone,
          startTime: job.startTime,
          endTime: job.endTime,
          pay: job.pay,
          status: job.status,
          lifecycle,
          ...omitUndefined({
            timeZone: job.timeZone,
            note: job.note,
          }),
        };
      });
    }

    const studio = await requireStudioProfile(ctx);
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_startTime", (q) =>
        q
          .eq("studioId", studio._id)
          .gte("startTime", args.startTime)
          .lte("startTime", args.endTime),
      )
      .order("asc")
      .take(limit);

    const instructorIds = [
      ...new Set(
        jobs
          .map((job) => job.filledByInstructorId)
          .filter((id): id is Id<"instructorProfiles"> => !!id),
      ),
    ];
    const instructors = await Promise.all(
      instructorIds.map((instructorId) => ctx.db.get("instructorProfiles", instructorId)),
    );
    const instructorById = new Map<string, Doc<"instructorProfiles">>();
    for (let i = 0; i < instructorIds.length; i += 1) {
      const instructorId = instructorIds[i];
      const profile = instructors[i];
      if (profile) {
        instructorById.set(String(instructorId), profile);
      }
    }

    return jobs.map((job) => {
      const instructor = job.filledByInstructorId
        ? instructorById.get(String(job.filledByInstructorId))
        : undefined;
      const lifecycle = getLifecycle(job.status, now, job.startTime, job.endTime);

      return {
        lessonId: job._id,
        roleView: "studio" as const,
        studioId: studio._id,
        studioName: studio.studioName,
        sport: job.sport,
        zone: trimOptionalString(job.zone) ?? job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        lifecycle,
        ...omitUndefined({
          instructorId: job.filledByInstructorId,
          instructorName: instructor?.displayName,
          timeZone: job.timeZone,
          note: job.note,
        }),
      };
    });
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

    if (application.status === args.status) {
      return { ok: true };
    }
    if (application.status === "accepted" && args.status === "rejected") {
      throw new ConvexError("Accepted application cannot be rejected");
    }

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

      for (const row of competingApplications) {
        await ctx.db.patch("jobApplications", row._id, {
          studioId: job.studioId,
          status: row._id === application._id ? "accepted" : "rejected",
          updatedAt: Date.now(),
        });
      }

      await ctx.runMutation(internal.jobs.runAcceptedApplicationReviewWorkflow, {
        jobId: job._id,
        acceptedApplicationId: application._id,
        studioUserId: studio.userId,
      });

      await recomputeJobApplicationStats(ctx, job);
    } else {
      await ctx.db.patch("jobApplications", application._id, {
        studioId: job.studioId,
        status: "rejected",
        updatedAt: Date.now(),
      });

      await ctx.runMutation(internal.jobs.runRejectedApplicationReviewWorkflow, {
        jobId: job._id,
        applicationId: application._id,
        studioUserId: studio.userId,
      });

      await recomputeJobApplicationStats(ctx, job);
    }

    return { ok: true };
  },
});

export const runAcceptedApplicationReviewWorkflow = internalMutation({
  args: {
    jobId: v.id("jobs"),
    acceptedApplicationId: v.id("jobApplications"),
    studioUserId: v.id("users"),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const [job, acceptedApplication] = await Promise.all([
      ctx.db.get("jobs", args.jobId),
      ctx.db.get("jobApplications", args.acceptedApplicationId),
    ]);
    if (!job || !acceptedApplication) {
      return { ok: false };
    }
    if (acceptedApplication.jobId !== job._id) {
      return { ok: false };
    }
    if (
      job.status !== "filled" ||
      job.filledByInstructorId !== acceptedApplication.instructorId ||
      acceptedApplication.status !== "accepted"
    ) {
      return { ok: false };
    }

    const competingApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    const uniqueInstructorIds = [...new Set(competingApplications.map((row) => row.instructorId))];
    const profiles = await Promise.all(
      uniqueInstructorIds.map((instructorId) => ctx.db.get("instructorProfiles", instructorId)),
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
      const profile = profileById.get(String(row.instructorId));
      if (!profile) continue;

      const isAccepted = row._id === acceptedApplication._id;
      await enqueueUserNotification(ctx, {
        recipientUserId: profile.userId,
        actorUserId: args.studioUserId,
        kind: isAccepted ? "application_accepted" : "application_rejected",
        title: isAccepted ? "Application accepted" : "Application rejected",
        body: isAccepted
          ? `You were assigned to teach ${toDisplayLabel(job.sport)}.`
          : `Another instructor was selected for ${toDisplayLabel(job.sport)}.`,
        jobId: job._id,
        applicationId: row._id,
      });
    }

    const now = Date.now();
    await ctx.scheduler.runAfter(
      Math.max(job.startTime - now, 0),
      internal.jobs.emitLessonLifecycleEvent,
      {
        jobId: job._id,
        instructorId: acceptedApplication.instructorId,
        event: "lesson_started",
      },
    );
    await ctx.scheduler.runAfter(
      Math.max(job.endTime - now, 0),
      internal.jobs.emitLessonLifecycleEvent,
      {
        jobId: job._id,
        instructorId: acceptedApplication.instructorId,
        event: "lesson_completed",
      },
    );
    const acceptedInstructorProfile = profileById.get(String(acceptedApplication.instructorId));
    await Promise.all([
      scheduleGoogleCalendarSyncForUser(ctx, args.studioUserId),
      scheduleGoogleCalendarSyncForUser(ctx, acceptedInstructorProfile?.userId),
    ]);

    return { ok: true };
  },
});

export const runRejectedApplicationReviewWorkflow = internalMutation({
  args: {
    jobId: v.id("jobs"),
    applicationId: v.id("jobApplications"),
    studioUserId: v.id("users"),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const [job, application] = await Promise.all([
      ctx.db.get("jobs", args.jobId),
      ctx.db.get("jobApplications", args.applicationId),
    ]);
    if (!job || !application) {
      return { ok: false };
    }
    if (application.jobId !== job._id || application.status !== "rejected") {
      return { ok: false };
    }

    const profile = await ctx.db.get("instructorProfiles", application.instructorId);
    if (!profile) {
      return { ok: false };
    }

    await enqueueUserNotification(ctx, {
      recipientUserId: profile.userId,
      actorUserId: args.studioUserId,
      kind: "application_rejected",
      title: "Application rejected",
      body: `The studio passed on your ${toDisplayLabel(job.sport)} application.`,
      jobId: job._id,
      applicationId: application._id,
    });

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
    const studio = await ctx.db.get("studioProfiles", job.studioId);
    await scheduleGoogleCalendarSyncForUser(ctx, studio?.userId);
    return { updated: true };
  },
});

export const autoExpireUnfilledJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.object({ expired: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      return { expired: false };
    }
    if (job.status !== "open") {
      return { expired: false };
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const expireMinutes = studio?.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES;
    const expireCutoff = job.startTime - expireMinutes * 60 * 1000;

    if (Date.now() < expireCutoff) {
      return { expired: false };
    }

    await ctx.db.patch("jobs", job._id, { status: "cancelled" });
    await scheduleGoogleCalendarSyncForUser(ctx, studio?.userId);

    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        kind: "lesson_completed",
        title: "Job expired",
        body: `Your ${toDisplayLabel(job.sport)} job was not filled and has been auto-cancelled.`,
        jobId: job._id,
      });
    }

    return { expired: true };
  },
});
