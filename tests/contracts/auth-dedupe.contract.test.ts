import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import {
  dedupeDuplicateUsersByEmail,
  dedupeUsersForEmail,
  getDuplicateUserEmails,
} from "../../convex/migrations";
import { dedupeUsersByEmail, normalizeEmail } from "../../convex/lib/authDedupe";
import { InMemoryConvexDb, createMutationCtx } from "../in-memory-convex";

const FIXED_NOW = 1_700_000_000_000;

describe("auth dedupe", () => {
  it("merges duplicate users, linked auth records, and notifications into one canonical account", async () => {
    const db = new InMemoryConvexDb();
    const canonicalUserId = (await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;
    const duplicateUserId = (await db.insert("users", {
      role: "instructor",
      onboardingComplete: true,
      isActive: true,
      email: "coach@example.com",
      fullName: "Coach Queue",
      image: "https://example.com/avatar.png",
      emailVerificationTime: FIXED_NOW,
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    })) as Id<"users">;

    await db.insert("authAccounts", {
      userId: duplicateUserId,
      provider: "google",
      providerAccountId: "google-123",
    });
    await db.insert("authSessions", {
      userId: duplicateUserId,
      expirationTime: FIXED_NOW + 10_000,
    });
    await db.insert("payoutReleaseRules", {
      userId: duplicateUserId,
      preferenceMode: "manual_hold",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("userNotifications", {
      recipientUserId: duplicateUserId,
      actorUserId: duplicateUserId,
      kind: "application_received",
      title: "Hi",
      body: "Body",
      createdAt: FIXED_NOW,
    });

    const ctx = createMutationCtx({ db, userId: canonicalUserId });
    const result = await dedupeUsersByEmail({
      ctx: ctx as any,
      normalizedEmail: "coach@example.com",
      preferredUserId: canonicalUserId,
      now: FIXED_NOW + 100,
    });

    expect(result).toBe(canonicalUserId);

    const canonicalUser = await db.get(canonicalUserId);
    const duplicateUser = await db.get(duplicateUserId);
    expect(canonicalUser?.role).toBe("instructor");
    expect(canonicalUser?.onboardingComplete).toBe(true);
    expect(canonicalUser?.fullName).toBe("Coach Queue");
    expect(canonicalUser?.email).toBe("coach@example.com");
    expect(duplicateUser?.isActive).toBe(false);
    expect(duplicateUser?.email).toBeUndefined();

    expect(db.list("authAccounts")[0]?.userId).toBe(canonicalUserId);
    expect(db.list("authSessions")[0]?.userId).toBe(canonicalUserId);
    expect(db.list("payoutReleaseRules")[0]?.userId).toBe(canonicalUserId);
    expect(db.list("userNotifications")[0]?.recipientUserId).toBe(canonicalUserId);
    expect(db.list("userNotifications")[0]?.actorUserId).toBe(canonicalUserId);
  });

  it("merges duplicate instructor profiles and preserves sports and zones", async () => {
    const db = new InMemoryConvexDb();
    const firstUserId = (await db.insert("users", {
      role: "instructor",
      onboardingComplete: true,
      isActive: true,
      email: "coach@example.com",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;
    const secondUserId = (await db.insert("users", {
      role: "instructor",
      onboardingComplete: true,
      isActive: true,
      email: "coach@example.com",
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    })) as Id<"users">;
    const firstProfileId = await db.insert("instructorProfiles", {
      userId: firstUserId,
      displayName: "Coach One",
      notificationsEnabled: false,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    const secondProfileId = await db.insert("instructorProfiles", {
      userId: secondUserId,
      displayName: "Coach Two",
      notificationsEnabled: true,
      diditVerificationStatus: "approved",
      diditLegalName: "Legal Coach",
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    });
    await db.insert("instructorSports", {
      instructorId: firstProfileId,
      sport: "tennis",
      createdAt: FIXED_NOW,
    });
    await db.insert("instructorSports", {
      instructorId: secondProfileId,
      sport: "padel",
      createdAt: FIXED_NOW,
    });
    await db.insert("instructorZones", {
      instructorId: firstProfileId,
      zone: "tlv",
      createdAt: FIXED_NOW,
    });
    await db.insert("instructorZones", {
      instructorId: secondProfileId,
      zone: "center",
      createdAt: FIXED_NOW,
    });
    await db.insert("jobApplications", {
      jobId: "jobs:1",
      studioId: undefined,
      instructorId: secondProfileId,
      status: "pending",
      appliedAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("notificationLog", {
      jobId: "jobs:1",
      instructorId: secondProfileId,
      sentAt: FIXED_NOW,
      deliveryStatus: "sent",
      expoPushToken: "ExponentPushToken[test]",
    });

    const ctx = createMutationCtx({ db, userId: firstUserId });
    const result = await dedupeUsersByEmail({
      ctx: ctx as any,
      normalizedEmail: normalizeEmail("coach@example.com")!,
      preferredUserId: firstUserId,
      now: FIXED_NOW + 100,
    });

    expect(result).toBe(firstUserId);
    const profiles = db.list("instructorProfiles");
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.userId).toBe(firstUserId);
    expect(profiles[0]?.diditVerificationStatus).toBe("approved");
    expect(profiles[0]?.displayName).toBe("Coach One");

    const sports = db.list("instructorSports").map((row) => row.sport).sort();
    const zones = db.list("instructorZones").map((row) => row.zone).sort();
    expect(sports).toEqual(["padel", "tennis"]);
    expect(zones).toEqual(["center", "tlv"]);
    expect(db.list("jobApplications")[0]?.instructorId).toBe(profiles[0]?._id);
    expect(db.list("notificationLog")[0]?.instructorId).toBe(profiles[0]?._id);
  });

  it("normalizes email before dedupe lookups", () => {
    expect(normalizeEmail("  Coach@Example.com ")).toBe("coach@example.com");
    expect(normalizeEmail(undefined)).toBeUndefined();
  });

  it("finds duplicate emails via migration query and dedupes a targeted email", async () => {
    const db = new InMemoryConvexDb();
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      emailVerificationTime: FIXED_NOW,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      emailVerificationTime: FIXED_NOW + 1,
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    });
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "studio@example.com",
      createdAt: FIXED_NOW + 2,
      updatedAt: FIXED_NOW + 2,
    });

    const duplicateEmails = await (getDuplicateUserEmails as any)._handler({ db }, {});
    expect(duplicateEmails).toEqual(["coach@example.com"]);

    const ctx = createMutationCtx({ db });
    const canonicalUserId = await (dedupeUsersForEmail as any)._handler(ctx, {
      email: " Coach@Example.com ",
    });
    expect(canonicalUserId).toBeTruthy();
    expect(db.list("users").filter((user) => user.email === "coach@example.com")).toHaveLength(1);
  });

  it("skips migration dedupe for duplicate emails that were never verified", async () => {
    const db = new InMemoryConvexDb();
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    });

    const duplicateEmails = await (getDuplicateUserEmails as any)._handler({ db }, {});
    expect(duplicateEmails).toEqual([]);

    const result = await (dedupeUsersForEmail as any)._handler(createMutationCtx({ db }) as any, {
      email: "coach@example.com",
    });
    expect(result).toBeNull();
    expect(db.list("users").filter((user) => user.email === "coach@example.com")).toHaveLength(2);
  });

  it("refuses to merge mixed instructor and studio accounts sharing an email", async () => {
    const db = new InMemoryConvexDb();
    const instructorUserId = (await db.insert("users", {
      role: "instructor",
      onboardingComplete: true,
      isActive: true,
      email: "shared@example.com",
      emailVerificationTime: FIXED_NOW,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })) as Id<"users">;
    const studioUserId = (await db.insert("users", {
      role: "studio",
      onboardingComplete: true,
      isActive: true,
      email: "shared@example.com",
      emailVerificationTime: FIXED_NOW + 1,
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    })) as Id<"users">;
    await db.insert("instructorProfiles", {
      userId: instructorUserId,
      displayName: "Coach",
      notificationsEnabled: false,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("studioProfiles", {
      userId: studioUserId,
      studioName: "Studio",
      address: "Addr",
      zone: "tlv",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });

    const result = await dedupeUsersByEmail({
      ctx: createMutationCtx({ db }) as any,
      normalizedEmail: "shared@example.com",
      requireVerifiedUser: true,
      now: FIXED_NOW + 100,
    });

    expect(result).toBeNull();
    expect(db.list("users").filter((user) => user.email === "shared@example.com")).toHaveLength(2);
    expect(db.list("instructorProfiles")).toHaveLength(1);
    expect(db.list("studioProfiles")).toHaveLength(1);
  });

  it("runs the migration action for a single email and respects the access token", async () => {
    const db = new InMemoryConvexDb();
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      emailVerificationTime: FIXED_NOW,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await db.insert("users", {
      role: "pending",
      onboardingComplete: false,
      isActive: true,
      email: "coach@example.com",
      emailVerificationTime: FIXED_NOW + 1,
      createdAt: FIXED_NOW + 1,
      updatedAt: FIXED_NOW + 1,
    });

    const originalToken = process.env.MIGRATIONS_ACCESS_TOKEN;
    process.env.MIGRATIONS_ACCESS_TOKEN = "test-token";
    try {
      const actionCtx = {
        runQuery: async (_fn: unknown, args: unknown) => await (getDuplicateUserEmails as any)._handler({ db }, args),
        runMutation: async (_fn: unknown, args: unknown) =>
          await (dedupeUsersForEmail as any)._handler(createMutationCtx({ db }) as any, args),
      };

      const result = await (dedupeDuplicateUsersByEmail as any)._handler(actionCtx, {
        email: "coach@example.com",
        accessToken: "test-token",
      });

      expect(result.scannedEmails).toBe(1);
      expect(result.dedupedEmails).toBe(1);
      expect(result.duplicateEmails).toEqual(["coach@example.com"]);
      expect(db.list("users").filter((user) => user.email === "coach@example.com")).toHaveLength(1);
    } finally {
      process.env.MIGRATIONS_ACCESS_TOKEN = originalToken;
    }
  });
});
