import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requestNotificationPermissionIfNeeded } from "@/lib/notification-permissions";

const LESSON_REMINDERS_STORAGE_KEY = "lesson_reminders_v1";
const MINUTE_MS = 60 * 1000;

type ReminderRecord = {
  identifier: string;
  triggerAt: number;
  leadMinutes: number;
  startTime: number;
};

type ReminderMap = Record<string, ReminderRecord>;

type NotificationsModule = typeof import("expo-notifications");

let notificationsModulePromise: Promise<NotificationsModule> | null = null;

async function getNotificationsModule() {
  if (Platform.OS === "web") {
    throw new Error("Local reminders are not supported on web.");
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }

  return notificationsModulePromise;
}

async function ensureNotificationPermission() {
  const Notifications = await getNotificationsModule();
  const hasPermission =
    await requestNotificationPermissionIfNeeded(Notifications);
  if (!hasPermission) {
    throw new Error("Notification permission is required for reminders.");
  }
}

async function ensureReminderChannel() {
  if (Platform.OS !== "android") {
    return;
  }
  const Notifications = await getNotificationsModule();
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });
}

async function readReminderMap(): Promise<ReminderMap> {
  const raw = await AsyncStorage.getItem(LESSON_REMINDERS_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as ReminderMap;
  } catch {
    return {};
  }
}

async function writeReminderMap(reminders: ReminderMap) {
  await AsyncStorage.setItem(
    LESSON_REMINDERS_STORAGE_KEY,
    JSON.stringify(reminders),
  );
}

export async function getLessonReminder(jobId: string) {
  const reminders = await readReminderMap();
  return reminders[jobId] ?? null;
}

export async function setLessonReminder(args: {
  jobId: string;
  sportLabel: string;
  studioName: string;
  startTime: number;
  leadMinutes: number;
}): Promise<ReminderRecord> {
  await ensureNotificationPermission();
  await ensureReminderChannel();

  const triggerAt = args.startTime - args.leadMinutes * MINUTE_MS;
  if (triggerAt <= Date.now() + 5_000) {
    throw new Error("Reminder time must be in the future.");
  }

  const reminders = await readReminderMap();
  const existing = reminders[args.jobId];
  if (existing) {
    const Notifications = await getNotificationsModule();
    await Notifications.cancelScheduledNotificationAsync(existing.identifier);
  }

  const Notifications = await getNotificationsModule();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Lesson reminder",
      body: `${args.sportLabel} at ${args.studioName} starts in ${args.leadMinutes} min.`,
      data: {
        type: "lesson_reminder",
        jobId: args.jobId,
      },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerAt),
      channelId: "default",
    },
  });

  const nextReminder: ReminderRecord = {
    identifier,
    triggerAt,
    leadMinutes: args.leadMinutes,
    startTime: args.startTime,
  };
  reminders[args.jobId] = nextReminder;
  await writeReminderMap(reminders);

  return nextReminder;
}

export async function clearLessonReminder(jobId: string) {
  const reminders = await readReminderMap();
  const existing = reminders[jobId];
  if (!existing) {
    return false;
  }
  const Notifications = await getNotificationsModule();
  await Notifications.cancelScheduledNotificationAsync(existing.identifier);
  delete reminders[jobId];
  await writeReminderMap(reminders);
  return true;
}
