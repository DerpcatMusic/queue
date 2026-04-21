import { ConvexError } from "convex/values";
import type { Doc, MutationCtx, QueryCtx } from "../_generated/dataModel";
import { requireUserRole } from "../lib/auth";
import {
  canInstructorPerformJobActions,
  type loadInstructorComplianceSnapshot,
} from "../lib/instructorCompliance";
import { requireStudioOwnerContext } from "../lib/studioBranches";

export async function requireInstructorProfile(ctx: QueryCtx | MutationCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple instructor profiles found for this account");
  }
  const profile = profiles[0];

  if (!profile) throw new ConvexError("Instructor profile not found");

  return profile;
}

export function assertInstructorCanPerformJobActions(args: {
  profile: Doc<"instructorProfiles">;
  compliance: Awaited<ReturnType<typeof loadInstructorComplianceSnapshot>>;
  sport: string;
  requiredCapabilityTags?: ReadonlyArray<string> | undefined;
}) {
  if (!canInstructorPerformJobActions(args)) {
    throw new ConvexError("Complete instructor verification before job actions");
  }
}

export async function requireStudioProfile(ctx: QueryCtx | MutationCtx) {
  const { studio } = await requireStudioOwnerContext(ctx);
  return studio;
}
