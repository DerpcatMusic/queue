import { ConvexError } from "convex/values";

export const DEFAULT_WORK_RADIUS_KM = 15;
export const MIN_WORK_RADIUS_KM = 1;
export const MAX_WORK_RADIUS_KM = 40;

export function normalizeWorkRadiusKm(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_WORK_RADIUS_KM;
  }
  if (!Number.isFinite(value)) {
    throw new ConvexError("workRadiusKm must be a valid number");
  }
  if (value < MIN_WORK_RADIUS_KM || value > MAX_WORK_RADIUS_KM) {
    throw new ConvexError(
      `workRadiusKm must be between ${MIN_WORK_RADIUS_KM} and ${MAX_WORK_RADIUS_KM}`,
    );
  }
  return value;
}

export function getMaxSearchDistanceMeters() {
  return MAX_WORK_RADIUS_KM * 1000;
}
