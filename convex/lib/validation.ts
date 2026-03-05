import { ConvexError } from "convex/values";

export function trimOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

type DefinedProps<T extends Record<string, unknown>> = {
  [K in keyof T]?: Exclude<T[K], undefined>;
};

export function omitUndefined<T extends Record<string, unknown>>(
  value: T,
): DefinedProps<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as DefinedProps<T>;
}

export function normalizeRequiredString(
  value: string,
  maxLength: number,
  fieldName: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConvexError(`${fieldName} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new ConvexError(`${fieldName} is too long`);
  }
  return trimmed;
}

export function normalizeOptionalString(
  value: string | undefined,
  maxLength: number,
  fieldName: string,
): string | undefined {
  const trimmed = trimOptionalString(value);
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new ConvexError(`${fieldName} is too long`);
  }
  return trimmed;
}

export function normalizeCoordinates(args: {
  latitude?: number;
  longitude?: number;
}): { latitude: number | undefined; longitude: number | undefined } {
  if (args.latitude === undefined && args.longitude === undefined) {
    return { latitude: undefined, longitude: undefined };
  }
  if (args.latitude === undefined || args.longitude === undefined) {
    throw new ConvexError("Both latitude and longitude are required together");
  }
  if (!Number.isFinite(args.latitude) || Math.abs(args.latitude) > 90) {
    throw new ConvexError("Invalid latitude");
  }
  if (!Number.isFinite(args.longitude) || Math.abs(args.longitude) > 180) {
    throw new ConvexError("Invalid longitude");
  }
  return { latitude: args.latitude, longitude: args.longitude };
}

export function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ConvexError(`${fieldName} must be a positive integer`);
  }
}

export const MIN_JOB_APPLICATION_LEAD_TIME_MS = 5 * 60 * 1000;

export function assertValidJobApplicationDeadline(args: {
  now: number;
  startTime: number;
  applicationDeadline: number | undefined;
}) {
  const { now, startTime, applicationDeadline } = args;
  if (applicationDeadline === undefined) {
    return;
  }
  if (!Number.isFinite(applicationDeadline)) {
    throw new ConvexError("applicationDeadline must be a finite number");
  }
  if (applicationDeadline <= now) {
    throw new ConvexError("applicationDeadline must be in the future");
  }
  if (applicationDeadline > startTime) {
    throw new ConvexError("applicationDeadline must be before startTime");
  }
  if (applicationDeadline - now < MIN_JOB_APPLICATION_LEAD_TIME_MS) {
    throw new ConvexError(
      "applicationDeadline must be at least 5 minutes in the future",
    );
  }
  if (startTime - applicationDeadline < MIN_JOB_APPLICATION_LEAD_TIME_MS) {
    throw new ConvexError(
      "applicationDeadline must be at least 5 minutes before startTime",
    );
  }
}
