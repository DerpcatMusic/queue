import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type InstructorEligibility = { sports: Set<string> };

export async function loadInstructorEligibility(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
): Promise<InstructorEligibility> {
  const sportRows = await ctx.db
    .query("instructorSports")
    .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
    .collect();
  return { sports: new Set(sportRows.map((r) => r.sport)) };
}
