import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

type CoverageBySport = Map<string, Set<string>>;

export type InstructorEligibility = {
  keySet: Set<string>;
  coverageBySport: CoverageBySport;
  coverageCount: number;
  coveragePairs: ReadonlyArray<{ sport: string; zone: string }>;
  sports: ReadonlySet<string>;
};

function toEligibilityKey(sport: string, zone: string) {
  return `${sport}::${zone}`;
}

export async function loadInstructorEligibility(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
): Promise<InstructorEligibility> {
  const [coverageRows, sportRows] = await Promise.all([
    ctx.db
      .query("instructorCoverage")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
    ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect(),
  ]);

  const keySet = new Set<string>();
  const coverageBySport: CoverageBySport = new Map();
  const coveragePairs: { sport: string; zone: string }[] = [];
  const sports = new Set<string>();

  for (const row of sportRows) {
    sports.add(row.sport);
  }

  for (const row of coverageRows) {
    const key = toEligibilityKey(row.sport, row.zone);
    if (keySet.has(key)) {
      continue;
    }
    keySet.add(key);
    coveragePairs.push({ sport: row.sport, zone: row.zone });
    const existing = coverageBySport.get(row.sport);
    if (existing) {
      existing.add(row.zone);
      continue;
    }
    coverageBySport.set(row.sport, new Set([row.zone]));
  }

  return {
    keySet,
    coverageBySport,
    coverageCount: coveragePairs.length,
    coveragePairs,
    sports,
  };
}

export function hasCoverageKey(
  eligibility: InstructorEligibility,
  sport: string,
  zone: string,
): boolean {
  return eligibility.keySet.has(toEligibilityKey(sport, zone));
}

export function isEligibleForJob(
  eligibility: InstructorEligibility,
  sport: string,
  zone: string,
): boolean {
  if (eligibility.coverageCount > 0) {
    return hasCoverageKey(eligibility, sport, zone);
  }

  return eligibility.sports.has(sport);
}
