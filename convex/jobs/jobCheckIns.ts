import type { Doc, Id, MutationCtx, QueryCtx } from "../_generated/dataModel";
import { getAllowedCheckInDistanceMeters, getDistanceMeters } from "./jobConstants";

export type LessonCheckInReason = import("./jobConstants").LessonCheckInReason;
export type LessonCheckInSummary = import("./jobConstants").LessonCheckInSummary;

export function toLessonCheckInSummary(
  checkIn: Doc<"lessonCheckIns"> | null | undefined,
): LessonCheckInSummary | undefined {
  if (!checkIn) {
    return undefined;
  }

  return {
    checkInStatus: checkIn.verificationStatus,
    checkInReason: checkIn.verificationReason,
    checkedInAt: checkIn.checkedInAt,
    ...(checkIn.distanceToBranchMeters !== undefined
      ? { checkInDistanceMeters: checkIn.distanceToBranchMeters }
      : {}),
  };
}

export async function loadLatestLessonCheckInSummary(
  ctx: QueryCtx | MutationCtx,
  args: {
    jobId: Id<"jobs">;
    instructorId: Id<"instructorProfiles"> | undefined;
  },
) {
  if (!args.instructorId) {
    return undefined;
  }

  const latestCheckIn = await ctx.db
    .query("lessonCheckIns")
    .withIndex("by_job_and_instructor", (q) =>
      q.eq("jobId", args.jobId).eq("instructorId", args.instructorId!),
    )
    .order("desc")
    .first();

  return toLessonCheckInSummary(latestCheckIn);
}

export { getAllowedCheckInDistanceMeters, getDistanceMeters };
