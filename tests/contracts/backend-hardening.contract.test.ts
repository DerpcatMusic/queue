import { describe, expect, it } from "bun:test";

import { canResolveLinkedUserByEmail, resolveLinkedUserId } from "../../convex/auth";
import { postJob } from "../../convex/jobs";
import { MIN_JOB_APPLICATION_LEAD_TIME_MS } from "../../convex/lib/validation";
import { completeInstructorOnboarding, completeStudioOnboarding } from "../../convex/onboarding";
import type { Id } from "../../convex/_generated/dataModel";
import { InMemoryConvexDb, createMutationCtx } from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

function freezeNow(now: number) {
  const original = Date.now;
  Date.now = () => now;
  return () => {
    Date.now = original;
  };
}

function asUserId(value: string) {
  return value as Id<"users">;
}

async function matchedUserIdsByEmail(db: InMemoryConvexDb, email: string) {
  const rows = await db.query("users").withIndex("by_email", (q) => q.eq("email", email)).take(2);
  return rows.map((row) => row._id as Id<"users">);
}

describe("backend hardening contracts", () => {
  describe("duplicate-email identity resolution", () => {
    it("links by email only when the provider email is verified", () => {
      expect(canResolveLinkedUserByEmail("a@example.com", true)).toBe(true);
      expect(canResolveLinkedUserByEmail("a@example.com", false)).toBe(false);
      expect(canResolveLinkedUserByEmail(undefined, true)).toBe(false);
      expect(canResolveLinkedUserByEmail("", true)).toBe(false);
    });

    it("links deterministically when there is exactly one email match", async () => {
      const db = new InMemoryConvexDb();
      const linkedUserId = (await db.insert("users", {
        role: "pending",
        onboardingComplete: false,
        isActive: true,
        email: "a@example.com",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })) as Id<"users">;

      const linked = resolveLinkedUserId({
        existingUserId: undefined,
        matchedUserIdsByEmail: await matchedUserIdsByEmail(db, "a@example.com"),
        email: "a@example.com",
      });

      expect(linked).toBe(linkedUserId);
    });

    it("rejects ambiguous duplicate-email matches", async () => {
      const db = new InMemoryConvexDb();
      await db.insert("users", {
        role: "pending",
        onboardingComplete: false,
        isActive: true,
        email: "a@example.com",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });
      await db.insert("users", {
        role: "pending",
        onboardingComplete: false,
        isActive: true,
        email: "a@example.com",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      expect(() =>
        resolveLinkedUserId({
          existingUserId: undefined,
          matchedUserIdsByEmail: [
            asUserId("users:1"),
            asUserId("users:2"),
          ],
          email: "a@example.com",
        }),
      ).toThrow("Ambiguous account resolution for this email");
    });

    it("rejects linking when email points at a different user", async () => {
      const db = new InMemoryConvexDb();
      await db.insert("users", {
        role: "pending",
        onboardingComplete: false,
        isActive: true,
        email: "a@example.com",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      });

      expect(() =>
        resolveLinkedUserId({
          existingUserId: asUserId("users:existing"),
          matchedUserIdsByEmail: [asUserId("users:1")],
          email: "a@example.com",
        }),
      ).toThrow("Email is already linked to a different account");
    });
  });

  describe("profile uniqueness get-or-create guard", () => {
    it("rejects duplicate instructor profiles during onboarding", async () => {
      const restore = freezeNow(FIXED_NOW);
      try {
        const db = new InMemoryConvexDb();
        const userId = (await db.insert("users", {
          role: "pending",
          onboardingComplete: false,
          isActive: true,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        })) as Id<"users">;

        await db.insert("instructorProfiles", {
          userId,
          displayName: "Coach One",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });
        await db.insert("instructorProfiles", {
          userId,
          displayName: "Coach Two",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });

        const ctx = createMutationCtx({ db, userId });
        await expect(
          (completeInstructorOnboarding as any)._handler(ctx, {
            displayName: "Coach",
            bio: undefined,
            sports: ["hiit"],
            zones: ["5001557"],
            address: undefined,
            latitude: undefined,
            longitude: undefined,
            expoPushToken: undefined,
            notificationsEnabled: false,
            hourlyRateExpectation: undefined,
          }),
        ).rejects.toThrow("Multiple instructor profiles found for this account");
      } finally {
        restore();
      }
    });

    it("rejects duplicate studio profiles during onboarding", async () => {
      const restore = freezeNow(FIXED_NOW);
      try {
        const db = new InMemoryConvexDb();
        const userId = (await db.insert("users", {
          role: "pending",
          onboardingComplete: false,
          isActive: true,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        })) as Id<"users">;

        await db.insert("studioProfiles", {
          userId,
          studioName: "Studio One",
          address: "Address 1",
          zone: "5001557",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });
        await db.insert("studioProfiles", {
          userId,
          studioName: "Studio Two",
          address: "Address 2",
          zone: "5001557",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });

        const ctx = createMutationCtx({ db, userId });
        await expect(
          (completeStudioOnboarding as any)._handler(ctx, {
            studioName: "Studio",
            address: "Main st",
            zone: "5001557",
            contactPhone: undefined,
            latitude: undefined,
            longitude: undefined,
            expoPushToken: undefined,
            notificationsEnabled: false,
            logoStorageId: undefined,
            sports: ["hiit"],
          }),
        ).rejects.toThrow("Multiple studio profiles found for this account");
      } finally {
        restore();
      }
    });
  });

  describe("job application deadline lead-time invariant", () => {
    it("rejects deadline too close to now when posting a job", async () => {
      const restore = freezeNow(FIXED_NOW);
      try {
        const db = new InMemoryConvexDb();
        const userId = (await db.insert("users", {
          role: "studio",
          onboardingComplete: true,
          isActive: true,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        })) as Id<"users">;
        await db.insert("studioProfiles", {
          userId,
          studioName: "Studio",
          address: "Main st",
          zone: "5001557",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });

        const ctx = createMutationCtx({ db, userId });
        const startTime = FIXED_NOW + 60 * 60 * 1000;
        const endTime = startTime + 60 * 60 * 1000;

        await expect(
          (postJob as any)._handler(ctx, {
            sport: "hiit",
            startTime,
            endTime,
            timeZone: "UTC",
            pay: 100,
            note: undefined,
            requiredLevel: undefined,
            maxParticipants: undefined,
            equipmentProvided: undefined,
            sessionLanguage: undefined,
            isRecurring: undefined,
            cancellationDeadlineHours: undefined,
            applicationDeadline: FIXED_NOW + MIN_JOB_APPLICATION_LEAD_TIME_MS - 1,
          }),
        ).rejects.toThrow("applicationDeadline must be at least 5 minutes in the future");

        expect(db.list("jobs")).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it("rejects deadline too close to start time when posting a job", async () => {
      const restore = freezeNow(FIXED_NOW);
      try {
        const db = new InMemoryConvexDb();
        const userId = (await db.insert("users", {
          role: "studio",
          onboardingComplete: true,
          isActive: true,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        })) as Id<"users">;
        await db.insert("studioProfiles", {
          userId,
          studioName: "Studio",
          address: "Main st",
          zone: "5001557",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });

        const ctx = createMutationCtx({ db, userId });
        const deadline = FIXED_NOW + 20 * 60 * 1000;
        const startTime = deadline + MIN_JOB_APPLICATION_LEAD_TIME_MS - 1;
        const endTime = startTime + 60 * 60 * 1000;

        await expect(
          (postJob as any)._handler(ctx, {
            sport: "hiit",
            startTime,
            endTime,
            timeZone: "UTC",
            pay: 100,
            note: undefined,
            requiredLevel: undefined,
            maxParticipants: undefined,
            equipmentProvided: undefined,
            sessionLanguage: undefined,
            isRecurring: undefined,
            cancellationDeadlineHours: undefined,
            applicationDeadline: deadline,
          }),
        ).rejects.toThrow("applicationDeadline must be at least 5 minutes before startTime");

        expect(db.list("jobs")).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it("accepts a valid lead-time window when posting a job", async () => {
      const restore = freezeNow(FIXED_NOW);
      try {
        const db = new InMemoryConvexDb();
        const userId = (await db.insert("users", {
          role: "studio",
          onboardingComplete: true,
          isActive: true,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        })) as Id<"users">;
        const studioId = await db.insert("studioProfiles", {
          userId,
          studioName: "Studio",
          address: "Main st",
          zone: "5001557",
          notificationsEnabled: false,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        });

        const ctx = createMutationCtx({ db, userId });
        const deadline = FIXED_NOW + MIN_JOB_APPLICATION_LEAD_TIME_MS;
        const startTime = deadline + MIN_JOB_APPLICATION_LEAD_TIME_MS;
        const endTime = startTime + 60 * 60 * 1000;

        const result = await (postJob as any)._handler(ctx, {
          sport: "hiit",
          startTime,
          endTime,
          timeZone: "UTC",
          pay: 100,
          note: "Bring mat",
          requiredLevel: "all_levels",
          maxParticipants: 12,
          equipmentProvided: true,
          sessionLanguage: "english",
          isRecurring: false,
          cancellationDeadlineHours: 12,
          applicationDeadline: deadline,
        });

        expect(result.jobId).toBeDefined();
        expect(db.list("jobs")).toHaveLength(1);
        expect(db.list("jobs")[0]?.studioId).toBe(studioId);
      } finally {
        restore();
      }
    });
  });
});
