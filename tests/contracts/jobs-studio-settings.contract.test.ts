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

    return { studioUserId, studioId };
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
      // RED PHASE: This will fail because autoAcceptDefault field doesn't exist in getMyStudioSettings yet
      expect(settings).toHaveProperty("autoAcceptDefault");
      expect(settings.autoAcceptDefault).toBe(false);
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
      await db.patch("studioProfiles", seeded.studioId, {
        autoAcceptDefault: true,
      });

      const ctx = createMutationCtx({
        db,
        userId: seeded.studioUserId,
      });

      const settings = await (getMyStudioSettings as any)._handler(ctx, {});

      expect(settings).not.toBeNull();
      // RED PHASE: This will fail because autoAcceptDefault field doesn't exist in getMyStudioSettings yet
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

      // RED PHASE: This will fail because autoAcceptDefault is not yet an accepted arg
      await (updateMyStudioSettings as any)._handler(ctx, {
        studioName: "Test Studio",
        address: "Main st",
        zone: "5001557",
        autoAcceptDefault: true,
      });

      // Verify the studio profile was updated
      const studio = await db.get("studioProfiles", seeded.studioId);
      expect(studio?.autoAcceptDefault).toBe(true);
    } finally {
      restoreNow();
    }
  });
});
