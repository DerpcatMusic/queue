import {
  PIKUD_HAOREF_ZONE_IDS,
  type PikudHaorefZoneId,
} from "./pikud-zones.generated";

export const PIKUD_HAOREF_ZONES = PIKUD_HAOREF_ZONE_IDS;
export type PikudHaorefZone = PikudHaorefZoneId;

export const SPORT_TYPES = [
  "pilates_mat",
  "pilates_reformer",
  "yoga_vinyasa",
  "yoga_hatha",
  "yoga_yin",
  "yoga_restorative",
  "power_yoga",
  "aerial_yoga",
  "hiit",
  "functional_training",
  "barre",
  "stretching_flexibility",
  "meditation",
  "indoor_cycling",
  "trx",
  "dance_fitness",
  "mobility",
  "strength_conditioning",
  "bodyweight_training",
  "prenatal_postnatal_fitness",
] as const;

export type SportType = (typeof SPORT_TYPES)[number];

export const REQUIRED_LEVELS = [
  "beginner_friendly",
  "all_levels",
  "intermediate",
  "advanced",
] as const;

export type RequiredLevel = (typeof REQUIRED_LEVELS)[number];

export const SESSION_LANGUAGES = [
  "hebrew",
  "english",
  "arabic",
  "russian",
] as const;

export type SessionLanguage = (typeof SESSION_LANGUAGES)[number];

export const APPLICATION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function toSportLabel(sport: SportType): string {
  return sport
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
