import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Cleanup old cancelled jobs to prevent database bloat.
 * Runs daily at midnight UTC.
 * Cancelled jobs are deleted after 7 days (configurable via minAgeMs).
 */
crons.interval(
  "cleanup cancelled jobs",
  { hours: 1 },
  internal.jobs.cancellation.cleanupCancelledJobs,
  { minAgeMs: 7 * 24 * 60 * 60 * 1000 }, // 7 days retention
);

/**
 * Cleanup expired rate limit records.
 * Runs every 15 minutes.
 * Removes rate limit records where the blocking period has expired.
 */
crons.interval(
  "cleanup expired rate limits",
  { minutes: 15 },
  internal.security.rateLimits.cleanupExpiredRateLimits,
  {},
);

crons.cron(
  "process instructor insurance renewals",
  "0 7 * * *", // Every day at 7 AM UTC
  internal.compliance.instructorReview.processInsuranceRenewalChecks,
  {},
);

crons.interval(
  "process due notification schedules",
  { minutes: 5 },
  internal.notifications.core.processDueNotificationSchedules,
  {},
);

crons.interval(
  "enforce overdue studio settlements",
  { minutes: 30 },
  internal.jobs.settlement.enforceOverdueSettlementStates,
  {},
);

crons.interval(
  "release recovered studio payment blocks",
  { minutes: 30 },
  internal.jobs.settlement.releaseRecoveredStudioPaymentBlocks,
  {},
);

export default crons;
