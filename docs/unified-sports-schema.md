# Unified Sports Schema

Date: 2026-03-29

This is the canonical sports taxonomy and matching model for Queue.

Use one schema for:
- AI certificate verification
- instructor profile capabilities
- studio job requirements
- coverage matching
- filters and search

Do not keep a second parallel schema for `machines`, `coveredSports`, or job-only sport fields.

## Core Rule

The single source of truth is a `specialtyKey`.

- `umbrellaKey` groups specialties for browsing and analytics
- `specialtyKey` is the actual matchable/bookable leaf
- `capabilityTags` refine what the instructor can teach inside that specialty

Jobs and certificates should both resolve to the same `specialtyKey` values.

## Canonical Record Shape

```ts
type UmbrellaKey =
  | "pilates"
  | "yoga"
  | "barre_flexibility"
  | "functional_strength"
  | "crossfit"
  | "performance"
  | "cycling"
  | "dance_fitness"
  | "combat_fitness"
  | "court_club";

type SpecialtyKey =
  | "pilates_mat"
  | "pilates_reformer"
  | "pilates_apparatus"
  | "pilates_power"
  | "pilates_clinical"
  | "yoga_vinyasa"
  | "yoga_hatha"
  | "yoga_ashtanga"
  | "yoga_yin"
  | "yoga_restorative"
  | "yoga_aerial"
  | "barre_classic"
  | "stretching_dynamic"
  | "mobility_animal_flow"
  | "functional_hiit"
  | "functional_circuit"
  | "functional_trx"
  | "functional_kettlebell"
  | "crossfit_wod"
  | "crossfit_weightlifting"
  | "crossfit_gymnastics"
  | "performance_hyrox"
  | "performance_athletic_conditioning"
  | "performance_personal_training"
  | "cycling_rhythm"
  | "cycling_power"
  | "dance_zumba"
  | "dance_hip_hop_cardio"
  | "dance_commercial"
  | "combat_boxing_bag"
  | "combat_boxing_technical"
  | "combat_kickboxing_cardio"
  | "combat_muay_thai_fitness"
  | "combat_krav_maga_intro"
  | "court_padel_beginner"
  | "court_padel_advanced"
  | "court_padel_social"
  | "court_tennis_adults"
  | "court_tennis_juniors"
  | "court_swimming_masters"
  | "court_swimming_technique";

type CapabilityTagKey =
  | "tower"
  | "cadillac"
  | "wunda_chair"
  | "ladder_barrel"
  | "spine_corrector"
  | "springboard"
  | "wall_unit"
  | "trx"
  | "heavy_bag"
  | "pads"
  | "metrics_bike"
  | "aerial_hammock"
  | "olympic_lifting"
  | "gymnastics_rings"
  | "prenatal"
  | "postnatal"
  | "rehab"
  | "kids"
  | "adults"
  | "beginners"
  | "advanced"
  | "english"
  | "hebrew"
  | "arabic"
  | "russian";

type UnifiedSportSpec = {
  umbrellaKey: UmbrellaKey;
  specialtyKey: SpecialtyKey;
  capabilityTags?: CapabilityTagKey[];
  requiredCapabilityTags?: CapabilityTagKey[];
  preferredCapabilityTags?: CapabilityTagKey[];
};
```

## Important Modeling Decision

`specialtyKey` is the only key used for exact matching.

Examples:
- `pilates_reformer` is a specialty
- `pilates_apparatus` is a specialty
- `cadillac` is not a specialty key, it is a capability tag

That keeps the hierarchy clean while still letting studios request exact apparatus coverage.

## Canonical Catalog

```ts
export const SPORT_SPECIALTY_CATALOG = [
  {
    umbrellaKey: "pilates",
    umbrellaLabel: "Pilates",
    specialties: [
      {
        specialtyKey: "pilates_mat",
        specialtyLabel: "Mat Pilates",
        marketStatus: "core",
      },
      {
        specialtyKey: "pilates_reformer",
        specialtyLabel: "Reformer Pilates",
        marketStatus: "core",
      },
      {
        specialtyKey: "pilates_apparatus",
        specialtyLabel: "Apparatus Pilates",
        marketStatus: "core",
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
      {
        specialtyKey: "pilates_power",
        specialtyLabel: "Power Pilates",
        marketStatus: "secondary",
      },
      {
        specialtyKey: "pilates_clinical",
        specialtyLabel: "Clinical / Rehabilitative Pilates",
        marketStatus: "core",
        supportedCapabilityTags: ["rehab", "prenatal", "postnatal"],
      },
    ],
  },
  {
    umbrellaKey: "yoga",
    umbrellaLabel: "Yoga",
    specialties: [
      { specialtyKey: "yoga_vinyasa", specialtyLabel: "Vinyasa / Power Yoga", marketStatus: "core" },
      { specialtyKey: "yoga_hatha", specialtyLabel: "Hatha", marketStatus: "core" },
      { specialtyKey: "yoga_ashtanga", specialtyLabel: "Ashtanga", marketStatus: "secondary" },
      { specialtyKey: "yoga_yin", specialtyLabel: "Yin", marketStatus: "core" },
      { specialtyKey: "yoga_restorative", specialtyLabel: "Restorative", marketStatus: "core" },
      {
        specialtyKey: "yoga_aerial",
        specialtyLabel: "Aerial Yoga",
        marketStatus: "secondary",
        supportedCapabilityTags: ["aerial_hammock"],
      },
    ],
  },
  {
    umbrellaKey: "barre_flexibility",
    umbrellaLabel: "Barre & Flexibility",
    specialties: [
      { specialtyKey: "barre_classic", specialtyLabel: "Classic Barre", marketStatus: "core" },
      { specialtyKey: "stretching_dynamic", specialtyLabel: "Dynamic Stretching", marketStatus: "secondary" },
      { specialtyKey: "mobility_animal_flow", specialtyLabel: "Mobility / Animal Flow", marketStatus: "secondary" },
    ],
  },
  {
    umbrellaKey: "functional_strength",
    umbrellaLabel: "Functional & Strength",
    specialties: [
      { specialtyKey: "functional_hiit", specialtyLabel: "HIIT", marketStatus: "core" },
      { specialtyKey: "functional_circuit", specialtyLabel: "Circuit Training", marketStatus: "core" },
      {
        specialtyKey: "functional_trx",
        specialtyLabel: "TRX / Suspension Training",
        marketStatus: "core",
        supportedCapabilityTags: ["trx"],
      },
      { specialtyKey: "functional_kettlebell", specialtyLabel: "Kettlebell Conditioning", marketStatus: "secondary" },
    ],
  },
  {
    umbrellaKey: "crossfit",
    umbrellaLabel: "CrossFit",
    specialties: [
      { specialtyKey: "crossfit_wod", specialtyLabel: "WOD Coaching", marketStatus: "core" },
      {
        specialtyKey: "crossfit_weightlifting",
        specialtyLabel: "Weightlifting / Powerlifting",
        marketStatus: "core",
        supportedCapabilityTags: ["olympic_lifting"],
      },
      {
        specialtyKey: "crossfit_gymnastics",
        specialtyLabel: "Gymnastics for CrossFit",
        marketStatus: "secondary",
        supportedCapabilityTags: ["gymnastics_rings"],
      },
    ],
  },
  {
    umbrellaKey: "performance",
    umbrellaLabel: "Performance",
    specialties: [
      { specialtyKey: "performance_hyrox", specialtyLabel: "Hyrox Preparation", marketStatus: "secondary" },
      { specialtyKey: "performance_athletic_conditioning", specialtyLabel: "Athletic Conditioning", marketStatus: "core" },
      { specialtyKey: "performance_personal_training", specialtyLabel: "Personal Training", marketStatus: "core" },
    ],
  },
  {
    umbrellaKey: "cycling",
    umbrellaLabel: "Indoor Cycling",
    specialties: [
      { specialtyKey: "cycling_rhythm", specialtyLabel: "Rhythm Cycling", marketStatus: "core" },
      {
        specialtyKey: "cycling_power",
        specialtyLabel: "Performance / Power Cycling",
        marketStatus: "core",
        supportedCapabilityTags: ["metrics_bike"],
      },
    ],
  },
  {
    umbrellaKey: "dance_fitness",
    umbrellaLabel: "Dance Fitness",
    specialties: [
      { specialtyKey: "dance_zumba", specialtyLabel: "Zumba", marketStatus: "core" },
      { specialtyKey: "dance_hip_hop_cardio", specialtyLabel: "Hip-Hop Cardio", marketStatus: "secondary" },
      { specialtyKey: "dance_commercial", specialtyLabel: "Commercial Dance", marketStatus: "secondary" },
    ],
  },
  {
    umbrellaKey: "combat_fitness",
    umbrellaLabel: "Combat Fitness",
    specialties: [
      {
        specialtyKey: "combat_boxing_bag",
        specialtyLabel: "Heavy Bag Circuits",
        marketStatus: "core",
        supportedCapabilityTags: ["heavy_bag"],
      },
      {
        specialtyKey: "combat_boxing_technical",
        specialtyLabel: "Technical Boxing",
        marketStatus: "core",
        supportedCapabilityTags: ["pads"],
      },
      { specialtyKey: "combat_kickboxing_cardio", specialtyLabel: "Cardio Kickboxing", marketStatus: "core" },
      { specialtyKey: "combat_muay_thai_fitness", specialtyLabel: "Muay Thai Fitness", marketStatus: "secondary" },
      { specialtyKey: "combat_krav_maga_intro", specialtyLabel: "Basic Krav Maga", marketStatus: "secondary" },
    ],
  },
  {
    umbrellaKey: "court_club",
    umbrellaLabel: "Court & Club",
    specialties: [
      { specialtyKey: "court_padel_beginner", specialtyLabel: "Padel Intro / Beginner Clinics", marketStatus: "core" },
      { specialtyKey: "court_padel_advanced", specialtyLabel: "Padel Advanced Technical Coaching", marketStatus: "core" },
      { specialtyKey: "court_padel_social", specialtyLabel: "Padel Social Match Facilitation", marketStatus: "core" },
      { specialtyKey: "court_tennis_adults", specialtyLabel: "Tennis Adult Clinics", marketStatus: "core" },
      {
        specialtyKey: "court_tennis_juniors",
        specialtyLabel: "Tennis Junior Coaching",
        marketStatus: "core",
        supportedCapabilityTags: ["kids"],
      },
      { specialtyKey: "court_swimming_masters", specialtyLabel: "Swimming Masters Coaching", marketStatus: "secondary" },
      { specialtyKey: "court_swimming_technique", specialtyLabel: "Swimming Technique Clinics", marketStatus: "secondary" },
    ],
  },
] as const;
```

## How The Same Schema Is Used Everywhere

### 1. AI certificate output

AI should return:

```ts
type CertificateExtraction = {
  specialties: UnifiedSportSpec[];
  issuerName?: string;
  certificateTitle?: string;
  approved: boolean;
  rejectionReasons: string[];
};
```

Example:

```json
{
  "specialties": [
    {
      "umbrellaKey": "pilates",
      "specialtyKey": "pilates_reformer"
    },
    {
      "umbrellaKey": "pilates",
      "specialtyKey": "pilates_apparatus",
      "capabilityTags": ["tower", "cadillac", "wunda_chair"]
    }
  ],
  "issuerName": "Example Institute",
  "certificateTitle": "Pilates Apparatus Instructor",
  "approved": true,
  "rejectionReasons": []
}
```

### 2. Instructor capability storage

Store the same shape:

```ts
type InstructorSpecialty = UnifiedSportSpec & {
  verificationStatus: "verified" | "pending" | "rejected" | "manual";
  sourceCertificateIds?: Id<"instructorCertificates">[];
  updatedAt: number;
};
```

### 3. Job requirement storage

Store the same shape:

```ts
type JobSpecialtyRequirement = UnifiedSportSpec;
```

Example:

```json
{
  "umbrellaKey": "pilates",
  "specialtyKey": "pilates_apparatus",
  "requiredCapabilityTags": ["cadillac"],
  "preferredCapabilityTags": ["tower"]
}
```

## Matching Rule

A job matches an instructor when:
- `specialtyKey` is equal
- every `requiredCapabilityTag` is present in the instructor verified capability set
- `preferredCapabilityTags` affect ranking, not eligibility

Do not match on umbrella alone.

Bad:
- any Pilates instructor can cover any Pilates job

Good:
- `pilates_reformer` matches `pilates_reformer`
- `pilates_apparatus` with `cadillac` requirement matches only instructors verified for `cadillac`

## UI Rule

The UI can browse by umbrella, but selection must save `specialtyKey`.

Examples:
- onboarding picker shows `Pilates` first
- expanding `Pilates` shows `Mat`, `Reformer`, `Apparatus`, `Power`, `Clinical`
- if `Apparatus` is selected, the UI can reveal apparatus tags like `Cadillac`, `Tower`, `Wunda Chair`

The database still stores one canonical shape.

## Current Repo Mapping

Replace or migrate these current fields:

- `instructorCertificates.sport`
- `instructorCertificates.coveredSports`
- `instructorCertificates.machineTags`
- `instructorSports.sport`
- `instructorCoverage.sport`
- `studioSports.sport`
- `jobs.sport`
- compliance review output `sports[]`
- compliance review output `machines[]`

Into:

- `specialties[]` using the unified shape

## Minimal Storage Plan

If you want the smallest practical storage format:

```ts
type StoredSpecialty = {
  specialtyKey: SpecialtyKey;
  capabilityTags?: CapabilityTagKey[];
  requiredCapabilityTags?: CapabilityTagKey[];
  preferredCapabilityTags?: CapabilityTagKey[];
};
```

Then derive `umbrellaKey` from catalog lookup.

This is still one schema because every system references the same `specialtyKey` and tag vocabulary.

## Recommended Convex Changes

### Catalog

Keep one canonical catalog in `convex/constants.ts`:
- umbrellas
- specialties
- allowed capability tags
- label helpers
- lookup maps

### Certificates

Change certificate review output from:

```ts
{
  sports: string[];
  machines: string[];
}
```

to:

```ts
{
  specialties: StoredSpecialty[];
}
```

### Jobs

Change job records from:

```ts
{
  sport: string;
}
```

to:

```ts
{
  specialtyKey: SpecialtyKey;
  requiredCapabilityTags?: CapabilityTagKey[];
  preferredCapabilityTags?: CapabilityTagKey[];
}
```

### Coverage

Coverage rows should use:

```ts
{
  specialtyKey: SpecialtyKey;
  zone: string;
}
```

Not a generic `sport`.

## Why This Is Better

- one canonical matching key
- one AI output shape
- one job requirement shape
- one instructor capability shape
- no split between `sport` and `machineTags`
- safer verification for rehab and apparatus work
- cleaner umbrella browsing without flattening the taxonomy

## Practical Notes For Israel

These are valid first-class specialties for Israel right now:
- `pilates_reformer`
- `pilates_mat`
- `pilates_apparatus`
- `pilates_clinical`
- `yoga_vinyasa`
- `yoga_hatha`
- `yoga_yin`
- `yoga_restorative`
- `barre_classic`
- `functional_hiit`
- `functional_circuit`
- `functional_trx`
- `crossfit_wod`
- `crossfit_weightlifting`
- `performance_athletic_conditioning`
- `performance_personal_training`
- `cycling_rhythm`
- `cycling_power`
- `dance_zumba`
- `combat_boxing_bag`
- `combat_boxing_technical`
- `combat_kickboxing_cardio`
- `court_padel_beginner`
- `court_padel_advanced`
- `court_padel_social`
- `court_tennis_adults`
- `court_tennis_juniors`

These are valid but more niche:
- `pilates_power`
- `yoga_ashtanga`
- `yoga_aerial`
- `mobility_animal_flow`
- `functional_kettlebell`
- `crossfit_gymnastics`
- `performance_hyrox`
- `dance_hip_hop_cardio`
- `dance_commercial`
- `combat_muay_thai_fitness`
- `combat_krav_maga_intro`
- `court_swimming_masters`
- `court_swimming_technique`

