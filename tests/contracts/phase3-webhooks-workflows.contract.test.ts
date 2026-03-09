import { describe, expect, it } from "bun:test";

import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { processDiditWebhookEvent } from "../../convex/didit";
import {
  closeJobIfStillOpen,
  postJob,
  reviewApplication,
  runAcceptedApplicationReviewWorkflow,
  runRejectedApplicationReviewWorkflow,
} from "../../convex/jobs";
import { diditWebhook } from "../../convex/webhooks";
import {
  type ScheduledCall,
  InMemoryConvexDb,
  createMutationCtx,
} from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sortKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeysRecursively(record[key])]),
    );
  }
  return value;
}

function shortenFloatsRecursively(value: unknown): unknown {
  if (typeof value === "number" && !Number.isInteger(value)) {
    return Number(value.toFixed(3));
  }
  if (Array.isArray(value)) {
    return value.map(shortenFloatsRecursively);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, inner]) => [key, shortenFloatsRecursively(inner)]),
    );
  }
  return value;
}

describe("phase-3 webhook contracts", () => {
  it("records invalid-signature DIDIT events once and keeps duplicate-event behavior stable", async () => {
    const db = new InMemoryConvexDb();
    const baseArgs = {
      providerEventId: "didit-event-1",
      sessionId: "sess-1",
      statusRaw: "approved",
      vendorData: "users:1",
      decision: { result: "approved" },
      payloadHash: "hash-1",
      payload: { nested: { value: 1 } },
    };

    const first = await (processDiditWebhookEvent as any)._handler(
      { db },
      { ...baseArgs, signatureValid: false },
    );
    expect(first).toEqual({ ignored: true, reason: "invalid_signature" });

    const rowsAfterFirst = db.list("diditEvents");
    expect(rowsAfterFirst).toHaveLength(1);
    expect(rowsAfterFirst[0]?.providerEventId).toBe("didit-event-1");
    expect(rowsAfterFirst[0]?.processed).toBe(false);
    expect(rowsAfterFirst[0]?.processingError).toBe("invalid_signature");

    const second = await (processDiditWebhookEvent as any)._handler(
      { db },
      { ...baseArgs, signatureValid: true },
    );
    expect(second).toEqual({ ignored: true, reason: "duplicate_event" });

    const rowsAfterSecond = db.list("diditEvents");
    expect(rowsAfterSecond).toHaveLength(1);
    expect(rowsAfterSecond[0]?.processingError).toBe("invalid_signature");
  });

  it("keeps DIDIT canonical payload-signature verification boundary stable", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    const originalSecret = process.env.DIDIT_WEBHOOK_SECRET;
    const originalSkew = process.env.DIDIT_WEBHOOK_MAX_SKEW_SECONDS;
    try {
      process.env.DIDIT_WEBHOOK_SECRET = "test-secret";
      process.env.DIDIT_WEBHOOK_MAX_SKEW_SECONDS = "300";

      const payload = {
        vendor_data: "users:1",
        data: {
          session_id: "didit-session-1",
          webhook_type: "decision",
          status: "approved",
          timestamp: String(Math.floor(FIXED_NOW / 1000)),
          score: 0.1234567,
        },
        decision: {
          id_verifications: [
            {
              first_name: "Jane",
              last_name: "Doe",
              confidence: 99.99995,
            },
          ],
        },
        event_id: "didit-event-2",
      };

      const timestamp = String(Math.floor(FIXED_NOW / 1000));
      const canonicalJson = JSON.stringify(
        sortKeysRecursively(shortenFloatsRecursively(payload)),
      );
      const signature = await hmacSha256Hex(
        process.env.DIDIT_WEBHOOK_SECRET ?? "",
        `${canonicalJson}:${timestamp}`,
      );

      const runMutationCalls: unknown[] = [];
      const ctx = {
        runMutation: async (_fn: unknown, args: unknown) => {
          runMutationCalls.push(args);
          return { ignored: false, processed: true };
        },
      };

      const req = new Request("https://example.test/webhooks/didit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-timestamp": timestamp,
          "x-signature-v2": `sha256=${signature}`,
        },
        body: JSON.stringify(payload),
      });

      const response = await (diditWebhook as any)._handler(ctx, req);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        received: true,
        signatureValid: true,
        timestampValid: true,
      });
      expect(runMutationCalls).toHaveLength(2);
      const forwardedCall = runMutationCalls.find(
        (call) =>
          typeof call === "object" &&
          call !== null &&
          "payloadHash" in (call as Record<string, unknown>),
      ) as Record<string, unknown> | undefined;
      expect(forwardedCall).toBeDefined();
      expect(forwardedCall?.payload).toEqual({
        event_id: "didit-event-2",
        vendor_data: "users:1",
        data: {
          session_id: "didit-session-1",
          webhook_type: "decision",
          status: "approved",
          timestamp,
        },
      });
    } finally {
      restoreNow();
      process.env.DIDIT_WEBHOOK_SECRET = originalSecret;
      process.env.DIDIT_WEBHOOK_MAX_SKEW_SECONDS = originalSkew;
    }
  });
});

describe("phase-3 reviewApplication workflow parity contracts", () => {
  async function seedReviewScenario(db: InMemoryConvexDb) {
    const studioUserId = (await db.insert("users", {
      role: "studio",
      onboardingComplete: true,
      isActive: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;
    const instructorUserA = (await db.insert("users", {
      role: "instructor",
      onboardingComplete: true,
      isActive: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;
    const instructorUserB = (await db.insert("users", {
      role: "instructor",
      onboardingComplete: true,
      isActive: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;

    const studioId = (await db.insert("studioProfiles", {
      userId: studioUserId,
      studioName: "Studio",
      address: "Main st",
      zone: "5001557",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioProfiles">;

    const instructorA = (await db.insert("instructorProfiles", {
      userId: instructorUserA,
      displayName: "Instructor A",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"instructorProfiles">;
    const instructorB = (await db.insert("instructorProfiles", {
      userId: instructorUserB,
      displayName: "Instructor B",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"instructorProfiles">;

    const jobId = (await db.insert("jobs", {
      studioId,
      zone: "5001557",
      sport: "hiit",
      startTime: FIXED_NOW + 30 * 60 * 1000,
      endTime: FIXED_NOW + 90 * 60 * 1000,
      pay: 250,
      status: "open",
      postedAt: FIXED_NOW - 10 * 60 * 1000,
    })) as Id<"jobs">;

    const applicationA = (await db.insert("jobApplications", {
      jobId,
      instructorId: instructorA,
      status: "pending",
      appliedAt: FIXED_NOW - 8 * 60 * 1000,
      updatedAt: FIXED_NOW - 8 * 60 * 1000,
    })) as Id<"jobApplications">;
    const applicationB = (await db.insert("jobApplications", {
      jobId,
      instructorId: instructorB,
      status: "pending",
      appliedAt: FIXED_NOW - 7 * 60 * 1000,
      updatedAt: FIXED_NOW - 7 * 60 * 1000,
    })) as Id<"jobApplications">;

    return {
      studioUserId,
      jobId,
      applicationA,
      applicationB,
      instructorUserA,
      instructorUserB,
      instructorA,
      instructorB,
    };
  }

  it("accept path keeps side-effect fanout parity (notifications + push scheduling + lifecycle scheduling)", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedReviewScenario(db);
      const schedulerCalls: ScheduledCall[] = [];
      const runMutationCalls: { fn: unknown; args: unknown }[] = [];
      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
        runMutationCalls,
        runMutationImpl: async (_fn, runArgs, workflowCtx) => {
          if (
            runArgs &&
            typeof runArgs === "object" &&
            "acceptedApplicationId" in runArgs
          ) {
            return await (runAcceptedApplicationReviewWorkflow as any)._handler(
              workflowCtx,
              runArgs,
            );
          }
          if (
            runArgs &&
            typeof runArgs === "object" &&
            "applicationId" in runArgs
          ) {
            return await (runRejectedApplicationReviewWorkflow as any)._handler(
              workflowCtx,
              runArgs,
            );
          }
          throw new Error("Unexpected runMutation target in test");
        },
      });

      await expect(
        (reviewApplication as any)._handler(ctx, {
          applicationId: seeded.applicationA,
          status: "accepted",
        }),
      ).resolves.toEqual({ ok: true });

      const job = await db.get("jobs", seeded.jobId);
      expect(job?.status).toBe("filled");
      expect(job?.filledByInstructorId).toBe(seeded.instructorA);

      const appA = await db.get("jobApplications", seeded.applicationA);
      const appB = await db.get("jobApplications", seeded.applicationB);
      expect(appA?.status).toBe("accepted");
      expect(appB?.status).toBe("rejected");

      const notifications = db.list("userNotifications");
      expect(notifications).toHaveLength(2);
      expect(notifications.map((row) => row.kind).sort()).toEqual([
        "application_accepted",
        "application_rejected",
      ]);

      const pushCalls = schedulerCalls.filter(
        (call) =>
          call.args &&
          typeof call.args === "object" &&
          "userId" in (call.args as Record<string, unknown>) &&
          "data" in (call.args as Record<string, unknown>),
      );
      expect(pushCalls).toHaveLength(2);
      expect(pushCalls.every((call) => call.delayMs === 0)).toBe(true);

      const lifecycleCalls = schedulerCalls.filter(
        (call) =>
          call.args &&
          typeof call.args === "object" &&
          "event" in (call.args as Record<string, unknown>) &&
          "instructorId" in (call.args as Record<string, unknown>),
      );
      expect(lifecycleCalls).toHaveLength(2);
      expect(lifecycleCalls.map((call) => call.delayMs).sort((a, b) => a - b)).toEqual([
        30 * 60 * 1000,
        90 * 60 * 1000,
      ]);
      const calendarSyncCalls = schedulerCalls.filter(
        (call) =>
          call.args &&
          typeof call.args === "object" &&
          "userId" in (call.args as Record<string, unknown>) &&
          !("data" in (call.args as Record<string, unknown>)) &&
          !("event" in (call.args as Record<string, unknown>)),
      );
      expect(calendarSyncCalls).toHaveLength(2);
      expect(calendarSyncCalls.every((call) => call.delayMs === 0)).toBe(true);
      expect(calendarSyncCalls.map((call) => call.args)).toContainEqual({
        userId: seeded.instructorUserA,
      });
      expect(calendarSyncCalls.map((call) => call.args)).toContainEqual({
        userId: seeded.studioUserId,
      });
      expect(runMutationCalls).toHaveLength(1);
      expect(
        runMutationCalls[0] &&
          typeof runMutationCalls[0].args === "object" &&
          runMutationCalls[0].args !== null &&
          "acceptedApplicationId" in (runMutationCalls[0].args as Record<string, unknown>),
      ).toBe(true);

      const stats = db.list("jobApplicationStats");
      expect(stats).toHaveLength(1);
      expect(stats[0]?.applicationsCount).toBe(2);
      expect(stats[0]?.pendingApplicationsCount).toBe(0);
    } finally {
      restoreNow();
    }
  });

  it("reject path keeps side-effect parity (single rejection notification + no lifecycle scheduling)", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedReviewScenario(db);
      const schedulerCalls: ScheduledCall[] = [];
      const runMutationCalls: { fn: unknown; args: unknown }[] = [];
      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
        runMutationCalls,
        runMutationImpl: async (_fn, runArgs, workflowCtx) => {
          if (
            runArgs &&
            typeof runArgs === "object" &&
            "acceptedApplicationId" in runArgs
          ) {
            return await (runAcceptedApplicationReviewWorkflow as any)._handler(
              workflowCtx,
              runArgs,
            );
          }
          if (
            runArgs &&
            typeof runArgs === "object" &&
            "applicationId" in runArgs
          ) {
            return await (runRejectedApplicationReviewWorkflow as any)._handler(
              workflowCtx,
              runArgs,
            );
          }
          throw new Error("Unexpected runMutation target in test");
        },
      });

      await expect(
        (reviewApplication as any)._handler(ctx, {
          applicationId: seeded.applicationA,
          status: "rejected",
        }),
      ).resolves.toEqual({ ok: true });

      const job = await db.get("jobs", seeded.jobId);
      expect(job?.status).toBe("open");
      expect(job?.filledByInstructorId).toBeUndefined();

      const appA = await db.get("jobApplications", seeded.applicationA);
      const appB = await db.get("jobApplications", seeded.applicationB);
      expect(appA?.status).toBe("rejected");
      expect(appB?.status).toBe("pending");

      const notifications = db.list("userNotifications");
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.kind).toBe("application_rejected");

      const pushCalls = schedulerCalls.filter(
        (call) =>
          call.args &&
          typeof call.args === "object" &&
          "userId" in (call.args as Record<string, unknown>) &&
          "data" in (call.args as Record<string, unknown>),
      );
      expect(pushCalls).toHaveLength(1);

      const lifecycleCalls = schedulerCalls.filter(
        (call) =>
          call.args &&
          typeof call.args === "object" &&
          "event" in (call.args as Record<string, unknown>) &&
          "instructorId" in (call.args as Record<string, unknown>),
      );
      expect(lifecycleCalls).toHaveLength(0);
      expect(runMutationCalls).toHaveLength(1);
      expect(
        runMutationCalls[0] &&
          typeof runMutationCalls[0].args === "object" &&
          runMutationCalls[0].args !== null &&
          "applicationId" in (runMutationCalls[0].args as Record<string, unknown>),
      ).toBe(true);

      const stats = db.list("jobApplicationStats");
      expect(stats).toHaveLength(1);
      expect(stats[0]?.applicationsCount).toBe(2);
      expect(stats[0]?.pendingApplicationsCount).toBe(1);
    } finally {
      restoreNow();
    }
  });

  it("create job schedules a Google Calendar sync for the posting studio", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const studioUserId = (await db.insert("users", {
        role: "studio",
        onboardingComplete: true,
        isActive: true,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })) as Id<"users">;
      await db.insert("studioProfiles", {
        userId: studioUserId,
        studioName: "Studio",
        address: "Main st",
        zone: "5001557",
        notificationsEnabled: true,
        autoExpireMinutesBefore: 30,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      const schedulerCalls: ScheduledCall[] = [];
      const ctx = createMutationCtx({
        db,
        userId: studioUserId,
        schedulerCalls,
      });

      await expect(
        (postJob as any)._handler(ctx, {
          sport: "hiit",
          startTime: FIXED_NOW + 2 * 60 * 60 * 1000,
          endTime: FIXED_NOW + 3 * 60 * 60 * 1000,
          pay: 250,
        }),
      ).resolves.toEqual({
        jobId: expect.any(String),
      });

      expect(schedulerCalls).toContainEqual({
        delayMs: 0,
        fn: internal.calendar.syncGoogleCalendarForUser,
        args: { userId: studioUserId },
      });
    } finally {
      restoreNow();
    }
  });

  it("closing an open job schedules a Google Calendar removal sync for the studio", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const studioUserId = (await db.insert("users", {
        role: "studio",
        onboardingComplete: true,
        isActive: true,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })) as Id<"users">;
      const studioId = (await db.insert("studioProfiles", {
        userId: studioUserId,
        studioName: "Studio",
        address: "Main st",
        zone: "5001557",
        notificationsEnabled: true,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })) as Id<"studioProfiles">;
      const jobId = (await db.insert("jobs", {
        studioId,
        zone: "5001557",
        sport: "hiit",
        startTime: FIXED_NOW - 2 * 60 * 60 * 1000,
        endTime: FIXED_NOW - 60 * 60 * 1000,
        pay: 250,
        status: "open",
        postedAt: FIXED_NOW - 3 * 60 * 60 * 1000,
      })) as Id<"jobs">;

      const schedulerCalls: ScheduledCall[] = [];
      const ctx = createMutationCtx({ db, schedulerCalls });

      await expect((closeJobIfStillOpen as any)._handler(ctx, { jobId })).resolves.toEqual({
        updated: true,
      });

      const job = await db.get("jobs", jobId);
      expect(job?.status).toBe("cancelled");
      expect(schedulerCalls).toContainEqual({
        delayMs: 0,
        fn: internal.calendar.syncGoogleCalendarForUser,
        args: { userId: studioUserId },
      });
    } finally {
      restoreNow();
    }
  });
});
