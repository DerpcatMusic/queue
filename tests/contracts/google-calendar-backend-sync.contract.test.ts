import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import { getCalendarTimelineForUser } from "../../convex/calendar";
import { InMemoryConvexDb } from "../in-memory-convex";

describe("google calendar backend sync contracts", () => {
  it("loads instructor timeline rows by user id for scheduled syncs", async () => {
    const db = new InMemoryConvexDb();
    const userId = (await db.insert("users", {
      email: "coach@example.com",
      role: "instructor",
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })) as Id<"users">;
    const instructorId = (await db.insert("instructorProfiles", {
      userId,
      displayName: "Coach One",
      sports: ["tennis"],
      zones: [],
      sessionLanguages: ["en"],
      requiredLevels: ["beginner"],
      bio: "Coach",
      experienceYears: 3,
      hourlyRate: 150,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })) as Id<"instructorProfiles">;
    const studioId = (await db.insert("studioProfiles", {
      userId: "users:studio-1",
      studioName: "Baseline Studio",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })) as Id<"studioProfiles">;

    await db.insert("jobs", {
      studioId,
      sport: "pilates",
      zone: "tel-aviv",
      startTime: 1_800_000_100_000,
      endTime: 1_800_000_103_600,
      pay: 220,
      status: "cancelled",
      filledByInstructorId: instructorId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.insert("jobs", {
      studioId,
      sport: "tennis",
      zone: "tel-aviv",
      startTime: 1_800_000_000_000,
      endTime: 1_800_000_003_600,
      pay: 200,
      status: "filled",
      filledByInstructorId: instructorId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const rows = await (getCalendarTimelineForUser as any)._handler(
      { db },
      {
        userId,
        startTime: 1_799_999_000_000,
        endTime: 1_800_001_000_000,
        limit: 20,
      },
    );

    expect(rows).toEqual([
      {
        lessonId: "jobs:2",
        roleView: "instructor",
        studioName: "Baseline Studio",
        instructorName: "Coach One",
        sport: "tennis",
        startTime: 1_800_000_000_000,
        endTime: 1_800_000_003_600,
        status: "filled",
      },
      {
        lessonId: "jobs:1",
        roleView: "instructor",
        studioName: "Baseline Studio",
        instructorName: "Coach One",
        sport: "pilates",
        startTime: 1_800_000_100_000,
        endTime: 1_800_000_103_600,
        status: "cancelled",
      },
    ]);
  });
});
