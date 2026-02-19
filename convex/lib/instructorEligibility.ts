import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

type CoverageBySport = Map<string, Set<string>>;

export type InstructorEligibility = {
  keySet: Set<string>;
  coverageBySport: CoverageBySport;
  coverageCount: number;
  coveragePairs: ReadonlyArray<{ sport: string; zone: string }>;
};

function toEligibilityKey(sport: string, zone: string) {
  return `${sport}::${zone}`;
}

export async function loadInstructorEligibility(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
): Promise<InstructorEligibility> {
  const coverageRows = await ctx.db
    .query("instructorCoverage")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
    .collect();

  const keySet = new Set<string>();
  const coverageBySport: CoverageBySport = new Map();
  const coveragePairs: { sport: string; zone: string }[] = [];

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
  };
}

export function hasCoverageKey(
  eligibility: InstructorEligibility,
  sport: string,
  zone: string,
): boolean {
  return eligibility.keySet.has(toEligibilityKey(sport, zone));
}
