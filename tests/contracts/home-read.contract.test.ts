import { describe, expect, it } from "bun:test";

import type { Id } from "../../convex/_generated/dataModel";
import { countEligibleOpenJobMatches } from "../../convex/homeRead";
import type { InstructorEligibility } from "../../convex/lib/instructorEligibility";

const SPORT = "yoga_vinyasa";
const ALT_SPORT = "pilates_mat";
const ZONE = "5001557";
const ALT_ZONE = "5000511";
const NOW = 1_700_000_000_000;

function buildEligibility(): InstructorEligibility {
  return {
    keySet: new Set([`${SPORT}::${ZONE}`, `${ALT_SPORT}::${ALT_ZONE}`]),
    coverageBySport: new Map([
      [SPORT, new Set([ZONE])],
      [ALT_SPORT, new Set([ALT_ZONE])],
    ]),
    coverageCount: 2,
    coveragePairs: [
      { sport: SPORT, zone: ZONE },
      { sport: ALT_SPORT, zone: ALT_ZONE },
    ],
  };
}

function buildJob(args: {
  id: string;
  sport?: string;
  zone?: string;
  startTime?: number;
  applicationDeadline?: number;
}) {
  return {
    _id: args.id as Id<"jobs">,
    sport: args.sport ?? SPORT,
    zone: args.zone ?? ZONE,
    startTime: args.startTime ?? NOW + 60_000,
    ...(args.applicationDeadline !== undefined
      ? { applicationDeadline: args.applicationDeadline }
      : {}),
  };
}

describe("home read contracts", () => {
  it("dedupes matches across coverage pairs and filters stale jobs", () => {
    const eligibility = buildEligibility();

    const openMatches = countEligibleOpenJobMatches({
      eligibility,
      now: NOW,
      jobsByCoveragePair: [
        [
          buildJob({ id: "jobs:1" }),
          buildJob({ id: "jobs:2", startTime: NOW - 1 }),
          buildJob({ id: "jobs:3", applicationDeadline: NOW - 1 }),
        ],
        [
          buildJob({ id: "jobs:1" }),
          buildJob({ id: "jobs:4", sport: ALT_SPORT, zone: ALT_ZONE }),
          buildJob({ id: "jobs:5", zone: "invalid-zone" }),
        ],
      ],
    });

    expect(openMatches).toBe(2);
  });

  it("respects the configured cap after counting unique matches", () => {
    const eligibility = buildEligibility();

    const openMatches = countEligibleOpenJobMatches({
      eligibility,
      now: NOW,
      cap: 2,
      jobsByCoveragePair: [
        [
          buildJob({ id: "jobs:1" }),
          buildJob({ id: "jobs:2", sport: ALT_SPORT, zone: ALT_ZONE }),
          buildJob({ id: "jobs:3" }),
        ],
      ],
    });

    expect(openMatches).toBe(2);
  });
});
