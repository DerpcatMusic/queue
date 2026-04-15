import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { APPLICATION_STATUSES, REQUIRED_LEVELS, SESSION_LANGUAGES } from "../constants";
import { requireUserRole } from "../lib/auth";
import { normalizeCapabilityTagArray, normalizeSportType } from "../lib/domainValidation";
import { getH3HierarchyFromCell } from "../lib/h3";
import {
  canInstructorPerformJobActions,
  getInstructorJobActionBlockReason,
  instructorJobActionBlockReasonValidator,
  loadInstructorComplianceSnapshot,
} from "../lib/instructorCompliance";
import {
  isInstructorEligibleForJobByCoverage,
  queryAvailableJobsForInstructorCoverage,
} from "../lib/instructorGeoCoverage";
import {
  ensureStudioInfrastructure,
  requireAccessibleStudioBranch,
  requireStudioOwnerContext,
} from "../lib/studioBranches";
import { assertStudioCanPublishJobs } from "../lib/studioCompliance";
import {
  assertPositiveInteger,
  assertValidJobApplicationDeadline,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";

export const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUSES);
export const REQUIRED_LEVEL_SET = new Set<string>(REQUIRED_LEVELS);
export const SESSION_LANGUAGE_SET = new Set<string>(SESSION_LANGUAGES);

export const BOOST_PRESETS = {
  small: 20,
  medium: 50,
  large: 100,
} as const;

export const BOOST_CUSTOM_MIN = 10;
export const BOOST_CUSTOM_MAX = 100;
export const BOOST_CUSTOM_STEP = 10;
export const BOOST_TRIGGER_MINUTES_OPTIONS = [15, 30, 45, 60, 90] as const;
export const LESSON_CHECK_IN_DEFAULT_RADIUS_METERS = 10;
export const LESSON_CHECK_IN_DISTANCE_BUFFER_METERS = 4;
export const LESSON_CHECK_IN_MAX_ACCURACY_METERS = 22;
export const LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS = 2 * 60 * 1000;
export const LESSON_CHECK_IN_WINDOW_BEFORE_MS = 45 * 60 * 1000;
export const LESSON_CHECK_IN_WINDOW_AFTER_MS = 30 * 60 * 1000;

export type LessonCheckInReason =
  | "verified"
  | "outside_radius"
  | "accuracy_too_low"
  | "sample_too_old"
  | "outside_check_in_window"
  | "branch_location_missing";

export type LessonCheckInSummary = {
  checkInStatus: "verified" | "rejected";
  checkInReason: LessonCheckInReason;
  checkedInAt: number;
  checkInDistanceMeters?: number;
};

export function assertPositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConvexError(`${fieldName} must be greater than 0`);
  }
}

export function normalizeTimeZone(value: string | undefined) {
  const trimmed = trimOptionalString(value);
  if (!trimmed) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(0);
  } catch {
    throw new ConvexError("Invalid timeZone");
  }
  return trimmed;
}

export function getLessonLifecycle(
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

export function getBranchArrivalRadiusMeters(branch: Doc<"studioBranches">) {
  if (Number.isFinite(branch.arrivalRadiusMeters) && branch.arrivalRadiusMeters! > 0) {
    return branch.arrivalRadiusMeters!;
  }
  return LESSON_CHECK_IN_DEFAULT_RADIUS_METERS;
}

export function getAllowedCheckInDistanceMeters(branch: Doc<"studioBranches">) {
  return getBranchArrivalRadiusMeters(branch) + LESSON_CHECK_IN_DISTANCE_BUFFER_METERS;
}

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(
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

export function toLessonCheckInSummary(
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

export async function loadLatestLessonCheckInSummary(
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

export async function enqueueUserNotification(
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
  return await ctx.runMutation(internal.notifications.core.deliverNotificationEvent, args);
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function getUniqueIdsInOrder<T extends string>(ids: ReadonlyArray<T>) {
  return [...new Set(ids)];
}

export async function scheduleGoogleCalendarSyncForUser(
  ctx: MutationCtx,
  userId: Id<"users"> | undefined,
) {
  if (!userId) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.calendar.googleCalendar.syncGoogleCalendarForUser, {
    userId,
  });
}

export async function loadLatestPaymentDetailsByJobId(
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

export function ensureOneOf(value: string, validValues: Set<string>, fieldName: string) {
  if (!validValues.has(value)) {
    throw new ConvexError(`Invalid ${fieldName}`);
  }
}

export async function requireInstructorProfile(ctx: QueryCtx | MutationCtx) {
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

export function assertInstructorCanPerformJobActions(args: {
  profile: Doc<"instructorProfiles">;
  compliance: Awaited<ReturnType<typeof loadInstructorComplianceSnapshot>>;
  sport: string;
  requiredCapabilityTags?: ReadonlyArray<string> | undefined;
}) {
  if (!canInstructorPerformJobActions(args)) {
    throw new ConvexError(JOB_ACTION_VERIFICATION_REQUIRED_ERROR);
  }
}

export async function requireStudioProfile(ctx: QueryCtx | MutationCtx) {
  const { studio } = await requireStudioOwnerContext(ctx);
  return studio;
}

export async function recomputeJobApplicationStats(ctx: MutationCtx, job: Doc<"jobs">) {
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

export function toDisplayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const DEFAULT_AUTO_EXPIRE_MINUTES = 30;
export const BADGE_COUNT_CAP = 99;
export const USE_JOB_APPLICATION_STATS = process.env.ENABLE_JOB_APPLICATION_STATS !== "0";
export const USE_STUDIO_APPLICATIONS_BY_STUDIO =
  process.env.ENABLE_STUDIO_APPLICATIONS_BY_STUDIO !== "0";
export const JOB_ACTION_VERIFICATION_REQUIRED_ERROR =
  "Complete instructor verification before job actions";

export function clampBadgeCount(value: number) {
  return Math.min(Math.max(value, 0), BADGE_COUNT_CAP);
}

export { internalMutation, mutation, query };
export { v };
export type { MutationCtx, QueryCtx, Doc, Id };
