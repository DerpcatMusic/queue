import { ConvexError } from "convex/values";

import {
  PIKUD_HAOREF_ZONES,
  type PikudHaorefZone,
  SPORT_TYPES,
  type SportType,
} from "../constants";

const VALID_ZONE_IDS = new Set<string>(PIKUD_HAOREF_ZONES);
const VALID_SPORT_TYPES = new Set<string>(SPORT_TYPES);

export function isKnownZoneId(zone: string): zone is PikudHaorefZone {
  return VALID_ZONE_IDS.has(zone);
}

export function normalizeZoneId(zone: string): PikudHaorefZone {
  const normalized = zone.trim();
  if (!normalized) {
    throw new ConvexError("Zone is required");
  }
  if (!isKnownZoneId(normalized)) {
    throw new ConvexError("Invalid zone id");
  }
  return normalized;
}

export function isKnownSportType(sport: string): sport is SportType {
  return VALID_SPORT_TYPES.has(sport);
}

export function normalizeSportType(sport: string): SportType {
  const normalized = sport.trim();
  if (!normalized) {
    throw new ConvexError("Sport is required");
  }
  if (!isKnownSportType(normalized)) {
    throw new ConvexError("Invalid sport type");
  }
  return normalized;
}
