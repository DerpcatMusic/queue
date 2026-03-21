import { omitUndefined } from "./validation";

export const GOOGLE_PROVIDER = "google" as const;
export const GOOGLE_EVENT_SOURCE_KEY = "queueSource";
export const GOOGLE_EVENT_SOURCE_VALUE = "queue-job";
export const GOOGLE_EVENT_EXTERNAL_ID_KEY = "queueExternalEventId";

export type CalendarOwnerRole = "instructor" | "studio";

export type TimelineRow = {
  lessonId: string;
  roleView: CalendarOwnerRole;
  studioName: string;
  instructorName?: string;
  sport: string;
  startTime: number;
  endTime: number;
  timeZone?: string;
  status: "open" | "filled" | "cancelled" | "completed";
};

export type GoogleCalendarEvent = {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  extendedProperties?: {
    private?: Record<string, string | undefined>;
  };
};

export type ImportedGoogleCalendarEvent = {
  providerEventId: string;
  title: string;
  status: "confirmed" | "tentative" | "cancelled";
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  location?: string;
  htmlLink?: string;
  timeZone?: string;
  providerUpdatedAt?: number;
};

export function buildGoogleEventBody(row: TimelineRow) {
  const descriptionLines = [
    row.roleView === "studio" ? "Queue posted job" : "Queue accepted job",
    `Studio: ${row.studioName}`,
    ...(row.instructorName ? [`Instructor: ${row.instructorName}`] : []),
  ];

  return {
    summary: `${row.sport} lesson`,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: new Date(row.startTime).toISOString(),
      ...(row.timeZone ? { timeZone: row.timeZone } : {}),
    },
    end: {
      dateTime: new Date(row.endTime).toISOString(),
      ...(row.timeZone ? { timeZone: row.timeZone } : {}),
    },
    extendedProperties: {
      private: {
        [GOOGLE_EVENT_SOURCE_KEY]: GOOGLE_EVENT_SOURCE_VALUE,
        [GOOGLE_EVENT_EXTERNAL_ID_KEY]: row.lessonId,
      },
    },
  };
}

function parseGoogleEventTimestamp(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function normalizeImportedGoogleEvent(
  event: GoogleCalendarEvent,
): ImportedGoogleCalendarEvent | null {
  const providerEventId = event.id?.trim();
  if (!providerEventId) {
    return null;
  }

  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startTime = parseGoogleEventTimestamp(event.start?.dateTime ?? event.start?.date);
  const endTime = parseGoogleEventTimestamp(event.end?.dateTime ?? event.end?.date);
  if (startTime === undefined || endTime === undefined || endTime <= startTime) {
    return null;
  }

  const status =
    event.status === "cancelled"
      ? "cancelled"
      : event.status === "tentative"
        ? "tentative"
        : "confirmed";
  const title = event.summary?.trim() || "Google Calendar event";
  const providerUpdatedAt = parseGoogleEventTimestamp(event.updated);

  return {
    providerEventId,
    title,
    status,
    startTime,
    endTime,
    isAllDay,
    ...omitUndefined({
      location: event.location?.trim() || undefined,
      htmlLink: event.htmlLink?.trim() || undefined,
      timeZone: event.start?.timeZone ?? event.end?.timeZone,
      providerUpdatedAt,
    }),
  };
}

export function isQueueManagedGoogleEvent(
  event: GoogleCalendarEvent,
  mappedProviderEventIds: ReadonlySet<string>,
) {
  const providerEventId = event.id?.trim();
  if (providerEventId && mappedProviderEventIds.has(providerEventId)) {
    return true;
  }

  return event.extendedProperties?.private?.[GOOGLE_EVENT_SOURCE_KEY] === GOOGLE_EVENT_SOURCE_VALUE;
}
