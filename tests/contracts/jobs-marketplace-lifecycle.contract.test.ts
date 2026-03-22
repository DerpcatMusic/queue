import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import { applyToJob, autoExpireUnfilledJob, cancelFilledJob, postJob } from "../../convex/jobs";
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

describe("RED-PHASE: auto-accept concurrency contracts", () => {
  async function seedAutoAcceptScenario(db: InMemoryConvexDb) {
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
      studioName: "AutoAccept Studio",
      address: "Main st",
      zone: "5001557",
      notificationsEnabled: true,
      autoAcceptEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioProfiles">;

    const instructorA = (await db.insert("instructorProfiles", {
      userId: instructorUserA,
      displayName: "Instructor Alice",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"instructorProfiles">;
    const instructorB = (await db.insert("instructorProfiles", {
      userId: instructorUserB,
      displayName: "Instructor Bob",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"instructorProfiles">;

    await db.insert("instructorCoverage", {
      instructorId: instructorA,
      sport: "hiit",
      zone: "5001557",
      notificationsEnabled: true,
      updatedAt: FIXED_NOW,
    });
    await db.insert("instructorCoverage", {
      instructorId: instructorB,
      sport: "hiit",
      zone: "5001557",
      notificationsEnabled: true,
      updatedAt: FIXED_NOW,
    });

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

    return {
      studioUserId,
      studioId,
      jobId,
      instructorUserA,
      instructorUserB,
      instructorA,
      instructorB,
    };
  }

  it("first valid applicant wins when studio auto-accept is enabled", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedAutoAcceptScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctxA = createMutationCtx({
        db,
        userId: seeded.instructorUserA,
        schedulerCalls,
      });
      const ctxB = createMutationCtx({
        db,
        userId: seeded.instructorUserB,
        schedulerCalls,
      });

      const resultA = await (applyToJob as any)._handler(ctxA, {
        jobId: seeded.jobId,
      });
      const resultB = await (applyToJob as any)._handler(ctxB, {
        jobId: seeded.jobId,
      });

      const acceptedResults = [resultA, resultB].filter(
        (r) => r.status === "accepted",
      );
      expect(acceptedResults).toHaveLength(1);

      const job = await db.get("jobs", seeded.jobId);
      expect(job?.status).toBe("filled");
      expect(job?.filledByInstructorId).toBeDefined();

      const applications = db.list("jobApplications");
      expect(applications).toHaveLength(2);

      const acceptedApps = applications.filter((a) => a.status === "accepted");
      const nonAcceptedApps = applications.filter((a) => a.status !== "accepted");
      expect(acceptedApps).toHaveLength(1);
      expect(nonAcceptedApps).toHaveLength(1);

      const winnerApp = acceptedApps[0];
      expect(winnerApp).toBeDefined();
      const winnerInstructorId =
        winnerApp!.instructorId === seeded.instructorA
          ? seeded.instructorA
          : seeded.instructorB;
      expect(job?.filledByInstructorId).toBe(winnerInstructorId);
    } finally {
      restoreNow();
    }
  });

  it("losing application is not accepted and job is no longer open after winner succeeds", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedAutoAcceptScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctxA = createMutationCtx({
        db,
        userId: seeded.instructorUserA,
        schedulerCalls,
      });
      const ctxB = createMutationCtx({
        db,
        userId: seeded.instructorUserB,
        schedulerCalls,
      });

      await (applyToJob as any)._handler(ctxA, { jobId: seeded.jobId });

      let secondResult;
      try {
        secondResult = await (applyToJob as any)._handler(ctxB, {
          jobId: seeded.jobId,
        });
      } catch {
        // Expected: job no longer open
      }

      const job = await db.get("jobs", seeded.jobId);
      expect(job?.status).toBe("filled");
      expect(job?.filledByInstructorId).toBeDefined();

      if (secondResult) {
        expect(secondResult.status).not.toBe("accepted");
      }

      expect(job?.status).not.toBe("open");

      const allApplications = db.list("jobApplications");
      const acceptedApps = allApplications.filter((a) => a.status === "accepted");
      expect(acceptedApps).toHaveLength(1);
    } finally {
      restoreNow();
    }
  });

  it("auto-accept enabled studio fills job on first application without manual review", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedAutoAcceptScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctxA = createMutationCtx({
        db,
        userId: seeded.instructorUserA,
        schedulerCalls,
      });

      const result = await (applyToJob as any)._handler(ctxA, {
        jobId: seeded.jobId,
      });

      const job = await db.get("jobs", seeded.jobId);
      expect(job?.status).toBe("filled");
      expect(job?.filledByInstructorId).toBe(seeded.instructorA);

      expect(result.status).toBe("accepted");

      const applications = db.list("jobApplications");
      const pendingApps = applications.filter((a) => a.status === "pending");
      expect(pendingApps).toHaveLength(0);
    } finally {
      restoreNow();
    }
  });
});

describe("RED-PHASE: studio cancellation contracts", () => {
  async function seedCancellationScenario(db: InMemoryConvexDb) {
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

    const studioId = (await db.insert("studioProfiles", {
      userId: studioUserId,
      studioName: "Cancel Test Studio",
      address: "Main st",
      zone: "5001557",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioProfiles">;

    const instructorA = (await db.insert("instructorProfiles", {
      userId: instructorUserA,
      displayName: "Instructor Alice",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"instructorProfiles">;

    await db.insert("instructorCoverage", {
      instructorId: instructorA,
      sport: "hiit",
      zone: "5001557",
      notificationsEnabled: true,
      updatedAt: FIXED_NOW,
    });

    return {
      studioUserId,
      studioId,
      instructorUserA,
      instructorA,
    };
  }

  it("studio can cancel an open job it posted", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedCancellationScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const openJobId = (await db.insert("jobs", {
        studioId: seeded.studioId,
        zone: "5001557",
        sport: "hiit",
        startTime: FIXED_NOW + 30 * 60 * 1000,
        endTime: FIXED_NOW + 90 * 60 * 1000,
        pay: 250,
        status: "open",
        postedAt: FIXED_NOW - 10 * 60 * 1000,
      })) as Id<"jobs">;

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      await expect(
        (cancelFilledJob as any)._handler(ctx, {
          jobId: openJobId,
        }),
      ).resolves.toEqual({ ok: true });

      const job = await db.get("jobs", openJobId);
      expect(job?.status).toBe("cancelled");
    } finally {
      restoreNow();
    }
  });

  it("studio can cancel a filled job it posted and application state is not left filled/open", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedCancellationScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const filledJobId = (await db.insert("jobs", {
        studioId: seeded.studioId,
        zone: "5001557",
        sport: "hiit",
        startTime: FIXED_NOW + 30 * 60 * 1000,
        endTime: FIXED_NOW + 90 * 60 * 1000,
        pay: 250,
        status: "open",
        postedAt: FIXED_NOW - 10 * 60 * 1000,
      })) as Id<"jobs">;

      const applicationId = (await db.insert("jobApplications", {
        jobId: filledJobId,
        instructorId: seeded.instructorA,
        status: "pending",
        appliedAt: FIXED_NOW - 5 * 60 * 1000,
        updatedAt: FIXED_NOW - 5 * 60 * 1000,
      })) as Id<"jobApplications">;

      await db.patch("jobs", filledJobId, {
        status: "filled",
        filledByInstructorId: seeded.instructorA,
      });
      await db.patch("jobApplications", applicationId, {
        status: "accepted",
      });

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      await expect(
        (cancelFilledJob as any)._handler(ctx, {
          jobId: filledJobId,
        }),
      ).resolves.toEqual({ ok: true });

      const job = await db.get("jobs", filledJobId);
      expect(job?.status).toBe("cancelled");
      expect(job?.status).not.toBe("filled");
      expect(job?.status).not.toBe("open");

      const application = await db.get("jobApplications", applicationId);
      expect(application?.status).not.toBe("filled");
      expect(application?.status).not.toBe("accepted");
    } finally {
      restoreNow();
    }
  });

  it("open job cancellation rejects pending applications and triggers calendar sync", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedCancellationScenario(db);
      const schedulerCalls: ScheduledCall[] = [];
      const runMutationCalls: any[] = [];

      const openJobId = (await db.insert("jobs", {
        studioId: seeded.studioId,
        zone: "5001557",
        sport: "hiit",
        startTime: FIXED_NOW + 30 * 60 * 1000,
        endTime: FIXED_NOW + 90 * 60 * 1000,
        pay: 250,
        status: "open",
        postedAt: FIXED_NOW - 10 * 60 * 1000,
      })) as Id<"jobs">;

      const pendingAppId = (await db.insert("jobApplications", {
        jobId: openJobId,
        instructorId: seeded.instructorA,
        status: "pending",
        appliedAt: FIXED_NOW - 5 * 60 * 1000,
        updatedAt: FIXED_NOW - 5 * 60 * 1000,
      })) as Id<"jobApplications">;

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
        runMutationCalls,
        runMutationImpl: async (fn: any, args: any) => {
          runMutationCalls.push({ fn, args });
          return undefined;
        },
      });

      await expect(
        (cancelFilledJob as any)._handler(ctx, {
          jobId: openJobId,
        }),
      ).resolves.toEqual({ ok: true });

      const job = await db.get("jobs", openJobId);
      expect(job?.status).toBe("cancelled");
      expect(job?.closureReason).toBe("studio_cancelled");

      const app = await db.get("jobApplications", pendingAppId);
      expect(app?.status).toBe("rejected");

      const notifications = db.list("userNotifications");
      const rejectedNotifications = notifications.filter(
        (n) => n.applicationId === pendingAppId && n.kind === "application_rejected",
      );
      expect(rejectedNotifications.length).toBe(1);

      expect(schedulerCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      restoreNow();
    }
  });
});

describe("RED-PHASE: expiry fallback contracts", () => {
  // startTime is 120 minutes in the future so expiry is always in the future
  const JOB_START_TIME = FIXED_NOW + 120 * 60 * 1000;
  const JOB_END_TIME = FIXED_NOW + 180 * 60 * 1000;

  async function seedExpiryScenario(db: InMemoryConvexDb) {
    const studioUserId = (await db.insert("users", {
      role: "studio",
      onboardingComplete: true,
      isActive: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;

    const studioId = (await db.insert("studioProfiles", {
      userId: studioUserId,
      studioName: "Expiry Test Studio",
      address: "Main st",
      zone: "5001557",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioProfiles">;

    return { studioUserId, studioId };
  }

  it("per-job expiry override wins when provided", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedExpiryScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      const expectedDelayMs = 60 * 60 * 1000;

      await (postJob as any)._handler(ctx, {
        sport: "hiit",
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        expiryOverrideMinutes: 60,
      });

      expect(schedulerCalls.length).toBeGreaterThanOrEqual(3);
      const expiryCall = schedulerCalls[2];
      expect(expiryCall!.delayMs).toBe(expectedDelayMs);
    } finally {
      restoreNow();
    }
  });

  it("studio default is used when no per-job override provided", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const { studioUserId, studioId } = await seedExpiryScenario(db);

      await db.patch("studioProfiles", studioId, {
        autoExpireMinutesBefore: 45,
      });

      const schedulerCalls: ScheduledCall[] = [];

      const ctx = createMutationCtx({
        db,
        userId: studioUserId,
        schedulerCalls,
      });

      const expectedDelayMs = 75 * 60 * 1000;

      await (postJob as any)._handler(ctx, {
        sport: "hiit",
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
      });

      expect(schedulerCalls.length).toBeGreaterThanOrEqual(3);
      const expiryCall = schedulerCalls[2];
      expect(expiryCall!.delayMs).toBe(expectedDelayMs);
    } finally {
      restoreNow();
    }
  });

  it("platform default (30 minutes) is used when neither override nor studio default provided", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedExpiryScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      const expectedDelayMs = 90 * 60 * 1000;

      await (postJob as any)._handler(ctx, {
        sport: "hiit",
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
      });

      expect(schedulerCalls.length).toBeGreaterThanOrEqual(3);
      const expiryCall = schedulerCalls[2];
      expect(expiryCall!.delayMs).toBe(expectedDelayMs);
    } finally {
      restoreNow();
    }
  });

  it("autoExpireUnfilledJob re-check uses per-job override when present", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedExpiryScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const jobId = (await db.insert("jobs", {
        studioId: seeded.studioId,
        zone: "5001557",
        sport: "hiit",
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        status: "open",
        postedAt: FIXED_NOW - 10 * 60 * 1000,
        expiryOverrideMinutes: 60,
      })) as Id<"jobs">;

      const laterNow = FIXED_NOW + 65 * 60 * 1000;
      const restoreLater = freezeNow(laterNow);

      const expireCtx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      const result = await (autoExpireUnfilledJob as any)._handler(expireCtx, {
        jobId,
      });

      expect(result.expired).toBe(true);
      const job = await db.get("jobs", jobId);
      expect(job?.status).toBe("cancelled");
      expect(job?.closureReason).toBe("expired");

      restoreLater();
    } finally {
      restoreNow();
    }
  });

  it("autoExpireUnfilledJob uses studio default when no per-job override", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const { studioUserId, studioId } = await seedExpiryScenario(db);

      await db.patch("studioProfiles", studioId, {
        autoExpireMinutesBefore: 45,
      });

      const schedulerCalls: ScheduledCall[] = [];

      const jobId = (await db.insert("jobs", {
        studioId,
        zone: "5001557",
        sport: "hiit",
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        status: "open",
        postedAt: FIXED_NOW - 10 * 60 * 1000,
      })) as Id<"jobs">;

      const laterNow = FIXED_NOW + 75 * 60 * 1000;
      const restoreLater = freezeNow(laterNow);

      const expireCtx = createMutationCtx({
        db,
        userId: studioUserId,
        schedulerCalls,
      });

      const result = await (autoExpireUnfilledJob as any)._handler(expireCtx, {
        jobId,
      });

      expect(result.expired).toBe(true);
      const job = await db.get("jobs", jobId);
      expect(job?.status).toBe("cancelled");
      expect(job?.closureReason).toBe("expired");

      restoreLater();
    } finally {
      restoreNow();
    }
  });
});
