import {
  PIKUD_HAOREF_ZONE_IDS,
  type PikudHaorefZoneId,
} from "./pikud-zones.generated";

export const PIKUD_HAOREF_ZONES = PIKUD_HAOREF_ZONE_IDS;
export type PikudHaorefZone = PikudHaorefZoneId;

export const SPORT_GENRES = [
  {
    key: "pilates",
    label: "Pilates",
    sports: [
      { key: "pilates_mat", label: "Mat" },
      { key: "pilates_reformer", label: "Reformer" },
      { key: "pilates_wall", label: "Wall" },
      { key: "pilates_power", label: "Power" },
      { key: "pilates_apparatus", label: "Apparatus" },
    ],
  },
  {
    key: "yoga",
    label: "Yoga",
    sports: [
      { key: "yoga_vinyasa", label: "Vinyasa" },
      { key: "yoga_hatha", label: "Hatha" },
      { key: "yoga_yin", label: "Yin" },
      { key: "yoga_restorative", label: "Restorative" },
      { key: "yoga_ashtanga", label: "Ashtanga" },
      { key: "yoga_kundalini", label: "Kundalini" },
      { key: "power_yoga", label: "Power" },
      { key: "aerial_yoga", label: "Aerial" },
    ],
  },
  {
    key: "hiit",
    label: "HIIT",
    sports: [
      { key: "hiit", label: "General" },
      { key: "hiit_bootcamp", label: "Bootcamp" },
      { key: "hiit_circuit", label: "Circuit" },
    ],
  },
  {
    key: "functional",
    label: "Functional",
    sports: [
      { key: "functional_training", label: "General" },
      { key: "strength_conditioning", label: "Strength & Conditioning" },
      { key: "bodyweight_training", label: "Bodyweight" },
      { key: "mobility", label: "Mobility" },
      { key: "stretching_flexibility", label: "Stretching & Flexibility" },
      { key: "trx", label: "TRX" },
    ],
  },
  {
    key: "barre",
    label: "Barre",
    sports: [{ key: "barre", label: "General" }],
  },
  {
    key: "cycling",
    label: "Cycling",
    sports: [{ key: "indoor_cycling", label: "Indoor" }],
  },
  {
    key: "dance",
    label: "Dance Fitness",
    sports: [{ key: "dance_fitness", label: "General" }],
  },
  {
    key: "mindfulness",
    label: "Mindfulness",
    sports: [{ key: "meditation", label: "Meditation" }],
  },
  {
    key: "special_populations",
    label: "Special Populations",
    sports: [
      { key: "prenatal_postnatal_fitness", label: "Prenatal & Postnatal" },
    ],
  },
] as const;

export type SportGenre = (typeof SPORT_GENRES)[number]["key"];
export type SportType = (typeof SPORT_GENRES)[number]["sports"][number]["key"];

type SportDefinition = {
  key: SportType;
  label: string;
  genreKey: SportGenre;
  genreLabel: string;
};

const SPORT_DEFINITIONS = SPORT_GENRES.flatMap((genre) =>
  genre.sports.map((sport) => ({
    key: sport.key,
    label: sport.label,
    genreKey: genre.key,
    genreLabel: genre.label,
  })),
) as SportDefinition[];

export const SPORT_TYPES = SPORT_DEFINITIONS.map(
  (sport) => sport.key,
) as SportType[];
const SPORT_TYPE_SET = new Set<string>(SPORT_TYPES);
const SPORT_DEFINITION_MAP = new Map<string, SportDefinition>(
  SPORT_DEFINITIONS.map((sport) => [sport.key, sport]),
);

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

export function getSportDefinition(sport: string) {
  return SPORT_DEFINITION_MAP.get(sport) ?? null;
}

export function getSportGenreKey(sport: string) {
  return getSportDefinition(sport)?.genreKey ?? null;
}

export function getSportGenreLabel(sport: string) {
  return getSportDefinition(sport)?.genreLabel ?? null;
}

export function toSportLabel(sport: SportType): string {
  const definition = getSportDefinition(sport);
  if (!definition) {
    return sport
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  if (definition.label === "General") {
    return definition.genreLabel;
  }

  return `${definition.genreLabel} · ${definition.label}`;
}

export function isSportType(value: string): value is SportType {
  return SPORT_TYPE_SET.has(value);
}
