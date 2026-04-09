import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { APPLICATION_STATUSES, REQUIRED_LEVELS, SESSION_LANGUAGES } from "./constants";
import { requireUserRole } from "./lib/auth";
import {
  buildLegacyZoneBoundary,
  hasInstructorBoundarySubscription,
  listInstructorBoundarySubscriptionPairs,
} from "./lib/boundaries";
import {
  isKnownZoneId,
  normalizeCapabilityTagArray,
  normalizeSportType,
  normalizeZoneId,
} from "./lib/domainValidation";
import {
  canInstructorPerformJobActions,
  getInstructorJobActionBlockReason,
  instructorJobActionBlockReasonValidator,
  loadInstructorComplianceSnapshot,
} from "./lib/instructorCompliance";
import {
  hasCoverageKey,
  isEligibleForJob,
  loadInstructorEligibility,
} from "./lib/instructorEligibility";
import {
  ensureStudioInfrastructure,
  getPrimaryStudioBranch,
  requireAccessibleStudioBranch,
  requireStudioOwnerContext,
} from "./lib/studioBranches";
import { assertStudioCanPublishJobs } from "./lib/studioCompliance";
import {
  assertPositiveInteger,
  assertValidJobApplicationDeadline,
  omitUndefined,
  trimOptionalString,
} from "./lib/validation";

const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUSES);
const REQUIRED_LEVEL_SET = new Set<string>(REQUIRED_LEVELS);
const SESSION_LANGUAGE_SET = new Set<string>(SESSION_LANGUAGES);

const BOOST_PRESETS = {
  small: 20,
  medium: 50,
  large: 100,
} as const;

const BOOST_CUSTOM_MIN = 10;
const BOOST_CUSTOM_MAX = 100;
const BOOST_CUSTOM_STEP = 10;
const BOOST_TRIGGER_MINUTES_OPTIONS = [15, 30, 45, 60, 90] as const;
const LESSON_CHECK_IN_DEFAULT_RADIUS_METERS = 10;
const LESSON_CHECK_IN_DISTANCE_BUFFER_METERS = 4;
const LESSON_CHECK_IN_MAX_ACCURACY_METERS = 22;
const LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS = 2 * 60 * 1000;
const LESSON_CHECK_IN_WINDOW_BEFORE_MS = 45 * 60 * 1000;
const LESSON_CHECK_IN_WINDOW_AFTER_MS = 30 * 60 * 1000;

type LessonCheckInReason =
  | "verified"
  | "outside_radius"
  | "accuracy_too_low"
  | "sample_too_old"
  | "outside_check_in_window"
  | "branch_location_missing";

type LessonCheckInSummary = {
  checkInStatus: "verified" | "rejected";
  checkInReason: LessonCheckInReason;
  checkedInAt: number;
  checkInDistanceMeters?: number;
};

function assertPositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConvexError(`${fieldName} must be greater than 0`);
  }
}

function isOpenJobStillActionable(
  job: Doc<"jobs">,
  now: number,
) {
  if (job.startTime <= now) return false;
  if (
    typeof job.applicationDeadline === "number" &&
    Number.isFinite(job.applicationDeadline) &&
    job.applicationDeadline <= now
  ) {
    return false;
  }
  return true;
}

async function collectOpenJobsByBoundaryCoverage(
  ctx: QueryCtx,
  args: {
    sports: ReadonlySet<string>;
    boundaryPairs: ReadonlyArray<{ provider: string; boundaryId: string }>;
    now: number;
    limit: number;
  },
) {
  if (args.sports.size === 0 || args.boundaryPairs.length === 0) {
    return new Map<Id<"jobs">, Doc<"jobs">>();
  }

  const coveragePairs = [...args.sports].flatMap((sport) =>
    args.boundaryPairs.map(({ provider, boundaryId }) => ({
      sport,
      provider,
      boundaryId,
    })),
  );

  const fetchPerPair = Math.min(
    Math.max(Math.ceil((args.limit * 2) / coveragePairs.length), 8),
    80,
  );

  const jobsByPair = await Promise.all(
    coveragePairs.map(({ sport, provider, boundaryId }) =>
      ctx.db
        .query("jobs")
        .withIndex("by_sport_boundary_status_postedAt", (q) =>
          q
            .eq("sport", sport)
            .eq("boundaryProvider", provider)
            .eq("boundaryId", boundaryId)
            .eq("status", "open"),
        )
        .order("desc")
        .take(fetchPerPair),
    ),
  );

  const matchingById = new Map<Id<"jobs">, Doc<"jobs">>();
  for (const jobsForPair of jobsByPair) {
    for (const job of jobsForPair) {
      if (!isOpenJobStillActionable(job, args.now)) {
        continue;
      }
      matchingById.set(job._id, job);
    }
  }

  return matchingById;
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

function getLessonLifecycle(
  status: Doc<"jobs">["status"],
  nowValue: number,
  startTime: number,
  endTime: number,
): "upcoming" | "live" | "past" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  if (nowValue < startTime) return "upcoming";
  if (nowValue <= endTime) return "live";
  return "past";
}

function getBranchArrivalRadiusMeters(branch: Doc<"studioBranches">) {
  if (Number.isFinite(branch.arrivalRadiusMeters) && branch.arrivalRadiusMeters! > 0) {
    return branch.arrivalRadiusMeters!;
  }
  return LESSON_CHECK_IN_DEFAULT_RADIUS_METERS;
}

function getAllowedCheckInDistanceMeters(branch: Doc<"studioBranches">) {
  return getBranchArrivalRadiusMeters(branch) + LESSON_CHECK_IN_DISTANCE_BUFFER_METERS;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toLessonCheckInSummary(
  checkIn: Doc<"lessonCheckIns"> | null | undefined,
): LessonCheckInSummary | undefined {
  if (!checkIn) {
    return undefined;
  }

  return {
    checkInStatus: checkIn.verificationStatus,
    checkInReason: checkIn.verificationReason,
    checkedInAt: checkIn.checkedInAt,
    ...(checkIn.distanceToBranchMeters !== undefined
      ? { checkInDistanceMeters: checkIn.distanceToBranchMeters }
      : {}),
  };
}

async function loadLatestLessonCheckInSummary(
  ctx: QueryCtx | MutationCtx,
  args: {
    jobId: Id<"jobs">;
    instructorId: Id<"instructorProfiles"> | undefined;
  },
) {
  if (!args.instructorId) {
    return undefined;
  }

  const latestCheckIn = await ctx.db
    .query("lessonCheckIns")
    .withIndex("by_job_and_instructor", (q) =>
      q.eq("jobId", args.jobId).eq("instructorId", args.instructorId!),
    )
    .order("desc")
    .first();

  return toLessonCheckInSummary(latestCheckIn);
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
  return await ctx.runMutation(internal.notificationsCore.deliverNotificationEvent, args);
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

    const [eligibility, boundaryPairs] = await Promise.all([
      loadInstructorEligibility(ctx, instructor._id),
      listInstructorBoundarySubscriptionPairs(ctx, { instructorId: instructor._id }),
    ]);
    let jobsBadgeCount = 0;
    const matchingById = new Set<string>();

    if (boundaryPairs.length > 0 && eligibility.sports.size > 0) {
      const boundaryMatches = await collectOpenJobsByBoundaryCoverage(ctx, {
        sports: eligibility.sports,
        boundaryPairs,
        now,
        limit: BADGE_COUNT_CAP,
      });
      for (const job of boundaryMatches.values()) {
        matchingById.add(String(job._id));
        if (matchingById.size >= BADGE_COUNT_CAP) break;
      }
    }

    if (matchingById.size < BADGE_COUNT_CAP && eligibility.coverageCount > 0) {
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

      for (const jobsForPair of openJobsByCoveragePair) {
        for (const job of jobsForPair) {
          const normalizedJobZone = trimOptionalString(job.zone);
          if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
            continue;
          }
          if (!hasCoverageKey(eligibility, job.sport, normalizedJobZone)) {
            continue;
          }
          if (!isOpenJobStillActionable(job, now)) {
            continue;
          }

          matchingById.add(String(job._id));
          if (matchingById.size >= BADGE_COUNT_CAP) break;
        }
        if (matchingById.size >= BADGE_COUNT_CAP) break;
      }
    } else if (matchingById.size < BADGE_COUNT_CAP && eligibility.sports.size > 0) {
      const sports = [...eligibility.sports];
      const fetchPerSport = Math.min(
        Math.max(Math.ceil((BADGE_COUNT_CAP * 2) / sports.length), 8),
        60,
      );
      const openJobsBySport = await Promise.all(
        sports.map((sport) =>
          ctx.db
            .query("jobs")
            .withIndex("by_sport_and_status", (q) => q.eq("sport", sport).eq("status", "open"))
            .order("desc")
            .take(fetchPerSport),
        ),
      );

      const matchingById = new Set<string>();
      for (const jobsForSport of openJobsBySport) {
        for (const job of jobsForSport) {
          const normalizedJobZone = trimOptionalString(job.zone);
          if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
            continue;
          }
          if (!isEligibleForJob(eligibility, job.sport, normalizedJobZone)) {
            continue;
          }
          if (!isOpenJobStillActionable(job, now)) {
            continue;
          }

          matchingById.add(String(job._id));
          if (matchingById.size >= BADGE_COUNT_CAP) break;
        }
        if (matchingById.size >= BADGE_COUNT_CAP) break;
      }

    }

    jobsBadgeCount = matchingById.size;

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .take(200);
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
      .take(200);
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

function assertInstructorCanPerformJobActions(args: {
  profile: Doc<"instructorProfiles">;
  compliance: Awaited<ReturnType<typeof loadInstructorComplianceSnapshot>>;
  sport: string;
  requiredCapabilityTags?: ReadonlyArray<string> | undefined;
}) {
  if (!canInstructorPerformJobActions(args)) {
    throw new ConvexError(JOB_ACTION_VERIFICATION_REQUIRED_ERROR);
  }
}

async function requireStudioProfile(ctx: QueryCtx | MutationCtx) {
  const { studio } = await requireStudioOwnerContext(ctx);
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
    branchId: job.branchId,
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
const JOB_ACTION_VERIFICATION_REQUIRED_ERROR =
  "Complete instructor verification before job actions";

function clampBadgeCount(value: number) {
  return Math.min(Math.max(value, 0), BADGE_COUNT_CAP);
}

export const postJob = mutation({
  args: {
    branchId: v.id("studioBranches"),
    sport: v.string(),
    requiredCapabilityTags: v.optional(v.array(v.string())),
    preferredCapabilityTags: v.optional(v.array(v.string())),
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
    expiryOverrideMinutes: v.optional(v.number()),
    boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
    boostCustomAmount: v.optional(v.number()),
    boostTriggerMinutes: v.optional(v.number()),
  },
  returns: v.object({
    jobId: v.id("jobs"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    await assertStudioCanPublishJobs(ctx, studio);
    const { branch } = await requireAccessibleStudioBranch(ctx, {
      studioId: studio._id,
      branchId: args.branchId,
      allowedRoles: ["owner"],
    });
    await ensureStudioInfrastructure(ctx, studio, now);

    const sport = normalizeSportType(args.sport);
    const requiredCapabilityTags = normalizeCapabilityTagArray(args.requiredCapabilityTags);
    const preferredCapabilityTags = normalizeCapabilityTagArray(args.preferredCapabilityTags);
    const branchZone = normalizeZoneId(normalizeRequired(branch.zone, "branch zone"));
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

    // Validate boostPreset if provided
    if (args.boostPreset !== undefined && !(args.boostPreset in BOOST_PRESETS)) {
      throw new ConvexError(
        `Invalid boostPreset "${args.boostPreset}". Must be one of: ${Object.keys(BOOST_PRESETS).join(", ")}`,
      );
    }

    // Determine boost bonus amount: custom amount takes precedence over preset
    const hasBoost = args.boostPreset !== undefined || args.boostCustomAmount !== undefined;
    const boostBonusAmount =
      args.boostCustomAmount ?? (args.boostPreset ? BOOST_PRESETS[args.boostPreset] : undefined);
    const boostActive = hasBoost;

    // Validate boostCustomAmount if provided
    if (boostBonusAmount !== undefined) {
      if (boostBonusAmount < BOOST_CUSTOM_MIN || boostBonusAmount > BOOST_CUSTOM_MAX) {
        throw new ConvexError(
          `Invalid boostCustomAmount "${boostBonusAmount}". Must be between ${BOOST_CUSTOM_MIN} and ${BOOST_CUSTOM_MAX}.`,
        );
      }
      if (boostBonusAmount % BOOST_CUSTOM_STEP !== 0) {
        throw new ConvexError(
          `Invalid boostCustomAmount "${boostBonusAmount}". Must be a multiple of ${BOOST_CUSTOM_STEP}.`,
        );
      }
    }

    // Validate boostTriggerMinutes if provided
    if (args.boostTriggerMinutes !== undefined) {
      if (
        !BOOST_TRIGGER_MINUTES_OPTIONS.includes(
          args.boostTriggerMinutes as (typeof BOOST_TRIGGER_MINUTES_OPTIONS)[number],
        )
      ) {
        throw new ConvexError(
          `Invalid boostTriggerMinutes "${args.boostTriggerMinutes}". Must be one of: ${BOOST_TRIGGER_MINUTES_OPTIONS.join(", ")}.`,
        );
      }
    }

    const jobId = await ctx.db.insert("jobs", {
      studioId: studio._id,
      branchId: branch._id,
      zone: branchZone,
      ...buildLegacyZoneBoundary(branch.boundaryId ?? branchZone, branch.boundaryProvider),
      sport,
      startTime: args.startTime,
      endTime: args.endTime,
      pay: args.pay,
      status: "open",
      postedAt: now,
      ...omitUndefined({
        branchNameSnapshot: branch.name,
        branchAddressSnapshot: branch.address,
        requiredCapabilityTags,
        preferredCapabilityTags,
        timeZone,
        note: trimOptionalString(args.note),
        requiredLevel: args.requiredLevel,
        maxParticipants: args.maxParticipants,
        equipmentProvided: args.equipmentProvided,
        sessionLanguage: args.sessionLanguage,
        isRecurring: args.isRecurring,
        cancellationDeadlineHours: args.cancellationDeadlineHours,
        applicationDeadline: args.applicationDeadline,
        expiryOverrideMinutes: args.expiryOverrideMinutes,
        boostPreset: args.boostPreset,
        boostBonusAmount,
        boostActive,
        boostTriggerMinutes: args.boostTriggerMinutes,
        autoAcceptEnabled: branch.autoAcceptDefault ?? studio.autoAcceptDefault,
      }),
    });

    await ctx.scheduler.runAfter(0, internal.notifications.sendJobNotifications, { jobId });
    await ctx.scheduler.runAfter(
      Math.max(args.endTime - now, 0),
      internal.jobs.closeJobIfStillOpen,
      { jobId },
    );

    const expireMinutes =
      args.expiryOverrideMinutes ??
      branch.autoExpireMinutesBefore ??
      studio.autoExpireMinutesBefore ??
      DEFAULT_AUTO_EXPIRE_MINUTES;
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
      branchId: v.id("studioBranches"),
      studioName: v.string(),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
      studioImageUrl: v.optional(v.string()),
      studioAddress: v.optional(v.string()),
      sport: v.string(),
      zone: v.string(),
      boundaryProvider: v.optional(v.string()),
      boundaryId: v.optional(v.string()),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      pay: v.number(),
      note: v.optional(v.string()),
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
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
      ),
      boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
      boostBonusAmount: v.optional(v.number()),
      boostActive: v.optional(v.boolean()),
      canApplyToJob: v.boolean(),
      jobActionBlockedReason: v.optional(instructorJobActionBlockReasonValidator),
      applicationId: v.optional(v.id("jobApplications")),
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
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);

    const [eligibility, boundaryPairs] = await Promise.all([
      loadInstructorEligibility(ctx, instructor._id),
      listInstructorBoundarySubscriptionPairs(ctx, { instructorId: instructor._id }),
    ]);
    if (eligibility.coverageCount === 0 && eligibility.sports.size === 0 && boundaryPairs.length === 0) {
      return [];
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const matchingById = new Map<Id<"jobs">, Doc<"jobs">>();
    if (boundaryPairs.length > 0 && eligibility.sports.size > 0) {
      const boundaryMatches = await collectOpenJobsByBoundaryCoverage(ctx, {
        sports: eligibility.sports,
        boundaryPairs,
        now,
        limit,
      });
      for (const [jobId, job] of boundaryMatches.entries()) {
        matchingById.set(jobId, job);
      }
    }

    if (eligibility.coverageCount > 0) {
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
          if (!isOpenJobStillActionable(job, now)) {
            continue;
          }
          matchingById.set(job._id, job);
        }
      }
    } else {
      const sports = [...eligibility.sports];
      const fetchPerSport = Math.min(Math.max(Math.ceil((limit * 2) / sports.length), 8), 80);
      const openJobsBySport = await Promise.all(
        sports.map((sport) =>
          ctx.db
            .query("jobs")
            .withIndex("by_sport_and_status", (q) => q.eq("sport", sport).eq("status", "open"))
            .order("desc")
            .take(fetchPerSport),
        ),
      );

      for (const jobsForSport of openJobsBySport) {
        for (const job of jobsForSport) {
          const normalizedJobZone = trimOptionalString(job.zone);
          if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
            continue;
          }
          if (!isEligibleForJob(eligibility, job.sport, normalizedJobZone)) {
            continue;
          }
          if (!isOpenJobStillActionable(job, now)) {
            continue;
          }
          matchingById.set(job._id, job);
        }
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
      .take(100);

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
    const branchIds = [...new Set(matchingJobs.map((job) => job.branchId))];
    const studioById = new Map<string, Doc<"studioProfiles">>();
    const branchById = new Map<string, Doc<"studioBranches">>();
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
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
    for (let i = 0; i < branchIds.length; i += 1) {
      const branchId = branchIds[i];
      const branch = branches[i];
      if (branch) {
        branchById.set(String(branchId), branch);
      }
    }

    return matchingJobs.map((job) => {
      const studio = studioById.get(String(job.studioId));
      const branch = branchById.get(String(job.branchId));
      const application = applicationByJobId.get(String(job._id));
      const canApplyToJob = canInstructorPerformJobActions({
        profile: instructor,
        compliance,
        sport: job.sport,
        requiredCapabilityTags: job.requiredCapabilityTags,
      });
      const jobActionBlockedReason = getInstructorJobActionBlockReason({
        profile: instructor,
        compliance,
        sport: job.sport,
        requiredCapabilityTags: job.requiredCapabilityTags,
      });
      return {
        jobId: job._id,
        studioId: job.studioId,
        branchId: job.branchId,
        studioName: studio?.studioName ?? "Unknown studio",
        branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
        sport: job.sport,
        zone: trimOptionalString(job.zone) ?? job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        canApplyToJob,
        ...omitUndefined({
          boundaryProvider: job.boundaryProvider,
          boundaryId: job.boundaryId,
          studioImageUrl: studioImageUrlById.get(String(job.studioId)),
          branchAddress: job.branchAddressSnapshot ?? branch?.address,
          studioAddress: job.branchAddressSnapshot ?? branch?.address ?? studio?.address,
          timeZone: job.timeZone,
          note: job.note,
          requiredLevel: job.requiredLevel,
          maxParticipants: job.maxParticipants,
          equipmentProvided: job.equipmentProvided,
          sessionLanguage: job.sessionLanguage,
          isRecurring: job.isRecurring,
          cancellationDeadlineHours: job.cancellationDeadlineHours,
          applicationDeadline: job.applicationDeadline,
          closureReason: job.closureReason,
          boostPreset: job.boostPreset,
          boostBonusAmount: job.boostBonusAmount,
          boostActive: job.boostActive,
          jobActionBlockedReason,
          applicationId: application?._id,
          applicationStatus: application?.status,
        }),
      };
    });
  },
});

export const getStudioProfileForInstructor = query({
  args: {
    studioId: v.id("studioProfiles"),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      studioAddress: v.string(),
      zone: v.string(),
      boundaryProvider: v.optional(v.string()),
      boundaryId: v.optional(v.string()),
      bio: v.optional(v.string()),
      studioImageUrl: v.optional(v.string()),
      sports: v.array(v.string()),
      jobs: v.array(
        v.object({
          jobId: v.id("jobs"),
          studioId: v.id("studioProfiles"),
          branchId: v.id("studioBranches"),
          studioName: v.string(),
          branchName: v.string(),
          branchAddress: v.optional(v.string()),
          studioImageUrl: v.optional(v.string()),
          studioAddress: v.optional(v.string()),
          sport: v.string(),
          zone: v.string(),
          boundaryProvider: v.optional(v.string()),
          boundaryId: v.optional(v.string()),
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
          closureReason: v.optional(
            v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
          ),
          boostPreset: v.optional(
            v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
          ),
          boostBonusAmount: v.optional(v.number()),
          boostActive: v.optional(v.boolean()),
          canApplyToJob: v.boolean(),
          jobActionBlockedReason: v.optional(instructorJobActionBlockReasonValidator),
          applicationId: v.optional(v.id("jobApplications")),
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
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = args.now ?? Date.now();
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);
    const studio = await ctx.db.get("studioProfiles", args.studioId);

    if (!studio) {
      return null;
    }

    const [sportsRows, jobsForStudio, studioImageUrl, primaryBranch] = await Promise.all([
      ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", args.studioId))
        .collect(),
      ctx.db
        .query("jobs")
        .withIndex("by_studio_postedAt", (q) => q.eq("studioId", args.studioId))
        .order("desc")
        .take(40),
      studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      getPrimaryStudioBranch(ctx, args.studioId),
    ]);

    const visibleJobs: Doc<"jobs">[] = jobsForStudio.filter((job: Doc<"jobs">) => {
      if (job.status !== "open" || job.startTime <= now) {
        return false;
      }
      if (
        typeof job.applicationDeadline === "number" &&
        Number.isFinite(job.applicationDeadline) &&
        job.applicationDeadline <= now
      ) {
        return false;
      }
      return true;
    });
    const visibleJobIdSet = new Set(visibleJobs.map((job) => String(job._id)));

    const instructorApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .collect();
    const applicationByJobId = new Map<string, Doc<"jobApplications">>();
    for (const application of instructorApplications) {
      const jobId = String(application.jobId);
      if (!visibleJobIdSet.has(jobId)) continue;
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

    const branchIds = [...new Set(visibleJobs.map((job) => job.branchId))];
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
    );
    const branchById = new Map<string, Doc<"studioBranches">>();
    for (let index = 0; index < branchIds.length; index += 1) {
      const branchId = branchIds[index];
      const branch = branches[index];
      if (branch) {
        branchById.set(String(branchId), branch);
      }
    }

    return {
      studioId: studio._id,
      studioName: studio.studioName,
      studioAddress: primaryBranch?.address ?? studio.address,
      zone: primaryBranch?.zone ?? studio.zone,
      sports: [...new Set(sportsRows.map((row: Doc<"studioSports">) => row.sport))].sort(),
      ...omitUndefined({
        boundaryProvider: primaryBranch?.boundaryProvider ?? studio.boundaryProvider,
        boundaryId: primaryBranch?.boundaryId ?? studio.boundaryId,
        bio: studio.bio,
        studioImageUrl: studioImageUrl ?? undefined,
      }),
      jobs: visibleJobs.map((job: Doc<"jobs">) => {
        const application = applicationByJobId.get(String(job._id));
        const branch = branchById.get(String(job.branchId));
        const canApplyToJob = canInstructorPerformJobActions({
          profile: instructor,
          compliance,
          sport: job.sport,
          requiredCapabilityTags: job.requiredCapabilityTags,
        });
        const jobActionBlockedReason = getInstructorJobActionBlockReason({
          profile: instructor,
          compliance,
          sport: job.sport,
          requiredCapabilityTags: job.requiredCapabilityTags,
        });
        return {
          jobId: job._id,
          studioId: studio._id,
          branchId: job.branchId,
          studioName: studio.studioName,
          branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
          sport: job.sport,
          zone: trimOptionalString(job.zone) ?? job.zone,
          startTime: job.startTime,
          endTime: job.endTime,
          pay: job.pay,
          status: job.status,
          postedAt: job.postedAt,
          canApplyToJob,
          ...omitUndefined({
            boundaryProvider: job.boundaryProvider,
            boundaryId: job.boundaryId,
            studioImageUrl: studioImageUrl ?? undefined,
            branchAddress: job.branchAddressSnapshot ?? branch?.address,
            studioAddress: job.branchAddressSnapshot ?? branch?.address ?? studio.address,
            timeZone: job.timeZone,
            note: job.note,
            requiredLevel: job.requiredLevel,
            maxParticipants: job.maxParticipants,
            equipmentProvided: job.equipmentProvided,
            sessionLanguage: job.sessionLanguage,
            isRecurring: job.isRecurring,
            cancellationDeadlineHours: job.cancellationDeadlineHours,
            applicationDeadline: job.applicationDeadline,
            closureReason: job.closureReason,
            boostPreset: job.boostPreset,
            boostBonusAmount: job.boostBonusAmount,
            boostActive: job.boostActive,
            jobActionBlockedReason,
            applicationId: application?._id,
            applicationStatus: application?.status,
          }),
        };
      }),
    };
  },
});

export const getMyApplications = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      applicationId: v.id("jobApplications"),
      jobId: v.id("jobs"),
      instructorId: v.id("instructorProfiles"),
      studioId: v.id("studioProfiles"),
      branchId: v.id("studioBranches"),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("withdrawn"),
      ),
      appliedAt: v.number(),
      message: v.optional(v.string()),
      studioName: v.string(),
      branchName: v.string(),
      studioImageUrl: v.optional(v.string()),
      sport: v.string(),
      zone: v.string(),
      boundaryProvider: v.optional(v.string()),
      boundaryId: v.optional(v.string()),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      pay: v.number(),
      note: v.optional(v.string()),
      branchAddress: v.optional(v.string()),
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
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
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
    const branchIds = [...new Set(jobs.filter(isPresent).map((job) => job.branchId))];
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
    );
    const studioImageUrls = await Promise.all(
      studios.map((studio) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );
    const studioById = new Map<string, Doc<"studioProfiles">>();
    const branchById = new Map<string, Doc<"studioBranches">>();
    const studioImageUrlById = new Map<string, string>();
    for (let i = 0; i < studioIds.length; i += 1) {
      const studioId = studioIds[i];
      const studio = studios[i];
      if (studio) {
        studioById.set(String(studioId), studio);
      }
      const studioImageUrl = studioImageUrls[i];
      if (studioImageUrl) {
        studioImageUrlById.set(String(studioId), studioImageUrl);
      }
    }
    for (let i = 0; i < branchIds.length; i += 1) {
      const branchId = branchIds[i];
      const branch = branches[i];
      if (branch) {
        branchById.set(String(branchId), branch);
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
      const branch = branchById.get(String(job.branchId));

      rows.push({
        applicationId: application._id,
        jobId: application.jobId,
        instructorId: application.instructorId,
        studioId: job.studioId,
        branchId: job.branchId,
        status: application.status,
        appliedAt: application.appliedAt,
        studioName: studio?.studioName ?? "Unknown studio",
        branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        jobStatus: job.status,
        ...omitUndefined({
          boundaryProvider: job.boundaryProvider,
          boundaryId: job.boundaryId,
          message: application.message,
          branchAddress: job.branchAddressSnapshot ?? branch?.address,
          studioImageUrl: studioImageUrlById.get(String(job.studioId)),
          timeZone: job.timeZone,
          note: job.note,
          paymentDetails: paymentDetailsByJobId.get(String(job._id)),
          closureReason: job.closureReason,
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
    const now = Date.now();
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);
    assertInstructorCanPerformJobActions({
      profile: instructor,
      compliance,
      sport: job.sport,
      requiredCapabilityTags: job.requiredCapabilityTags,
    });

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const studioAutoAcceptEnabled = (studio as any)?.autoAcceptEnabled;
    const studioAutoAcceptDefault = studio?.autoAcceptDefault;
    const autoAcceptEnabled =
      job.autoAcceptEnabled ?? studioAutoAcceptEnabled ?? studioAutoAcceptDefault ?? false;
    const hasBoundaryEligibility =
      job.boundaryProvider && job.boundaryId
        ? await hasInstructorBoundarySubscription(ctx, {
            instructorId: instructor._id,
            provider: job.boundaryProvider,
            boundaryId: job.boundaryId,
          })
        : false;
    const normalizedJobZone = trimOptionalString(job.zone);
    const hasZoneEligibility =
      normalizedJobZone && isKnownZoneId(normalizedJobZone)
        ? isEligibleForJob(eligibility, job.sport, normalizedJobZone)
        : false;
    const canApplyByLocation = hasBoundaryEligibility || hasZoneEligibility;

    if (!autoAcceptEnabled) {
      if (job.status !== "open") throw new ConvexError("Job is not open");
      if (job.applicationDeadline !== undefined && now > job.applicationDeadline) {
        throw new ConvexError("Application deadline has passed");
      }
      if (now >= job.startTime) {
        throw new ConvexError("Job has already started");
      }
      if (!canApplyByLocation) {
        throw new ConvexError("You are not eligible for this job");
      }

      const existing = await ctx.db
        .query("jobApplications")
        .withIndex("by_job_and_instructor", (q) =>
          q.eq("jobId", args.jobId).eq("instructorId", instructor._id),
        )
        .unique();

      const message = trimOptionalString(args.message);

      if (existing) {
        if (existing.status === "accepted") {
          throw new ConvexError("Application already accepted");
        }

        await ctx.db.patch("jobApplications", existing._id, {
          studioId: job.studioId,
          branchId: job.branchId,
          status: "pending",
          ...omitUndefined({ message }),
          updatedAt: now,
        });

        if (studio) {
          await enqueueUserNotification(ctx, {
            recipientUserId: studio.userId,
            actorUserId: instructor.userId,
            kind: "application_received",
            title: "New application received",
            body: `${instructor.displayName} applied to teach ${toDisplayLabel(job.sport)}.`,
            jobId: job._id,
            applicationId: existing._id,
          });
        }

        await recomputeJobApplicationStats(ctx, job);
        return { applicationId: existing._id, status: "pending" as const };
      }

      const applicationId = await ctx.db.insert("jobApplications", {
        jobId: args.jobId,
        studioId: job.studioId,
        branchId: job.branchId,
        instructorId: instructor._id,
        status: "pending",
        appliedAt: now,
        updatedAt: now,
        ...omitUndefined({ message }),
      });

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
    }

    const existing = await ctx.db
      .query("jobApplications")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", args.jobId).eq("instructorId", instructor._id),
      )
      .unique();

    if (job.status !== "open") {
      const applicationId = await ctx.db.insert("jobApplications", {
        jobId: args.jobId,
        studioId: job.studioId,
        branchId: job.branchId,
        instructorId: instructor._id,
        status: "rejected",
        appliedAt: now,
        updatedAt: now,
      });
      return { applicationId, status: "rejected" as const };
    }

    if (!canApplyByLocation) {
      throw new ConvexError("You are not eligible for this job");
    }
    if (job.applicationDeadline !== undefined && now > job.applicationDeadline) {
      throw new ConvexError("Application deadline has passed");
    }
    if (now >= job.startTime) {
      throw new ConvexError("Job has already started");
    }

    const existingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_filledByInstructor_startTime", (q) =>
        q.eq("filledByInstructorId", instructor._id),
      )
      .collect();
    const hasConflict = existingJobs.some(
      (j) => j.status === "filled" && j.startTime < job.endTime && j.endTime > job.startTime,
    );
    if (hasConflict) {
      throw new ConvexError("Instructor has a conflicting booking at this time");
    }

    const message = trimOptionalString(args.message);

    if (existing) {
      if (existing.status === "accepted") {
        throw new ConvexError("Application already accepted");
      }
      await ctx.db.patch("jobApplications", existing._id, {
        studioId: job.studioId,
        branchId: job.branchId,
        status: "rejected",
        updatedAt: now,
      });
    }

    const applicationId = await ctx.db.insert("jobApplications", {
      jobId: args.jobId,
      studioId: job.studioId,
      branchId: job.branchId,
      instructorId: instructor._id,
      status: "accepted",
      appliedAt: now,
      updatedAt: now,
      ...omitUndefined({ message }),
    });

    await ctx.db.patch("jobs", job._id, {
      status: "filled",
      filledByInstructorId: instructor._id,
    });

    const competingApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const row of competingApplications) {
      if (row._id !== applicationId) {
        await ctx.db.patch("jobApplications", row._id, {
          studioId: job.studioId,
          branchId: job.branchId,
          status: "rejected",
          updatedAt: now,
        });
      }
    }

    if (studio) {
      await ctx.runMutation(internal.jobs.runAcceptedApplicationReviewWorkflow, {
        jobId: job._id,
        acceptedApplicationId: applicationId,
        studioUserId: studio.userId,
      });
    }

    await recomputeJobApplicationStats(ctx, job);
    return { applicationId, status: "accepted" as const };
  },
});

export const withdrawApplication = mutation({
  args: {
    applicationId: v.id("jobApplications"),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const application = await ctx.db.get("jobApplications", args.applicationId);

    if (!application) throw new ConvexError("Application not found");
    if (application.instructorId !== instructor._id) {
      throw new ConvexError("Not authorized to withdraw this application");
    }
    if (application.status !== "pending") {
      throw new ConvexError("Can only withdraw pending applications");
    }

    const now = Date.now();
    await ctx.db.patch("jobApplications", application._id, {
      status: "withdrawn",
      updatedAt: now,
    });

    const job = await ctx.db.get("jobs", application.jobId);
    if (job) {
      await recomputeJobApplicationStats(ctx, job);
    }

    return { ok: true };
  },
});

export const getMyStudioJobs = query({
  args: {
    limit: v.optional(v.number()),
    branchId: v.optional(v.id("studioBranches")),
  },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      branchId: v.id("studioBranches"),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
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
    if (args.branchId) {
      await requireAccessibleStudioBranch(ctx, {
        studioId: studio._id,
        branchId: args.branchId,
        allowedRoles: ["owner"],
      });
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const jobs = args.branchId
      ? await ctx.db
          .query("jobs")
          .withIndex("by_branch_postedAt", (q) => q.eq("branchId", args.branchId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("jobs")
          .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
          .order("desc")
          .take(limit);
    const branchIds = [...new Set(jobs.map((job) => job.branchId))];
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
    );
    const branchById = new Map<string, Doc<"studioBranches">>();
    for (let index = 0; index < branchIds.length; index += 1) {
      const branch = branches[index];
      if (branch) {
        branchById.set(String(branch._id), branch);
      }
    }
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
        branchId: job.branchId,
        branchName:
          job.branchNameSnapshot ?? branchById.get(String(job.branchId))?.name ?? "Main branch",
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
          branchAddress: job.branchAddressSnapshot ?? branchById.get(String(job.branchId))?.address,
          timeZone: job.timeZone,
          note: job.note,
        }),
      });
    }

    return rows;
  },
});

export const getMyStudioJobsWithApplications = query({
  args: {
    limit: v.optional(v.number()),
    branchId: v.optional(v.id("studioBranches")),
  },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      branchId: v.id("studioBranches"),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
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
      applicationDeadline: v.optional(v.number()),
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
      ),
      boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
      boostBonusAmount: v.optional(v.number()),
      boostActive: v.optional(v.boolean()),
      boostTriggerMinutes: v.optional(v.number()),
      applications: v.array(
        v.object({
          applicationId: v.id("jobApplications"),
          instructorId: v.id("instructorProfiles"),
          instructorName: v.string(),
          profileImageUrl: v.optional(v.string()),
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
    if (args.branchId) {
      await requireAccessibleStudioBranch(ctx, {
        studioId: studio._id,
        branchId: args.branchId,
        allowedRoles: ["owner"],
      });
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const jobs = args.branchId
      ? await ctx.db
          .query("jobs")
          .withIndex("by_branch_postedAt", (q) => q.eq("branchId", args.branchId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("jobs")
          .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
          .order("desc")
          .take(limit);
    const branchIds = [...new Set(jobs.map((job) => job.branchId))];
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
    );
    const branchById = new Map<string, Doc<"studioBranches">>();
    for (let index = 0; index < branchIds.length; index += 1) {
      const branch = branches[index];
      if (branch) {
        branchById.set(String(branch._id), branch);
      }
    }
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

    // Fetch profile image URLs for each instructor
    const profileImageUrlById = new Map<string, string | undefined>();
    for (const profile of profiles) {
      if (profile) {
        const imageUrl = profile.profileImageStorageId
          ? ((await ctx.storage.getUrl(profile.profileImageStorageId)) ?? undefined)
          : undefined;
        profileImageUrlById.set(String(profile._id), imageUrl);
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
        branchId: job.branchId,
        branchName:
          job.branchNameSnapshot ?? branchById.get(String(job.branchId))?.name ?? "Main branch",
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
          branchAddress: job.branchAddressSnapshot ?? branchById.get(String(job.branchId))?.address,
          timeZone: job.timeZone,
          note: job.note,
          applicationDeadline: job.applicationDeadline,
          closureReason: job.closureReason,
          boostPreset: job.boostPreset,
          boostBonusAmount: job.boostBonusAmount,
          boostActive: job.boostActive,
          boostTriggerMinutes: job.boostTriggerMinutes,
        }),
        applications: sortedApplications.map((application) => {
          const profile = profileById.get(String(application.instructorId));
          const profileImageUrl = profileImageUrlById.get(String(application.instructorId));
          return {
            applicationId: application._id,
            instructorId: application.instructorId,
            instructorName: profile?.displayName ?? "Unknown instructor",
            status: application.status,
            appliedAt: application.appliedAt,
            ...omitUndefined({
              profileImageUrl,
              message: application.message,
            }),
          };
        }),
      });
    }

    return rows;
  },
});

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

    const conflictingJobs: {
      jobId: Id<"jobs">;
      sport: string;
      studioName: string;
      startTime: number;
      endTime: number;
    }[] = [];

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
      const studioById = new Map<string, Doc<"studioProfiles">>();
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
          zone: trimOptionalString(job.zone) ?? job.zone,
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
    const jobs = allJobs.filter((job) => job.status !== "cancelled");

    const instructorIds = [
      ...new Set(
        jobs
          .map((job) => job.filledByInstructorId)
          .filter((id): id is Id<"instructorProfiles"> => !!id),
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
    const instructorById = new Map<string, Doc<"instructorProfiles">>();
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
        zone: trimOptionalString(job.zone) ?? job.zone,
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
      zone: v.string(),
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

    const studio = await ctx.db.get(job.studioId);
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
        zone: trimOptionalString(job.zone) ?? job.zone,
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
      ? await ctx.db.get(job.filledByInstructorId)
      : null;
    const latestCheckIn = await loadLatestLessonCheckInSummary(ctx, {
      jobId: job._id,
      instructorId: job.filledByInstructorId ?? undefined,
    });
    const instructorProfileImageUrl =
      instructor?.profileImageStorageId
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

export const checkIntoLesson = mutation({
  args: {
    jobId: v.id("jobs"),
    latitude: v.number(),
    longitude: v.number(),
    accuracyMeters: v.number(),
    sampledAt: v.number(),
  },
  returns: v.object({
    status: v.union(v.literal("verified"), v.literal("rejected")),
    reason: v.union(
      v.literal("verified"),
      v.literal("outside_radius"),
      v.literal("accuracy_too_low"),
      v.literal("sample_too_old"),
      v.literal("outside_check_in_window"),
      v.literal("branch_location_missing"),
    ),
    checkedInAt: v.number(),
    distanceToBranchMeters: v.optional(v.number()),
    allowedDistanceMeters: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.latitude) || !Number.isFinite(args.longitude)) {
      throw new ConvexError("Valid coordinates are required");
    }
    if (!Number.isFinite(args.accuracyMeters) || args.accuracyMeters < 0) {
      throw new ConvexError("accuracyMeters must be a valid non-negative number");
    }
    if (!Number.isFinite(args.sampledAt)) {
      throw new ConvexError("sampledAt must be a valid timestamp");
    }

    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized for this lesson");
    }
    if (job.status !== "filled") {
      throw new ConvexError("Only active filled lessons can be checked into");
    }

    const latestCheckIn = await ctx.db
      .query("lessonCheckIns")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", job._id).eq("instructorId", instructor._id),
      )
      .order("desc")
      .first();
    if (latestCheckIn?.verificationStatus === "verified") {
      return {
        status: latestCheckIn.verificationStatus,
        reason: latestCheckIn.verificationReason,
        checkedInAt: latestCheckIn.checkedInAt,
        ...omitUndefined({
          distanceToBranchMeters: latestCheckIn.distanceToBranchMeters,
          allowedDistanceMeters: latestCheckIn.allowedDistanceMeters,
        }),
      };
    }

    const branch = await ctx.db.get(job.branchId);
    if (!branch) {
      throw new ConvexError("Branch not found");
    }

    const now = Date.now();
    let verificationStatus: "verified" | "rejected" = "verified";
    let verificationReason: LessonCheckInReason = "verified";
    let distanceToBranchMeters: number | undefined;
    let allowedDistanceMeters: number | undefined;

    if (
      now < job.startTime - LESSON_CHECK_IN_WINDOW_BEFORE_MS ||
      now > Math.min(job.endTime, job.startTime + LESSON_CHECK_IN_WINDOW_AFTER_MS)
    ) {
      verificationStatus = "rejected";
      verificationReason = "outside_check_in_window";
    } else if (now - args.sampledAt > LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS) {
      verificationStatus = "rejected";
      verificationReason = "sample_too_old";
    } else if (args.accuracyMeters > LESSON_CHECK_IN_MAX_ACCURACY_METERS) {
      verificationStatus = "rejected";
      verificationReason = "accuracy_too_low";
    } else if (
      !Number.isFinite(branch.latitude) ||
      !Number.isFinite(branch.longitude)
    ) {
      verificationStatus = "rejected";
      verificationReason = "branch_location_missing";
    } else {
      distanceToBranchMeters = getDistanceMeters(
        { latitude: args.latitude, longitude: args.longitude },
        { latitude: branch.latitude!, longitude: branch.longitude! },
      );
      allowedDistanceMeters = getAllowedCheckInDistanceMeters(branch);

      if (distanceToBranchMeters > allowedDistanceMeters) {
        verificationStatus = "rejected";
        verificationReason = "outside_radius";
      }
    }

    const checkedInAt = now;
    await ctx.db.insert("lessonCheckIns", {
      jobId: job._id,
      branchId: branch._id,
      studioId: job.studioId,
      instructorId: instructor._id,
      checkedInByUserId: instructor.userId,
      verificationStatus,
      verificationReason,
      latitude: args.latitude,
      longitude: args.longitude,
      accuracyMeters: args.accuracyMeters,
      sampledAt: args.sampledAt,
      checkedInAt,
      ...omitUndefined({
        distanceToBranchMeters,
        allowedDistanceMeters,
      }),
    });

    return {
      status: verificationStatus,
      reason: verificationReason,
      checkedInAt,
      ...omitUndefined({
        distanceToBranchMeters,
        allowedDistanceMeters,
      }),
    };
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
      const instructorProfile = await ctx.db.get("instructorProfiles", application.instructorId);
      if (!instructorProfile) {
        throw new ConvexError("Instructor profile not found");
      }
      const now = Date.now();
      const compliance = await loadInstructorComplianceSnapshot(ctx, instructorProfile._id, now);
      assertInstructorCanPerformJobActions({
        profile: instructorProfile,
        compliance,
        sport: job.sport,
        requiredCapabilityTags: job.requiredCapabilityTags,
      });
      if (job.status !== "open") {
        throw new ConvexError("Job is not open");
      }
      if (now >= job.endTime) {
        throw new ConvexError("Job already ended");
      }
      const existingJobs = await ctx.db
        .query("jobs")
        .withIndex("by_filledByInstructor_startTime", (q) =>
          q.eq("filledByInstructorId", application.instructorId),
        )
        .collect();
      const hasConflict = existingJobs.some(
        (j) => j.status === "filled" && j.startTime < job.endTime && j.endTime > job.startTime,
      );
      if (hasConflict) {
        throw new ConvexError("Instructor has a conflicting booking at this time");
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
          branchId: job.branchId,
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
        branchId: job.branchId,
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
    await ctx.scheduler.runAfter(0, internal.notificationsCore.syncLessonReminderSchedulesForJob, {
      jobId: job._id,
    });
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
      await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
        jobId: job._id,
        reason: "lesson_completed",
      });
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
    await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "lesson_completed",
    });
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
    await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "job_closed",
    });
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
    const expireMinutes =
      job.expiryOverrideMinutes ?? studio?.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES;
    const expireCutoff = job.startTime - expireMinutes * 60 * 1000;

    if (Date.now() < expireCutoff) {
      return { expired: false };
    }

    await ctx.db.patch("jobs", job._id, {
      status: "cancelled",
      closureReason: "expired",
    });
    await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "job_expired",
    });
    await scheduleGoogleCalendarSyncForUser(ctx, studio?.userId);

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const application of applications) {
      if (application.status === "pending") {
        await ctx.db.patch("jobApplications", application._id, {
          status: "rejected",
          updatedAt: Date.now(),
        });
      }
    }

    await recomputeJobApplicationStats(ctx, job);

    for (const application of applications) {
      const instructor = await ctx.db.get("instructorProfiles", application.instructorId);
      if (instructor) {
        await enqueueUserNotification(ctx, {
          recipientUserId: instructor.userId,
          kind: "lesson_completed",
          title: "Job expired",
          body: `This job expired before an instructor was confirmed. Your application was not accepted.`,
          jobId: job._id,
        });
      }
    }

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

export const cancelMyBooking = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "filled") {
      throw new ConvexError("Job is not filled");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized to cancel this booking");
    }

    if (job.cancellationDeadlineHours !== undefined) {
      const deadline = job.startTime - job.cancellationDeadlineHours * 3600000;
      if (Date.now() > deadline) {
        throw new ConvexError("Cancellation deadline passed");
      }
    }

    await ctx.db.patch("jobs", job._id, {
      status: "cancelled",
      filledByInstructorId: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "booking_cancelled",
    });

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const application of applications) {
      if (application.instructorId === instructor._id && application.status === "accepted") {
        await ctx.db.patch("jobApplications", application._id, {
          status: "withdrawn",
          updatedAt: Date.now(),
        });
        break;
      }
    }

    await recomputeJobApplicationStats(ctx, job);

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        kind: "lesson_completed",
        title: "Booking cancelled",
        body: `${instructor.displayName} cancelled their booking for ${toDisplayLabel(job.sport)}.`,
        jobId: job._id,
      });
      // Google Calendar: real-time sync via server-side action
      await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);
      // Apple Calendar: deleted on next app open when syncEvents recomputes
      // without this cancelled job (buildSyncEvents filters status === "cancelled")
    }

    return { ok: true };
  },
});

export const cancelFilledJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    if (job.studioId !== studio._id) {
      throw new ConvexError("Not authorized to cancel this job");
    }

    // Handle open jobs - cancel directly without cancellation deadline check
    if (job.status === "open") {
      await ctx.db.patch("jobs", job._id, {
        status: "cancelled",
        closureReason: "studio_cancelled",
      });
      await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
        jobId: job._id,
        reason: "studio_cancelled",
      });

      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      const pendingApplications = applications.filter((a) => a.status === "pending");
      for (const application of pendingApplications) {
        await ctx.db.patch("jobApplications", application._id, {
          status: "rejected",
          updatedAt: Date.now(),
        });
      }

      await recomputeJobApplicationStats(ctx, job);

      for (const application of pendingApplications) {
        const instructor = await ctx.db.get("instructorProfiles", application.instructorId);
        if (instructor) {
          await enqueueUserNotification(ctx, {
            recipientUserId: instructor.userId,
            kind: "application_rejected",
            title: "Application rejected",
            body: `The studio cancelled this ${toDisplayLabel(job.sport)} job.`,
            jobId: job._id,
            applicationId: application._id,
          });
        }
      }

      await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);
      return { ok: true };
    }

    // Handle filled jobs - require cancellation deadline check
    if (job.status !== "filled") {
      throw new ConvexError("Job is not filled");
    }

    if (job.cancellationDeadlineHours !== undefined) {
      const deadline = job.startTime - job.cancellationDeadlineHours * 3600000;
      if (Date.now() > deadline) {
        throw new ConvexError("Cancellation deadline passed");
      }
    }

    await ctx.db.patch("jobs", job._id, {
      status: "cancelled",
      closureReason: "studio_cancelled",
    });
    await ctx.scheduler.runAfter(0, internal.notificationsCore.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "studio_cancelled",
    });

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    let acceptedInstructorProfile: Doc<"instructorProfiles"> | null = null;
    for (const application of applications) {
      if (application.status === "accepted") {
        await ctx.db.patch("jobApplications", application._id, {
          status: "rejected",
          updatedAt: Date.now(),
        });
        acceptedInstructorProfile = await ctx.db.get(
          "instructorProfiles",
          application.instructorId,
        );
        break;
      }
    }

    await recomputeJobApplicationStats(ctx, job);

    if (acceptedInstructorProfile) {
      await enqueueUserNotification(ctx, {
        recipientUserId: acceptedInstructorProfile.userId,
        kind: "lesson_completed",
        title: "Booking cancelled",
        body: `Your booking for ${toDisplayLabel(job.sport)} was cancelled by the studio${args.reason ? `: ${args.reason}` : "."}`,
        jobId: job._id,
      });
      await scheduleGoogleCalendarSyncForUser(ctx, acceptedInstructorProfile.userId);
    }

    await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);
    // Google Calendar: real-time sync via server-side action (above)
    // Apple Calendar: deleted on next app open when syncEvents recomputes
    // without this cancelled job (buildSyncEvents filters status === "cancelled")

    return { ok: true };
  },
});

/**
 * Auto-cleanup of old cancelled jobs to prevent database bloat.
 * Deletes cancelled jobs older than the retention period and their associated applications.
 * Runs as a cron job - not exposed as a public API.
 */
export const cleanupCancelledJobs = internalMutation({
  args: {
    /** Minimum age in milliseconds before a cancelled job is deleted (default: 7 days) */
    minAgeMs: v.optional(v.number()),
    /** Maximum number of jobs to delete in one run to avoid timeouts (default: 100) */
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedJobs: v.number(),
    deletedApplications: v.number(),
  }),
  handler: async (ctx, args) => {
    const minAgeMs = args.minAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    const batchSize = args.batchSize ?? 100;
    const cutoffTime = Date.now() - minAgeMs;

    // Find cancelled jobs older than cutoff
    const cancelledJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "cancelled"))
      .filter((q) => q.lt(q.field("startTime"), cutoffTime))
      .take(batchSize);

    if (cancelledJobs.length === 0) {
      return { deletedJobs: 0, deletedApplications: 0 };
    }

    const jobIds = cancelledJobs.map((job) => job._id);
    let deletedApplications = 0;

    // Delete associated job applications first (foreign key constraint)
    for (const jobId of jobIds) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect();

      for (const application of applications) {
        await ctx.db.delete(application._id);
        deletedApplications++;
      }

      // Delete the job itself
      await ctx.db.delete(jobId);
    }

    return {
      deletedJobs: cancelledJobs.length,
      deletedApplications,
    };
  },
});
