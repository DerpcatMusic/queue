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
  internal.jobs.cleanupCancelledJobs,
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
  internal.security.cleanupExpiredRateLimits,
  {},
);

/**
 * Cleanup old webhook payloads to save storage.
 * Runs daily at 1 AM UTC.
 * Full payloads older than 30 days are replaced with hashes only.
 */
crons.cron(
  "cleanup old webhook payloads",
  "0 1 * * *", // Every day at 1 AM UTC
  internal.webhookSecurity.cleanupStaleWebhookArtifacts,
  { olderThanMs: 30 * 24 * 60 * 60 * 1000 }, // 30 days retention
);

crons.cron(
  "process instructor insurance renewals",
  "0 7 * * *", // Every day at 7 AM UTC
  internal.complianceReview.processInsuranceRenewalChecks,
  {},
);

export default crons;
