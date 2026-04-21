import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { APPLICATION_STATUSES, REQUIRED_LEVELS, SESSION_LANGUAGES } from "../constants";
import { trimOptionalString } from "../lib/validation";

export const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUSES);
export const REQUIRED_LEVEL_SET = new Set<string>(REQUIRED_LEVELS);
export const SESSION_LANGUAGE_SET = new Set<string>(SESSION_LANGUAGES);

export const BOOST_PRESETS = {
  small: 20,
  medium: 50,
  large: 100,
} as const;

export const BOOST_CUSTOM_MIN = 10;
export const BOOST_CUSTOM_MAX = 100;
export const BOOST_CUSTOM_STEP = 10;
export const BOOST_TRIGGER_MINUTES_OPTIONS = [15, 30, 45, 60, 90] as const;
export const LESSON_CHECK_IN_DEFAULT_RADIUS_METERS = 10;
export const LESSON_CHECK_IN_DISTANCE_BUFFER_METERS = 4;
export const LESSON_CHECK_IN_MAX_ACCURACY_METERS = 22;
export const LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS = 2 * 60 * 1000;
export const LESSON_CHECK_IN_WINDOW_BEFORE_MS = 45 * 60 * 1000;
export const LESSON_CHECK_IN_WINDOW_AFTER_MS = 30 * 60 * 1000;

export type LessonCheckInReason =
  | "verified"
  | "outside_radius"
  | "accuracy_too_low"
  | "sample_too_old"
  | "outside_check_in_window"
  | "branch_location_missing";

export type LessonCheckInSummary = {
  checkInStatus: "verified" | "rejected";
  checkInReason: LessonCheckInReason;
  checkedInAt: number;
  checkInDistanceMeters?: number;
};

export function assertPositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConvexError(`${fieldName} must be greater than 0`);
  }
}

export function normalizeTimeZone(value: string | undefined) {
  const trimmed = trimOptionalString(value);
  if (!trimmed) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(0);
  } catch {
    throw new ConvexError("Invalid timeZone");
  }
  return trimmed;
}

export function getLessonLifecycle(
  status: Doc<"jobs">["status"],
  nowValue: number,
  startTime: number,
  endTime: number,
): "upcoming" | "live" | "past" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  if (nowValue < startTime) return "upcoming";
  if (nowValue <= endTime) return "live";
  return "past";
}

export function getBranchArrivalRadiusMeters(branch: Doc<"studioBranches">) {
  if (Number.isFinite(branch.arrivalRadiusMeters) && branch.arrivalRadiusMeters! > 0) {
    return branch.arrivalRadiusMeters!;
  }
  return LESSON_CHECK_IN_DEFAULT_RADIUS_METERS;
}

export function getAllowedCheckInDistanceMeters(branch: Doc<"studioBranches">) {
  return getBranchArrivalRadiusMeters(branch) + LESSON_CHECK_IN_DISTANCE_BUFFER_METERS;
}

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function ensureOneOf(value: string, validValues: Set<string>, fieldName: string) {
  if (!validValues.has(value)) {
    throw new ConvexError(`Invalid ${fieldName}`);
  }
}

export function toDisplayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const DEFAULT_AUTO_EXPIRE_MINUTES = 30;
export const BADGE_COUNT_CAP = 99;
export const USE_JOB_APPLICATION_STATS = process.env.ENABLE_JOB_APPLICATION_STATS !== "0";
export const USE_STUDIO_APPLICATIONS_BY_STUDIO =
  process.env.ENABLE_STUDIO_APPLICATIONS_BY_STUDIO !== "0";
export const JOB_ACTION_VERIFICATION_REQUIRED_ERROR =
  "Complete instructor verification before job actions";

export function clampBadgeCount(value: number) {
  return Math.min(Math.max(value, 0), BADGE_COUNT_CAP);
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function getUniqueIdsInOrder<T extends string>(ids: ReadonlyArray<T>) {
  return [...new Set(ids)];
}
