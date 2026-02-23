import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_CALENDAR_ID_PREFIX = "@queue/device-calendar-id:";
const QUEUE_MANAGED_EVENT_PREFIX = "queue-session:";
const QUEUE_MANAGED_EVENT_URL_PREFIX = "queue://session/";
const SYNC_RANGE_PADDING_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPO_CALENDAR_IMPORT_ERROR =
  "Expo Calendar native module is unavailable in this build.";

export type DeviceCalendarProvider = "none" | "google" | "apple";

export type DeviceCalendarSyncEvent = {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  timeZone?: string;
  location?: string;
  notes?: string;
};

export type DeviceCalendarSyncResult = {
  status:
    | "synced"
    | "disabled"
    | "unsupported"
    | "permission_denied"
    | "failed";
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  calendarId?: string;
  message?: string;
};

type ExpoCalendarModule = typeof import("expo-calendar");
type CalendarLikeEvent = {
  id?: string;
  startDate: Date | string | number;
  endDate: Date | string | number;
  title?: string | null;
  location?: string | null;
  notes?: string | null;
  url?: string | null;
  timeZone?: string | null;
};
type ManagedCalendarEvent = CalendarLikeEvent & { id: string };

let calendarModulePromise: Promise<ExpoCalendarModule | null> | null = null;

async function loadCalendarModule() {
  if (!calendarModulePromise) {
    calendarModulePromise = import("expo-calendar")
      .then((module) => module)
      .catch(() => null);
  }
  return calendarModulePromise;
}

function hasCalendarPermission(
  response: { granted?: boolean; status?: string },
) {
  return response.granted || response.status === "granted";
}

function toDate(value: Date | string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function toIsoMs(value: Date | string | number) {
  return toDate(value).getTime();
}

function buildManagedToken(eventId: string) {
  return `${QUEUE_MANAGED_EVENT_PREFIX}${eventId}`;
}

function getStorageCalendarIdKey(provider: DeviceCalendarProvider) {
  return `${STORAGE_CALENDAR_ID_PREFIX}${provider}`;
}

function getQueueCalendarTitle(provider: DeviceCalendarProvider) {
  if (provider === "google") return "Queue Sessions (Google)";
  if (provider === "apple") return "Queue Sessions (Apple)";
  return "Queue Sessions";
}

function buildManagedUrl(eventId: string) {
  return `${QUEUE_MANAGED_EVENT_URL_PREFIX}${eventId}`;
}

function buildManagedNotes(baseNotes: string | undefined, eventId: string) {
  const token = buildManagedToken(eventId);
  if (!baseNotes || baseNotes.trim().length === 0) {
    return token;
  }
  if (baseNotes.includes(token)) {
    return baseNotes;
  }
  return `${baseNotes.trim()}\n\n${token}`;
}

function extractManagedEventId(event: CalendarLikeEvent) {
  const url = typeof event.url === "string" ? event.url : "";
  if (url.startsWith(QUEUE_MANAGED_EVENT_URL_PREFIX)) {
    const fromUrl = url.slice(QUEUE_MANAGED_EVENT_URL_PREFIX.length).trim();
    if (fromUrl.length > 0) return fromUrl;
  }

  const notes = typeof event.notes === "string" ? event.notes : "";
  const match = notes.match(/queue-session:([^\s]+)/);
  if (!match || !match[1]) return null;
  return match[1];
}

function eventNeedsUpdate(
  existing: CalendarLikeEvent,
  next: DeviceCalendarSyncEvent,
) {
  const existingStart = toIsoMs(existing.startDate);
  const existingEnd = toIsoMs(existing.endDate);
  if (existingStart !== next.startTime) return true;
  if (existingEnd !== next.endTime) return true;
  if ((existing.title ?? "") !== next.title) return true;
  if ((existing.location ?? "") !== (next.location ?? "")) return true;

  const nextNotes = buildManagedNotes(next.notes, next.id);
  if ((existing.notes ?? "") !== nextNotes) return true;

  const nextUrl = buildManagedUrl(next.id);
  if ((existing.url ?? "") !== nextUrl) return true;

  if ((existing.timeZone ?? "") !== (next.timeZone ?? "")) return true;
  return false;
}

async function resolveIosSource(
  Calendar: ExpoCalendarModule,
  preferredProvider: DeviceCalendarProvider,
) {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const loweredProvider = preferredProvider.toLowerCase();

  if (preferredProvider !== "none") {
    const providerSourceCalendar = calendars.find((calendar) => {
      const sourceName = `${calendar.source?.name ?? ""}`.toLowerCase();
      const owner = `${calendar.ownerAccount ?? ""}`.toLowerCase();
      if (loweredProvider === "google") {
        return sourceName.includes("google") || owner.includes("gmail");
      }
      if (loweredProvider === "apple") {
        return sourceName.includes("icloud") || sourceName.includes("apple");
      }
      return false;
    });
    if (providerSourceCalendar?.source) {
      return providerSourceCalendar.source;
    }
  }

  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  if (defaultCalendar.source) {
    return defaultCalendar.source;
  }

  const fallback = calendars.find((calendar) => calendar.source);
  return fallback?.source;
}

async function ensureQueueCalendarId(
  Calendar: ExpoCalendarModule,
  preferredProvider: DeviceCalendarProvider,
) {
  const storageKey = getStorageCalendarIdKey(preferredProvider);
  const queueCalendarTitle = getQueueCalendarTitle(preferredProvider);
  const storedId = await AsyncStorage.getItem(storageKey);
  if (storedId) {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const existing = calendars.find((calendar) => calendar.id === storedId);
      if (existing) return storedId;
    } catch {
      await AsyncStorage.removeItem(storageKey);
    }
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existingByTitle = calendars.find(
    (calendar) => calendar.title === queueCalendarTitle,
  );
  if (existingByTitle?.id) {
    await AsyncStorage.setItem(storageKey, existingByTitle.id);
    return existingByTitle.id;
  }

  let createdCalendarId: string | null = null;
  if (Platform.OS === "ios") {
    const source = await resolveIosSource(Calendar, preferredProvider);
    if (!source?.id) {
      throw new Error("No writable iOS calendar source found");
    }
    createdCalendarId = await Calendar.createCalendarAsync({
      title: queueCalendarTitle,
      color: "#2D8CFF",
      entityType: Calendar.EntityTypes.EVENT,
      name: "queue_sessions",
      sourceId: source.id,
      source,
      ownerAccount: "Queue",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  } else {
    createdCalendarId = await Calendar.createCalendarAsync({
      title: queueCalendarTitle,
      color: "#2D8CFF",
      entityType: Calendar.EntityTypes.EVENT,
      name: "queue_sessions",
      ownerAccount: "Queue",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      source: {
        isLocalAccount: true,
        name: queueCalendarTitle,
        type: Calendar.SourceType.LOCAL,
      },
    });
  }

  if (!createdCalendarId) {
    throw new Error("Failed to create device calendar");
  }

  await AsyncStorage.setItem(storageKey, createdCalendarId);
  return createdCalendarId;
}

async function ensureCalendarPermission(Calendar: ExpoCalendarModule) {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (hasCalendarPermission(current)) return true;

  const requested = await Calendar.requestCalendarPermissionsAsync();
  return hasCalendarPermission(requested);
}

let syncInFlight: Promise<DeviceCalendarSyncResult> | null = null;
let queuedInput: {
  enabled: boolean;
  preferredProvider: DeviceCalendarProvider;
  events: DeviceCalendarSyncEvent[];
} | null = null;

async function runDeviceCalendarSync(input: {
  enabled: boolean;
  preferredProvider: DeviceCalendarProvider;
  events: DeviceCalendarSyncEvent[];
}): Promise<DeviceCalendarSyncResult> {
  if (!input.enabled || input.preferredProvider === "none") {
    return {
      status: "disabled",
      created: 0,
      updated: 0,
      removed: 0,
      skipped: 0,
    };
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return {
      status: "unsupported",
      created: 0,
      updated: 0,
      removed: 0,
      skipped: input.events.length,
      message: "Device calendar sync is only available on iOS and Android.",
    };
  }

  const Calendar = await loadCalendarModule();
  if (!Calendar) {
    return {
      status: "unsupported",
      created: 0,
      updated: 0,
      removed: 0,
      skipped: input.events.length,
      message:
        `${EXPO_CALENDAR_IMPORT_ERROR} Rebuild your dev client after adding expo-calendar.`,
    };
  }

  const permissionGranted = await ensureCalendarPermission(Calendar);
  if (!permissionGranted) {
    return {
      status: "permission_denied",
      created: 0,
      updated: 0,
      removed: 0,
      skipped: input.events.length,
    };
  }

  try {
    const calendarId = await ensureQueueCalendarId(
      Calendar,
      input.preferredProvider,
    );

    const now = Date.now();
    const earliestEvent = input.events.reduce(
      (minValue, event) => Math.min(minValue, event.startTime),
      now,
    );
    const latestEvent = input.events.reduce(
      (maxValue, event) => Math.max(maxValue, event.endTime),
      now + 60 * DAY_MS,
    );

    const rangeStart = new Date(earliestEvent - SYNC_RANGE_PADDING_DAYS * DAY_MS);
    const rangeEnd = new Date(latestEvent + SYNC_RANGE_PADDING_DAYS * DAY_MS);

    const existing = await Calendar.getEventsAsync(
      [calendarId],
      rangeStart,
      rangeEnd,
    );

    const managedById = new Map<string, ManagedCalendarEvent>();
    for (const event of existing) {
      if (!event.id) continue;
      const managedId = extractManagedEventId(event);
      if (!managedId) continue;
      managedById.set(managedId, event as ManagedCalendarEvent);
    }

    let created = 0;
    let updated = 0;
    let removed = 0;

    const desiredIds = new Set(input.events.map((event) => event.id));
    for (const session of input.events) {
      const existingEvent = managedById.get(session.id);
      const nextPayload = {
        title: session.title,
        startDate: new Date(session.startTime),
        endDate: new Date(session.endTime),
        location: session.location ?? null,
        notes: buildManagedNotes(session.notes, session.id),
        url: buildManagedUrl(session.id),
        allDay: false,
        ...(session.timeZone ? { timeZone: session.timeZone } : {}),
      };

      if (!existingEvent) {
        await Calendar.createEventAsync(calendarId, nextPayload);
        created += 1;
        continue;
      }

      if (!eventNeedsUpdate(existingEvent, session)) {
        continue;
      }

      await Calendar.updateEventAsync(existingEvent.id, nextPayload);
      updated += 1;
    }

    for (const [managedId, existingEvent] of managedById.entries()) {
      if (desiredIds.has(managedId)) continue;
      await Calendar.deleteEventAsync(existingEvent.id);
      removed += 1;
    }

    return {
      status: "synced",
      created,
      updated,
      removed,
      skipped: 0,
      calendarId,
    };
  } catch (error) {
    return {
      status: "failed",
      created: 0,
      updated: 0,
      removed: 0,
      skipped: input.events.length,
      message: error instanceof Error ? error.message : "Calendar sync failed.",
    };
  }
}

export async function syncAcceptedSessionsToDeviceCalendar(input: {
  enabled: boolean;
  preferredProvider: DeviceCalendarProvider;
  events: DeviceCalendarSyncEvent[];
}) {
  if (syncInFlight) {
    queuedInput = input;
    return syncInFlight;
  }

  syncInFlight = (async (): Promise<DeviceCalendarSyncResult> => {
    let latestResult = await runDeviceCalendarSync(input);

    while (queuedInput) {
      const nextInput = queuedInput;
      queuedInput = null;
      latestResult = await runDeviceCalendarSync(nextInput);
    }

    return latestResult;
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
