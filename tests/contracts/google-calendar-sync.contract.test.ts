import { describe, expect, it } from "bun:test";

import {
  isQueueManagedGoogleEvent,
  normalizeImportedGoogleEvent,
} from "../../convex/calendar";

describe("google calendar sync contracts", () => {
  it("normalizes timed Google events into agenda rows", () => {
    const event = normalizeImportedGoogleEvent({
      id: "google-event-1",
      summary: "Pilates class",
      status: "confirmed",
      location: "Studio A",
      htmlLink: "https://calendar.google.com/event?eid=123",
      updated: "2026-03-10T08:15:00.000Z",
      start: {
        dateTime: "2026-03-12T09:00:00.000Z",
        timeZone: "UTC",
      },
      end: {
        dateTime: "2026-03-12T10:00:00.000Z",
        timeZone: "UTC",
      },
    });

    expect(event).toEqual({
      providerEventId: "google-event-1",
      title: "Pilates class",
      status: "confirmed",
      startTime: Date.parse("2026-03-12T09:00:00.000Z"),
      endTime: Date.parse("2026-03-12T10:00:00.000Z"),
      isAllDay: false,
      location: "Studio A",
      htmlLink: "https://calendar.google.com/event?eid=123",
      timeZone: "UTC",
      providerUpdatedAt: Date.parse("2026-03-10T08:15:00.000Z"),
    });
  });

  it("normalizes all-day Google events using Google’s exclusive end date", () => {
    const event = normalizeImportedGoogleEvent({
      id: "google-event-2",
      summary: "Holiday",
      start: { date: "2026-03-20" },
      end: { date: "2026-03-21" },
    });

    expect(event).toEqual({
      providerEventId: "google-event-2",
      title: "Holiday",
      status: "confirmed",
      startTime: Date.parse("2026-03-20"),
      endTime: Date.parse("2026-03-21"),
      isAllDay: true,
    });
  });

  it("treats Queue-managed Google events as import exclusions", () => {
    expect(
      isQueueManagedGoogleEvent(
        {
          id: "provider-event-1",
          extendedProperties: {
            private: {
              queueSource: "queue-job",
            },
          },
        },
        new Set<string>(),
      ),
    ).toBe(true);

    expect(
      isQueueManagedGoogleEvent(
        {
          id: "provider-event-2",
        },
        new Set(["provider-event-2"]),
      ),
    ).toBe(true);

    expect(
      isQueueManagedGoogleEvent(
        {
          id: "provider-event-3",
          extendedProperties: {
            private: {
              queueSource: "other-system",
            },
          },
        },
        new Set<string>(),
      ),
    ).toBe(false);
  });
});
