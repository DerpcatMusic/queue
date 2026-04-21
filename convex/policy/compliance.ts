import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getInstructorJobActionBlockReason,
  getInstructorTrustSnapshot,
  loadInstructorComplianceSnapshot,
} from "../lib/instructorCompliance";
import { assertStudioCanPublishJobs, buildStudioComplianceSummary } from "../lib/studioCompliance";

type Ctx = QueryCtx | MutationCtx;

export async function getStudioPublishingPolicy(ctx: Ctx, studio: Doc<"studioProfiles">) {
  const summary = await buildStudioComplianceSummary(ctx, { studio });
  return {
    allowed: summary.canPublishJobs,
    summary,
  };
}

export async function enforceStudioPublishingPolicy(ctx: Ctx, studio: Doc<"studioProfiles">) {
  return await assertStudioCanPublishJobs(ctx, studio);
}

export async function getInstructorJobAccessPolicy(
  ctx: Ctx,
  args: {
    instructor: Doc<"instructorProfiles">;
    sport: string;
    requiredCapabilityTags?: ReadonlyArray<string>;
    now: number;
  },
) {
  const compliance = await loadInstructorComplianceSnapshot(ctx, args.instructor._id, args.now);
  const blockReason = getInstructorJobActionBlockReason({
    profile: args.instructor,
    compliance,
    sport: args.sport,
    requiredCapabilityTags: args.requiredCapabilityTags,
  });

  return {
    allowed: blockReason === undefined,
    blockReason,
    compliance,
  };
}

export async function enforceInstructorJobAccessPolicy(
  ctx: Ctx,
  args: {
    instructor: Doc<"instructorProfiles">;
    sport: string;
    requiredCapabilityTags?: ReadonlyArray<string>;
    now: number;
    actionLabel: string;
  },
) {
  const decision = await getInstructorJobAccessPolicy(ctx, args);
  if (!decision.allowed) {
    throw new ConvexError({
      code: "VERIFICATION_REQUIRED",
      message: `${args.actionLabel} blocked: ${decision.blockReason}`,
      blockReason: decision.blockReason,
    });
  }
  return decision;
}

export async function getInstructorTrustPolicy(
  ctx: Ctx,
  instructor: Doc<"instructorProfiles">,
  now: number,
) {
  return await getInstructorTrustSnapshot(ctx, {
    instructor,
    now,
  });
}

export async function listInstructorTrustPolicies(
  ctx: Ctx,
  args: {
    instructors: Array<Doc<"instructorProfiles">>;
    now: number;
  },
) {
  const trustByInstructorId = new Map<
    string,
    Awaited<ReturnType<typeof getInstructorTrustPolicy>>
  >();

  await Promise.all(
    args.instructors.map(async (instructor) => {
      trustByInstructorId.set(
        String(instructor._id),
        await getInstructorTrustPolicy(ctx, instructor, args.now),
      );
    }),
  );

  return trustByInstructorId;
}

export async function getInstructorAssignmentTrustPolicy(
  ctx: Ctx,
  instructorId: Id<"instructorProfiles">,
  now: number,
) {
  const instructor = await ctx.db.get("instructorProfiles", instructorId);
  if (!instructor) {
    throw new ConvexError("Instructor profile not found");
  }
  return await getInstructorTrustPolicy(ctx, instructor, now);
}
