export const MINUTE_MS = 60 * 1000;
export const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
export const DURATION_PRESETS = [45, 60, 75, 90] as const;
export const PAY_PRESETS = [180, 220, 260, 320] as const;
export const CANCELLATION_PRESETS = [6, 12, 24, 48] as const;
export const APPLICATION_LEAD_PRESETS = [30, 60, 120, 180] as const;
export const MAX_PARTICIPANTS_MIN = 1;
export const MAX_PARTICIPANTS_MAX = 40;

export const JOB_STATUS_TRANSLATION_KEYS = {
  open: "jobsTab.status.job.open",
  filled: "jobsTab.status.job.filled",
  cancelled: "jobsTab.status.job.cancelled",
  completed: "jobsTab.status.job.completed",
} as const;

export const APPLICATION_STATUS_TRANSLATION_KEYS = {
  pending: "jobsTab.status.application.pending",
  accepted: "jobsTab.status.application.accepted",
  rejected: "jobsTab.status.application.rejected",
  withdrawn: "jobsTab.status.application.withdrawn",
} as const;

export function getApplicationStatusTranslationKey(status: string) {
  const key = status as keyof typeof APPLICATION_STATUS_TRANSLATION_KEYS;
  return (
    APPLICATION_STATUS_TRANSLATION_KEYS[key] ??
    APPLICATION_STATUS_TRANSLATION_KEYS.pending
  );
}

export type PickerTarget = "start" | "end";
export type LessonLifecycle = "live" | "upcoming" | "needs_done" | "completed";

export type StudioDraft = {
  sport: string;
  startTime: number;
  endTime: number;
  payInput: string;
  note: string;
  maxParticipants: number;
  cancellationDeadlineHours: number;
  applicationLeadMinutes: number;
};

export type ReminderMap = Record<
  string,
  {
    triggerAt: number;
    leadMinutes: number;
    startTime: number;
  }
>;

export type ClockAnchor = {
  serverNow: number;
  monotonicNow: number;
};

export function sanitizeDecimalInput(value: string): string {
  const stripped = value.replace(/[^0-9.]/g, "");
  const parts = stripped.split(".");
  if (parts.length <= 1) return stripped;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export function createDefaultStudioDraft(): StudioDraft {
  const startTime = Date.now() + 90 * MINUTE_MS;
  return {
    sport: "",
    startTime,
    endTime: startTime + 60 * MINUTE_MS,
    payInput: "250",
    note: "",
    maxParticipants: 12,
    cancellationDeadlineHours: 24,
    applicationLeadMinutes: 60,
  };
}

export function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function formatDateTime(value: number, locale: string, timeZone = DEVICE_TIME_ZONE) {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function getJobStatusTone(status: keyof typeof JOB_STATUS_TRANSLATION_KEYS) {
  if (status === "open") return "primary";
  if (status === "filled" || status === "completed") return "success";
  return "muted";
}

export function formatCompactDateTime(
  value: number,
  locale: string,
  timeZone = DEVICE_TIME_ZONE,
) {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatRelativeDuration(ms: number) {
  const safeMs = Math.max(ms, 0);
  const roundedMinutes = Math.max(1, Math.round(safeMs / MINUTE_MS));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getLessonProgress(now: number, startTime: number, endTime: number) {
  if (endTime <= startTime) return 0;
  return clamp((now - startTime) / (endTime - startTime), 0, 1);
}

export function getMonotonicNow() {
  const value = globalThis.performance?.now?.();
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
