import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import { getMyStudioSettings } from "../../convex/users";
import { InMemoryConvexDb, createMutationCtx } from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

describe("RED-PHASE: studio auto-accept default persistence contracts", () => {
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
      studioName: "Test Studio",
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

  it("getMyStudioSettings returns autoAcceptDefault: false when studio has no autoAcceptDefault set", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const settings = await (getMyStudioSettings as any)._handler(ctx, {});

      expect(settings).not.toBeNull();
      expect(settings).toHaveProperty("autoAcceptDefault");
      expect(settings.autoAcceptDefault).toBe(false);
      expect(settings.primaryBranch?.branchId).toBe(seeded.branchId);
    } finally {
      restoreNow();
    }
  });

  it("getMyStudioSettings returns autoAcceptDefault: true when studio explicitly enables it", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      // Patch studio to set autoAcceptDefault: true
      await db.patch("studioBranches", seeded.branchId, {
        autoAcceptDefault: true,
      });

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const settings = await (getMyStudioSettings as any)._handler(ctx, {});

      expect(settings).not.toBeNull();
      expect(settings).toHaveProperty("autoAcceptDefault");
      expect(settings.autoAcceptDefault).toBe(true);
    } finally {
      restoreNow();
    }
  });

  it("studio can update autoAcceptDefault via updateMyStudioSettings mutation", async () => {
    const restoreNow = freezeNow(FIXED_NOW);
    try {
      const db = new InMemoryConvexDb();
      const seeded = await seedStudioScenario(db);

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const { updateMyStudioSettings } = await import("../../convex/users");
      await (updateMyStudioSettings as any)._handler(ctx, {
        studioName: "Test Studio",
        address: "Main st",
        zone: "5001557",
        autoAcceptDefault: true,
      });

      // Verify the studio profile was updated
      const studio = await db.get("studioProfiles", seeded.studioId);
      expect(studio?.autoAcceptDefault).toBe(true);
      const branch = await db.get("studioBranches", seeded.branchId);
      expect(branch?.autoAcceptDefault).toBe(true);
    } finally {
      restoreNow();
    }
  });
});
