import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { Brand } from "@/constants/brand";

const QUEUE_CALENDAR_TITLE = "Queue Sessions";
const STORAGE_KEY = "calendar:device-sync:v1";

type StoredDeviceSyncState = {
  calendarId: string;
  eventIdByExternalId: Record<string, string>;
};

export type DeviceCalendarSyncEvent = {
  externalId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  location?: string;
  timeZone?: string;
};

type PrepareSyncResult =
  | { ok: true; calendarId: string }
  | {
      ok: false;
      reason: "unsupported_platform" | "permission_denied" | "calendar_unavailable";
    };

type SyncEventsResult =
  | { ok: true; calendarId: string; syncedCount: number }
  | { ok: false; reason: "unsupported_platform" | "permission_denied" | "calendar_unavailable" };

function isSupportedPlatform() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function readState(): Promise<StoredDeviceSyncState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDeviceSyncState;
  } catch {
    return null;
  }
}

async function writeState(state: StoredDeviceSyncState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function ensureCalendarPermission() {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.status === "granted") return true;
  const requested = await Calendar.requestCalendarPermissionsAsync();
  return requested.status === "granted";
}

async function getExistingQueueCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((calendar) => calendar.title === QUEUE_CALENDAR_TITLE);
  return existing?.id ?? null;
}

async function createQueueCalendar() {
  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    const sourceId = defaultCalendar.source?.id;
    if (!sourceId) return null;
    return Calendar.createCalendarAsync({
      title: QUEUE_CALENDAR_TITLE,
      color: String(Brand.primary),
      entityType: Calendar.EntityTypes.EVENT,
      sourceId,
      name: QUEUE_CALENDAR_TITLE,
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  }

  return Calendar.createCalendarAsync({
    title: QUEUE_CALENDAR_TITLE,
    color: String(Brand.primary),
    entityType: Calendar.EntityTypes.EVENT,
    name: QUEUE_CALENDAR_TITLE,
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

async function ensureQueueCalendar() {
  const existingId = await getExistingQueueCalendarId();
  if (existingId) return existingId;
  return createQueueCalendar();
}

function buildEventDetails(event: DeviceCalendarSyncEvent) {
  return {
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    notes: event.notes ?? "",
    location: event.location ?? null,
    timeZone: event.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export async function prepareDeviceCalendarSync(): Promise<PrepareSyncResult> {
  if (!isSupportedPlatform()) {
    return { ok: false, reason: "unsupported_platform" };
  }

  const granted = await ensureCalendarPermission();
  if (!granted) {
    return { ok: false, reason: "permission_denied" };
  }

  const calendarId = await ensureQueueCalendar();
  if (!calendarId) {
    return { ok: false, reason: "calendar_unavailable" };
  }

  return { ok: true, calendarId };
}

export async function syncDeviceCalendarEvents(
  events: DeviceCalendarSyncEvent[],
): Promise<SyncEventsResult> {
  const preparation = await prepareDeviceCalendarSync();
  if (!preparation.ok) {
    return preparation;
  }

  const calendarId = preparation.calendarId;
  const previousState = await readState();
  const previousMap = previousState?.eventIdByExternalId ?? {};
  const nextMap: Record<string, string> = {};

  for (const event of events) {
    const knownEventId = previousMap[event.externalId];
    const details = buildEventDetails(event) as Calendar.Event;
    if (knownEventId) {
      try {
        const existingEvent = await Calendar.getEventAsync(knownEventId);
        if (existingEvent?.id) {
          await Calendar.updateEventAsync(existingEvent.id, details);
          nextMap[event.externalId] = existingEvent.id;
          continue;
        }
      } catch {
        // If the event no longer exists, we recreate it below.
      }
    }

    const newEventId = await Calendar.createEventAsync(calendarId, details);
    nextMap[event.externalId] = newEventId;
  }

  const nextExternalIds = new Set(Object.keys(nextMap));
  for (const [externalId, eventId] of Object.entries(previousMap)) {
    if (nextExternalIds.has(externalId)) continue;
    try {
      await Calendar.deleteEventAsync(eventId);
    } catch {
      // Ignore stale/deleted event failures.
    }
  }

  await writeState({
    calendarId,
    eventIdByExternalId: nextMap,
  });

  return { ok: true, calendarId, syncedCount: events.length };
}
