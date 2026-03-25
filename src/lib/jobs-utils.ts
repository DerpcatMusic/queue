import type { Id } from "@/convex/_generated/dataModel";

export const MINUTE_MS = 60 * 1000;
export const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
export const DURATION_PRESETS = [45, 60, 75, 90] as const;
export const PAY_PRESETS = [180, 220, 260, 320] as const;
export const CANCELLATION_PRESETS = [6, 12, 24, 48] as const;
export const APPLICATION_LEAD_PRESETS = [30, 60, 120, 180] as const;
export const EXPIRY_OVERRIDE_PRESETS = [15, 30, 45, 60] as const;
export const BOOST_PRESET_VALUES = {
  small: 20,
  medium: 50,
  large: 100,
} as const;
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

export type JobStatus = keyof typeof JOB_STATUS_TRANSLATION_KEYS;
export type JobClosureReason = "studio_cancelled" | "expired" | "filled";
export type JobStatusTone = "primary" | "success" | "muted" | "amber" | "gray";

export function getApplicationStatusTranslationKey(status: string) {
  const key = status as keyof typeof APPLICATION_STATUS_TRANSLATION_KEYS;
  return APPLICATION_STATUS_TRANSLATION_KEYS[key] ?? APPLICATION_STATUS_TRANSLATION_KEYS.pending;
}

export type PickerTarget = "start" | "end";
export type LessonLifecycle = "live" | "upcoming" | "needs_done" | "completed";
export type BoostPreset = keyof typeof BOOST_PRESET_VALUES;

type ExpiryPresentation = {
  isExpired: boolean;
  key: string;
  interpolation: Record<string, number | string>;
  relativeText: string;
  exactText: string;
  text: string;
};

type BoostPresentation = {
  totalPay: number;
  bonusAmount: number | undefined;
  badge: string | undefined;
  badgeKey: string | undefined;
  badgeInterpolation: Record<string, number | string>;
};

export type StudioDraft = {
  branchId: Id<"studioBranches"> | null;
  sport: string;
  startTime: number;
  endTime: number;
  payInput: string;
  note: string;
  maxParticipants: number;
  cancellationDeadlineHours: number;
  applicationLeadMinutes: number;
  expiryOverrideMinutes: number | undefined;
  boostPreset: BoostPreset | undefined;
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

export function createDefaultStudioDraft(branchId: StudioDraft["branchId"] = null): StudioDraft {
  const startTime = Date.now() + 90 * MINUTE_MS;
  return {
    branchId,
    sport: "",
    startTime,
    endTime: startTime + 60 * MINUTE_MS,
    payInput: "250",
    note: "",
    maxParticipants: 12,
    cancellationDeadlineHours: 24,
    applicationLeadMinutes: 60,
    expiryOverrideMinutes: undefined,
    boostPreset: undefined,
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

export function formatTime(value: number, locale: string, timeZone = DEVICE_TIME_ZONE) {
  return new Date(value).toLocaleString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function formatDateWithWeekday(value: number, locale: string, timeZone = DEVICE_TIME_ZONE) {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
}

export function getJobStatusTone(status: JobStatus) {
  if (status === "open") return "primary";
  if (status === "filled" || status === "completed") return "success";
  return "muted";
}

export function getJobStatusToneWithReason(
  status: JobStatus,
  closureReason?: JobClosureReason,
): JobStatusTone {
  if (status === "cancelled") {
    if (closureReason === "studio_cancelled") return "amber";
    if (closureReason === "expired") return "gray";
  }

  return getJobStatusTone(status);
}

export function getJobStatusTranslationKey(status: JobStatus, closureReason?: JobClosureReason) {
  if (status === "cancelled" && closureReason === "expired") {
    return "jobsTab.status.job.expired";
  }

  return JOB_STATUS_TRANSLATION_KEYS[status];
}

export function formatCompactDateTime(value: number, locale: string, timeZone = DEVICE_TIME_ZONE) {
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

export function formatExpiryText(expiryTimestamp: number, now = Date.now()) {
  const deltaMs = expiryTimestamp - now;
  if (deltaMs <= 0) {
    return {
      key: "jobsTab.form.expiryExpired",
      interpolation: {},
      formatted: "Expired",
    };
  }

  const roundedMinutes = Math.max(1, Math.ceil(deltaMs / MINUTE_MS));
  if (roundedMinutes < 60) {
    return {
      key: "jobsTab.form.expiresInMinutes",
      interpolation: { count: roundedMinutes },
      formatted: `Expires in ${roundedMinutes} minute${roundedMinutes === 1 ? "" : "s"}`,
    };
  }

  const roundedHours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  if (remainingMinutes === 0) {
    return {
      key: "jobsTab.form.expiresInHours",
      interpolation: { count: roundedHours },
      formatted: `Expires in ${roundedHours} hour${roundedHours === 1 ? "" : "s"}`,
    };
  }

  return {
    key: "jobsTab.form.expiresInHoursAndMinutes",
    interpolation: { count: roundedHours, minutes: remainingMinutes },
    formatted: `Expires in ${roundedHours} hour${roundedHours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`,
  };
}

export function getExpiryPresentation(
  expiryTimestamp: number | undefined,
  locale: string,
  now = Date.now(),
  timeZone = DEVICE_TIME_ZONE,
): ExpiryPresentation | undefined {
  if (typeof expiryTimestamp !== "number" || !Number.isFinite(expiryTimestamp)) return undefined;

  const expiry = formatExpiryText(expiryTimestamp, now);
  const exactText = formatCompactDateTime(expiryTimestamp, locale, timeZone);

  return {
    isExpired: expiry.key === "jobsTab.form.expiryExpired",
    key: expiry.key,
    interpolation: expiry.interpolation,
    relativeText: expiry.formatted,
    exactText,
    text: `${expiry.formatted} · ${exactText}`,
  };
}

export function formatBoostBadge(
  boostPreset?: BoostPreset,
  boostBonusAmount?: number,
  boostActive?: boolean,
) {
  if (!boostActive) return undefined;

  const resolvedBonus =
    typeof boostBonusAmount === "number"
      ? boostBonusAmount
      : boostPreset
        ? BOOST_PRESET_VALUES[boostPreset]
        : undefined;

  if (typeof resolvedBonus !== "number" || resolvedBonus <= 0) return undefined;
  return {
    key: "jobsTab.form.boostBadge",
    bonus: resolvedBonus,
    formatted: `+₪${resolvedBonus} boost`,
  };
}

export function getBoostPresentation(
  pay: number,
  boostPreset?: BoostPreset,
  boostBonusAmount?: number,
  boostActive?: boolean,
): BoostPresentation {
  const badgeResult = formatBoostBadge(boostPreset, boostBonusAmount, boostActive);
  const bonusAmount = badgeResult
    ? typeof boostBonusAmount === "number"
      ? boostBonusAmount
      : boostPreset
        ? BOOST_PRESET_VALUES[boostPreset]
        : undefined
    : undefined;

  return {
    totalPay: pay + (bonusAmount ?? 0),
    bonusAmount,
    badge: badgeResult?.formatted,
    badgeKey: badgeResult?.key,
    badgeInterpolation: badgeResult ? { bonus: badgeResult.bonus } : {},
  };
}

export function getLessonProgress(now: number, startTime: number, endTime: number) {
  if (endTime <= startTime) return 0;
  return clamp((now - startTime) / (endTime - startTime), 0, 1);
}

export function getMonotonicNow() {
  const value = globalThis.performance?.now?.();
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
