"use node";

import { GeospatialIndex } from "@convex-dev/geospatial";
import { MINUTE, RateLimiter, SECOND } from "@convex-dev/rate-limiter";
import { WorkflowManager } from "@convex-dev/workflow";
import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

// ============================================================
// Workpool: Reliable background processing with retries
// ============================================================
// Handles AI document review with exponential backoff.
// If Gemini is temporarily down, reviews are retried automatically
// instead of getting stuck in ai_pending forever.

export const complianceWorkpool = new Workpool(components.complianceWorkpool, {
  // Limit concurrent reviews to avoid overwhelming Gemini API
  maxParallelism: 5,

  // Retry failed reviews automatically with backoff
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 5,
    initialBackoffMs: 5_000, // 5 seconds
    base: 2, // 5s, 10s, 20s, 40s between retries
  },
});

// ============================================================
// Workflow: Durable multi-step execution
// ============================================================
// Currently available for complex multi-step compliance flows.
// Not actively used by the review actions yet, but can be
// leveraged for multi-step verification or human-in-the-loop flows.

export const complianceWorkflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 5,
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 5_000,
      base: 2,
    },
  },
});

// ============================================================
// Rate Limiter: Protect Gemini API quota
// ============================================================
// Prevents a single instructor from uploading many documents
// and burning through the Gemini quota. Also protects against
// accidental runaway loops.

const GEMINI_REVIEW_WINDOW_SECONDS = 60;
const GEMINI_REVIEW_MAX_PER_INSTRUCTOR = 5;
const GEMINI_REVIEW_GLOBAL_MAX = 100;

export const geminiReviewRateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-instructor limit on AI review requests
  instructorReview: {
    kind: "fixed window",
    period: GEMINI_REVIEW_WINDOW_SECONDS * SECOND,
    rate: GEMINI_REVIEW_MAX_PER_INSTRUCTOR,
    capacity: GEMINI_REVIEW_MAX_PER_INSTRUCTOR + 2, // allow small burst
  },

  // Global limit to protect Gemini API budget
  globalReview: {
    kind: "token bucket",
    period: MINUTE,
    rate: GEMINI_REVIEW_GLOBAL_MAX,
    capacity: GEMINI_REVIEW_GLOBAL_MAX + 20,
  },
});

export const geospatial = new GeospatialIndex(components.geospatial);
