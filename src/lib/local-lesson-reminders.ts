const LOCAL_LESSON_REMINDER_PREFIX = "queue:local-lesson-reminder";
const LOCAL_REMINDER_HORIZON_MS = 24 * 60 * 60 * 1000;

type TimelineLesson = {
  lessonId: string;
  roleView: "instructor" | "studio";
  studioName: string;
  instructorName?: string;
  sport: string;
  startTime: number;
  status: "open" | "filled" | "cancelled" | "completed";
  lifecycle: "upcoming" | "live" | "past" | "cancelled";
};

function buildReminderKey(lessonId: string, leadMinutes: number, roleView: string) {
  return `${LOCAL_LESSON_REMINDER_PREFIX}:${roleView}:${lessonId}:${leadMinutes}`;
}

function formatReminderTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function getLocalReminderHorizonMs() {
  return LOCAL_REMINDER_HORIZON_MS;
}

export async function syncLocalLessonReminders(args: {
  lessons: TimelineLesson[];
  leadMinutes: number;
}) {
  const Notifications = await import("expo-notifications");
  const now = Date.now();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existingByKey = new Map<
    string,
    {
      identifier: string;
      date?: number;
    }
  >();

  for (const row of scheduled) {
    const key =
      typeof row.content.data?.localScheduleKey === "string"
        ? row.content.data.localScheduleKey
        : null;
    if (!key || !key.startsWith(LOCAL_LESSON_REMINDER_PREFIX)) {
      continue;
    }
    const date =
      row.trigger && "date" in row.trigger && row.trigger.date instanceof Date
        ? row.trigger.date.getTime()
        : row.trigger && "value" in row.trigger && typeof row.trigger.value === "number"
          ? row.trigger.value
          : undefined;
    existingByKey.set(key, {
      identifier: row.identifier,
      ...(date !== undefined ? { date } : {}),
    });
  }

  const desiredKeys = new Set<string>();

  for (const lesson of args.lessons) {
    if (lesson.status !== "filled" || lesson.lifecycle !== "upcoming") {
      continue;
    }

    const triggerAt = lesson.startTime - args.leadMinutes * 60 * 1000;
    if (triggerAt <= now || triggerAt > now + LOCAL_REMINDER_HORIZON_MS) {
      continue;
    }

    const key = buildReminderKey(lesson.lessonId, args.leadMinutes, lesson.roleView);
    desiredKeys.add(key);

    const existing = existingByKey.get(key);
    if (existing?.date === triggerAt) {
      continue;
    }
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing.identifier).catch(() => undefined);
    }

    const counterpart =
      lesson.roleView === "instructor"
        ? lesson.studioName
        : lesson.instructorName ?? lesson.studioName;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Lesson reminder",
        body: `${lesson.sport} with ${counterpart} starts at ${formatReminderTime(lesson.startTime)}.`,
        data: {
          localScheduleKey: key,
          type: "lesson_reminder",
          jobId: lesson.lessonId,
          leadMinutes: args.leadMinutes,
          localOnly: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerAt),
      },
    });
  }

  for (const [key, existing] of existingByKey.entries()) {
    if (desiredKeys.has(key)) {
      continue;
    }
    await Notifications.cancelScheduledNotificationAsync(existing.identifier).catch(() => undefined);
  }
}

export async function clearLocalLessonReminders() {
  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (row) =>
          typeof row.content.data?.localScheduleKey === "string" &&
          row.content.data.localScheduleKey.startsWith(LOCAL_LESSON_REMINDER_PREFIX),
      )
      .map((row) => Notifications.cancelScheduledNotificationAsync(row.identifier).catch(() => undefined)),
  );
}
