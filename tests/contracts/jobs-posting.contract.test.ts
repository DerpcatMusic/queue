import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import { postJob } from "../../convex/jobs";
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

// startTime is 120 minutes in the future so expiry is always in the future
const JOB_START_TIME = FIXED_NOW + 120 * 60 * 1000;
const JOB_END_TIME = FIXED_NOW + 180 * 60 * 1000;

describe("RED-PHASE: per-job expiry override contracts", () => {
  async function seedStudioScenario(db: InMemoryConvexDb) {
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
    const branchId = (await db.insert("studioBranches", {
      studioId,
      name: "Main branch",
      slug: "main-branch",
      address: "Main st",
      zone: "5001557",
      isPrimary: true,
      status: "active",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioBranches">;
    await db.insert("studioMemberships", {
      studioId,
      userId: studioUserId,
      role: "owner",
      status: "active",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("studioEntitlements", {
      studioId,
      planKey: "free",
      maxBranches: 1,
      branchesFeatureEnabled: false,
      subscriptionStatus: "active",
      effectiveAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });

    return { studioUserId, studioId, branchId };
  }

  it("postJob persists expiryOverrideMinutes when provided", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      const result = await (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId: seeded.branchId,
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        expiryOverrideMinutes: 60,
      });

      const job = await db.get("jobs", result.jobId);
      expect(job).not.toBeNull();
      // RED PHASE: This will fail because postJob doesn't yet persist expiryOverrideMinutes
      expect(job?.expiryOverrideMinutes).toBe(60);

      // Verify expiry scheduler call uses the override (60 min before startTime)
      expect(schedulerCalls.length).toBeGreaterThanOrEqual(3);
      const expiryCall = schedulerCalls[2];
      const expectedDelayMs = 60 * 60 * 1000; // 60 minutes in ms
      expect(expiryCall!.delayMs).toBe(expectedDelayMs);
    } finally {
      restoreNow();
    }
  });

  it("postJob uses studio default when no expiryOverrideMinutes provided", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const { studioUserId, studioId, branchId } = await seedStudioScenario(db);

      // Set studio default to 45 minutes before startTime
      await db.patch("studioProfiles", studioId, {
        autoExpireMinutesBefore: 45,
      });

      const schedulerCalls: ScheduledCall[] = [];

      const ctx = createMutationCtx({
        db,
        userId: studioUserId,
        schedulerCalls,
      });

      const result = await (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId,
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
      });

      const job = await db.get("jobs", result.jobId);
      expect(job).not.toBeNull();
      // RED PHASE: This will fail because postJob doesn't persist expiryOverrideMinutes
      // and the studio default fallback isn't implemented yet
      expect(job?.expiryOverrideMinutes).toBeUndefined();

      // Verify expiry scheduler call uses studio default (45 min before startTime)
      expect(schedulerCalls.length).toBeGreaterThanOrEqual(3);
      const expiryCall = schedulerCalls[2];
      const expectedDelayMs = 75 * 60 * 1000; // startTime - 45min = 120 - 45 = 75 min
      expect(expiryCall!.delayMs).toBe(expectedDelayMs);
    } finally {
      restoreNow();
    }
  });

  it("postJob uses platform default (30 min) when no override and no studio default", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);
      const schedulerCalls: ScheduledCall[] = [];

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
        schedulerCalls,
      });

      const result = await (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId: seeded.branchId,
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
      });

      const job = await db.get("jobs", result.jobId);
      expect(job).not.toBeNull();
      // RED PHASE: This will fail because postJob doesn't persist expiryOverrideMinutes
      expect(job?.expiryOverrideMinutes).toBeUndefined();

      // Verify expiry scheduler call uses platform default (30 min before startTime)
      expect(schedulerCalls.length).toBeGreaterThanOrEqual(3);
      const expiryCall = schedulerCalls[2];
      const expectedDelayMs = 90 * 60 * 1000; // startTime - 30min = 120 - 30 = 90 min
      expect(expiryCall!.delayMs).toBe(expectedDelayMs);
    } finally {
      restoreNow();
    }
  });
});

describe("RED-PHASE: boost preset validation contracts", () => {
  async function seedStudioScenario(db: InMemoryConvexDb) {
    const studioUserId = (await db.insert("users", {
      role: "studio",
      onboardingComplete: true,
      isActive: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;

    const studioId = (await db.insert("studioProfiles", {
      userId: studioUserId,
      studioName: "Boost Test Studio",
      address: "Main st",
      zone: "5001557",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioProfiles">;
    const branchId = (await db.insert("studioBranches", {
      studioId,
      name: "Main branch",
      slug: "main-branch",
      address: "Main st",
      zone: "5001557",
      isPrimary: true,
      status: "active",
      notificationsEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"studioBranches">;
    await db.insert("studioMemberships", {
      studioId,
      userId: studioUserId,
      role: "owner",
      status: "active",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("studioEntitlements", {
      studioId,
      planKey: "free",
      maxBranches: 1,
      branchesFeatureEnabled: false,
      subscriptionStatus: "active",
      effectiveAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });

    return { studioUserId, studioId, branchId };
  }

  it("postJob accepts 'small' boost preset and persists boostPreset with correct bonus amount", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const result = await (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId: seeded.branchId,
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        boostPreset: "small",
      });

      const job = await db.get("jobs", result.jobId);
      expect(job).not.toBeNull();
      // RED PHASE: This will fail because postJob doesn't yet accept boostPreset
      expect(job?.boostPreset).toBe("small");
      expect(job?.boostBonusAmount).toBe(20); // small = 20 shekels
      expect(job?.boostActive).toBe(true);
    } finally {
      restoreNow();
    }
  });

  it("postJob accepts 'medium' boost preset and persists boostPreset with correct bonus amount", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const result = await (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId: seeded.branchId,
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        boostPreset: "medium",
      });

      const job = await db.get("jobs", result.jobId);
      expect(job).not.toBeNull();
      // RED PHASE: This will fail because postJob doesn't yet accept boostPreset
      expect(job?.boostPreset).toBe("medium");
      expect(job?.boostBonusAmount).toBe(50); // medium = 50 shekels
      expect(job?.boostActive).toBe(true);
    } finally {
      restoreNow();
    }
  });

  it("postJob accepts 'large' boost preset and persists boostPreset with correct bonus amount", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const result = await (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId: seeded.branchId,
        startTime: JOB_START_TIME,
        endTime: JOB_END_TIME,
        pay: 250,
        boostPreset: "large",
      });

      const job = await db.get("jobs", result.jobId);
      expect(job).not.toBeNull();
      // RED PHASE: This will fail because postJob doesn't yet accept boostPreset
      expect(job?.boostPreset).toBe("large");
      expect(job?.boostBonusAmount).toBe(100); // large = 100 shekels
      expect(job?.boostActive).toBe(true);
    } finally {
      restoreNow();
    }
  });

  it("postJob rejects invalid boost preset", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      // RED PHASE: This will fail because postJob doesn't yet validate boostPreset
      // The test expects the mutation to reject an invalid preset
      await expect(
        (postJob as any)._handler(ctx, {
        sport: "hiit",
        branchId: seeded.branchId,
        startTime: JOB_START_TIME,
          endTime: JOB_END_TIME,
          pay: 250,
          boostPreset: "huge", // invalid preset
        }),
      ).rejects.toThrow();
    } finally {
      restoreNow();
    }
  });
});
