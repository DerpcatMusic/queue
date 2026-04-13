export const CAPABILITY_TAGS = [
  { key: "tower", label: "Tower" },
  { key: "cadillac", label: "Cadillac" },
  { key: "wunda_chair", label: "Wunda Chair" },
  { key: "ladder_barrel", label: "Ladder Barrel" },
  { key: "spine_corrector", label: "Spine Corrector" },
  { key: "springboard", label: "Springboard" },
  { key: "wall_unit", label: "Wall Unit" },
  { key: "trx", label: "TRX" },
  { key: "heavy_bag", label: "Heavy Bag" },
  { key: "pads", label: "Pads" },
  { key: "metrics_bike", label: "Metrics Bike" },
  { key: "aerial_hammock", label: "Aerial Hammock" },
  { key: "olympic_lifting", label: "Olympic Lifting" },
  { key: "gymnastics_rings", label: "Gymnastics Rings" },
  { key: "prenatal", label: "Prenatal" },
  { key: "postnatal", label: "Postnatal" },
  { key: "rehab", label: "Rehab" },
  { key: "kids", label: "Kids" },
  { key: "adults", label: "Adults" },
  { key: "beginners", label: "Beginners" },
  { key: "advanced", label: "Advanced" },
  { key: "english", label: "English" },
  { key: "hebrew", label: "Hebrew" },
  { key: "arabic", label: "Arabic" },
  { key: "russian", label: "Russian" },
] as const;

export type CapabilityTag = (typeof CAPABILITY_TAGS)[number]["key"];

export const SPORT_GENRES = [
  {
    key: "pilates",
    label: "Pilates",
    sports: [
      { key: "pilates_mat", label: "Mat Pilates" },
      { key: "pilates_reformer", label: "Reformer Pilates" },
      {
        key: "pilates_apparatus",
        label: "Apparatus Pilates",
        supportedCapabilityTags: [
          "tower",
          "cadillac",
          "wunda_chair",
          "ladder_barrel",
          "spine_corrector",
          "springboard",
          "wall_unit",
        ],
      },
      { key: "pilates_power", label: "Power Pilates" },
      {
        key: "pilates_clinical",
        label: "Clinical / Rehabilitative Pilates",
        supportedCapabilityTags: ["rehab", "prenatal", "postnatal"],
      },
    ],
  },
  {
    key: "yoga",
    label: "Yoga",
    sports: [
      { key: "yoga_vinyasa", label: "Vinyasa / Power Yoga" },
      { key: "yoga_hatha", label: "Hatha" },
      { key: "yoga_ashtanga", label: "Ashtanga" },
      { key: "yoga_yin", label: "Yin" },
      { key: "yoga_restorative", label: "Restorative" },
      {
        key: "yoga_aerial",
        label: "Aerial Yoga",
        supportedCapabilityTags: ["aerial_hammock"],
      },
    ],
  },
  {
    key: "barre_flexibility",
    label: "Barre & Flexibility",
    sports: [
      { key: "barre_classic", label: "Classic Barre" },
      { key: "stretching_dynamic", label: "Dynamic Stretching" },
      { key: "mobility_animal_flow", label: "Mobility / Animal Flow" },
    ],
  },
  {
    key: "functional_strength",
    label: "Functional & Strength",
    sports: [
      { key: "functional_hiit", label: "HIIT" },
      { key: "functional_circuit", label: "Circuit Training" },
      {
        key: "functional_trx",
        label: "TRX / Suspension Training",
        supportedCapabilityTags: ["trx"],
      },
      { key: "functional_kettlebell", label: "Kettlebell Conditioning" },
    ],
  },
  {
    key: "crossfit",
    label: "CrossFit",
    sports: [
      { key: "crossfit_wod", label: "WOD Coaching" },
      {
        key: "crossfit_weightlifting",
        label: "Weightlifting / Powerlifting",
        supportedCapabilityTags: ["olympic_lifting"],
      },
      {
        key: "crossfit_gymnastics",
        label: "Gymnastics for CrossFit",
        supportedCapabilityTags: ["gymnastics_rings"],
      },
    ],
  },
  {
    key: "performance",
    label: "Performance",
    sports: [
      { key: "performance_hyrox", label: "Hyrox Preparation" },
      {
        key: "performance_athletic_conditioning",
        label: "Athletic Conditioning",
      },
      { key: "performance_personal_training", label: "Personal Training" },
    ],
  },
  {
    key: "cycling",
    label: "Indoor Cycling",
    sports: [
      { key: "cycling_rhythm", label: "Rhythm Cycling" },
      {
        key: "cycling_power",
        label: "Performance / Power Cycling",
        supportedCapabilityTags: ["metrics_bike"],
      },
    ],
  },
  {
    key: "dance_fitness",
    label: "Dance Fitness",
    sports: [
      { key: "dance_zumba", label: "Zumba" },
      { key: "dance_hip_hop_cardio", label: "Hip-Hop Cardio" },
      { key: "dance_commercial", label: "Commercial Dance" },
    ],
  },
  {
    key: "combat_fitness",
    label: "Combat Fitness",
    sports: [
      {
        key: "combat_boxing_bag",
        label: "Heavy Bag Circuits",
        supportedCapabilityTags: ["heavy_bag"],
      },
      {
        key: "combat_boxing_technical",
        label: "Technical Boxing",
        supportedCapabilityTags: ["pads"],
      },
      { key: "combat_kickboxing_cardio", label: "Cardio Kickboxing" },
      { key: "combat_muay_thai_fitness", label: "Muay Thai Fitness" },
      { key: "combat_krav_maga_intro", label: "Basic Krav Maga" },
    ],
  },
  {
    key: "court_club",
    label: "Court & Club",
    sports: [
      {
        key: "court_padel_beginner",
        label: "Padel Intro / Beginner Clinics",
      },
      {
        key: "court_padel_advanced",
        label: "Padel Advanced Technical Coaching",
      },
      {
        key: "court_padel_social",
        label: "Padel Social Match Facilitation",
      },
      { key: "court_tennis_adults", label: "Tennis Adult Clinics" },
      {
        key: "court_tennis_juniors",
        label: "Tennis Junior Coaching",
        supportedCapabilityTags: ["kids"],
      },
      { key: "court_swimming_masters", label: "Swimming Masters Coaching" },
      {
        key: "court_swimming_technique",
        label: "Swimming Technique Clinics",
      },
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
  supportedCapabilityTags: CapabilityTag[];
};

const CAPABILITY_TAG_LABEL_MAP = new Map<string, string>(
  CAPABILITY_TAGS.map((tag) => [tag.key, tag.label]),
);

const SPORT_DEFINITIONS = SPORT_GENRES.flatMap((genre) =>
  genre.sports.map((sport) => ({
    key: sport.key,
    label: sport.label,
    genreKey: genre.key,
    genreLabel: genre.label,
    supportedCapabilityTags: [
      ...("supportedCapabilityTags" in sport && sport.supportedCapabilityTags
        ? sport.supportedCapabilityTags
        : []),
    ] as CapabilityTag[],
  })),
) as SportDefinition[];

export const SPORT_TYPES = SPORT_DEFINITIONS.map((sport) => sport.key) as SportType[];
export const SPORT_CAPABILITY_TAGS = CAPABILITY_TAGS.map((tag) => tag.key) as CapabilityTag[];

const SPORT_TYPE_SET = new Set<string>(SPORT_TYPES);
const CAPABILITY_TAG_SET = new Set<string>(SPORT_CAPABILITY_TAGS);
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

export const SESSION_LANGUAGES = ["hebrew", "english", "arabic", "russian"] as const;

export type SessionLanguage = (typeof SESSION_LANGUAGES)[number];

export const APPLICATION_STATUSES = ["pending", "accepted", "rejected", "withdrawn"] as const;

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

export function getSportSupportedCapabilityTags(sport: string): CapabilityTag[] {
  return [...(getSportDefinition(sport)?.supportedCapabilityTags ?? [])];
}

export function supportsCapabilityTagForSport(sport: string, capabilityTag: string) {
  if (!isCapabilityTag(capabilityTag)) {
    return false;
  }
  return getSportSupportedCapabilityTags(sport).includes(capabilityTag);
}

export function toSportLabel(sport: SportType): string {
  const definition = getSportDefinition(sport);
  if (!definition) {
    return sport
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return definition.label;
}

export function isSportType(value: string): value is SportType {
  return SPORT_TYPE_SET.has(value);
}

export function isCapabilityTag(value: string): value is CapabilityTag {
  return CAPABILITY_TAG_SET.has(value);
}

export function toCapabilityTagLabel(tag: CapabilityTag | string): string {
  const definition = CAPABILITY_TAG_LABEL_MAP.get(tag);
  if (definition) {
    return definition;
  }
  return tag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
