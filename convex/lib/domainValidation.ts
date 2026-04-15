import { ConvexError } from "convex/values";

import {
  type CapabilityTag,
  SPORT_CAPABILITY_TAGS,
  SPORT_TYPES,
  type SportType,
} from "../constants";

const VALID_SPORT_TYPES = new Set<string>(SPORT_TYPES);
const VALID_CAPABILITY_TAGS = new Set<string>(SPORT_CAPABILITY_TAGS);

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

export function isKnownCapabilityTag(tag: string): tag is CapabilityTag {
  return VALID_CAPABILITY_TAGS.has(tag);
}

export function normalizeCapabilityTag(tag: string): CapabilityTag {
  const normalized = tag.trim();
  if (!normalized) {
    throw new ConvexError("Capability tag is required");
  }
  if (!isKnownCapabilityTag(normalized)) {
    throw new ConvexError("Invalid capability tag");
  }
  return normalized;
}

export function normalizeCapabilityTagArray(values: ReadonlyArray<string> | undefined) {
  if (!values) {
    return undefined;
  }
  const normalized = [...new Set(values.map(normalizeCapabilityTag))];
  return normalized.length > 0 ? normalized : undefined;
}
