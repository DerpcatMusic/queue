import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import {
  enforceInstructorMarketplaceActionPolicy,
  transitionLessonCheckInPolicy,
} from "../policy/marketplace";
import {
  getAllowedCheckInDistanceMeters,
  getDistanceMeters,
  LESSON_CHECK_IN_MAX_ACCURACY_METERS,
  LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS,
  LESSON_CHECK_IN_WINDOW_AFTER_MS,
  LESSON_CHECK_IN_WINDOW_BEFORE_MS,
  type LessonCheckInReason,
  requireInstructorProfile,
} from "./_helpers";

export const checkIntoLesson = mutation({
  args: {
    jobId: v.id("jobs"),
    latitude: v.number(),
    longitude: v.number(),
    accuracyMeters: v.number(),
    sampledAt: v.number(),
  },
  returns: v.object({
    status: v.union(v.literal("verified"), v.literal("rejected")),
    reason: v.union(
      v.literal("verified"),
      v.literal("outside_radius"),
      v.literal("accuracy_too_low"),
      v.literal("sample_too_old"),
      v.literal("outside_check_in_window"),
      v.literal("branch_location_missing"),
    ),
    checkedInAt: v.number(),
    distanceToBranchMeters: v.optional(v.number()),
    allowedDistanceMeters: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.latitude) || !Number.isFinite(args.longitude)) {
      throw new ConvexError("Valid coordinates are required");
    }
    if (!Number.isFinite(args.accuracyMeters) || args.accuracyMeters < 0) {
      throw new ConvexError("accuracyMeters must be a valid non-negative number");
    }
    if (!Number.isFinite(args.sampledAt)) {
      throw new ConvexError("sampledAt must be a valid timestamp");
    }

    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized for this lesson");
    }
    if (job.status !== "filled") {
      throw new ConvexError("Only active filled lessons can be checked into");
    }

    // Verify instructor is still compliant before allowing check-in
    await enforceInstructorMarketplaceActionPolicy(ctx, {
      instructor,
      job,
      actionLabel: "Check-in",
    });

    const latestCheckIn = await ctx.db
      .query("lessonCheckIns")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", job._id).eq("instructorId", instructor._id),
      )
      .order("desc")
      .first();
    if (latestCheckIn?.verificationStatus === "verified") {
      return {
        status: latestCheckIn.verificationStatus,
        reason: latestCheckIn.verificationReason,
        checkedInAt: latestCheckIn.checkedInAt,
        ...omitUndefined({
          distanceToBranchMeters: latestCheckIn.distanceToBranchMeters,
          allowedDistanceMeters: latestCheckIn.allowedDistanceMeters,
        }),
      };
    }

    const branch = await ctx.db.get("studioBranches", job.branchId);
    if (!branch) {
      throw new ConvexError("Branch not found");
    }

    const now = Date.now();
    let verificationStatus: "verified" | "rejected" = "verified";
    let verificationReason: LessonCheckInReason = "verified";
    let distanceToBranchMeters: number | undefined;
    let allowedDistanceMeters: number | undefined;

    if (
      now < job.startTime - LESSON_CHECK_IN_WINDOW_BEFORE_MS ||
      now > Math.min(job.endTime, job.startTime + LESSON_CHECK_IN_WINDOW_AFTER_MS)
    ) {
      verificationStatus = "rejected";
      verificationReason = "outside_check_in_window";
    } else if (now - args.sampledAt > LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS) {
      verificationStatus = "rejected";
      verificationReason = "sample_too_old";
    } else if (args.accuracyMeters > LESSON_CHECK_IN_MAX_ACCURACY_METERS) {
      verificationStatus = "rejected";
      verificationReason = "accuracy_too_low";
    } else if (!Number.isFinite(branch.latitude) || !Number.isFinite(branch.longitude)) {
      verificationStatus = "rejected";
      verificationReason = "branch_location_missing";
    } else {
      distanceToBranchMeters = getDistanceMeters(
        { latitude: args.latitude, longitude: args.longitude },
        { latitude: branch.latitude!, longitude: branch.longitude! },
      );
      allowedDistanceMeters = getAllowedCheckInDistanceMeters(branch);

      if (distanceToBranchMeters > allowedDistanceMeters) {
        verificationStatus = "rejected";
        verificationReason = "outside_radius";
      }
    }

    const checkedInAt = now;
    const assignmentRows = await ctx.db
      .query("jobAssignments")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();
    const assignment =
      assignmentRows.find(
        (row) => row.instructorId === instructor._id && row.status === "accepted",
      ) ?? null;
    await ctx.db.insert("lessonCheckIns", {
      jobId: job._id,
      branchId: branch._id,
      studioId: job.studioId,
      instructorId: instructor._id,
      checkedInByUserId: instructor.userId,
      verificationStatus,
      verificationReason,
      latitude: args.latitude,
      longitude: args.longitude,
      accuracyMeters: args.accuracyMeters,
      sampledAt: args.sampledAt,
      checkedInAt,
      ...omitUndefined({
        distanceToBranchMeters,
        allowedDistanceMeters,
      }),
    });
    await ctx.db.insert("lessonPresenceEvents", {
      jobId: job._id,
      branchId: branch._id,
      studioId: job.studioId,
      instructorId: instructor._id,
      actorUserId: instructor.userId,
      eventType: "check_in",
      verificationStatus,
      verificationReason,
      latitude: args.latitude,
      longitude: args.longitude,
      accuracyMeters: args.accuracyMeters,
      sampledAt: args.sampledAt,
      occurredAt: checkedInAt,
      createdAt: checkedInAt,
      ...omitUndefined({
        assignmentId: assignment?._id,
      }),
      ...omitUndefined({
        distanceToBranchMeters,
        allowedDistanceMeters,
      }),
    });
    if (verificationStatus === "verified") {
      await transitionLessonCheckInPolicy(ctx, {
        job,
        instructorId: instructor._id,
        instructorUserId: instructor.userId,
        lessonStatus: "checked_in",
        settlementStatus: job.paymentTiming === "before_lesson" ? "pending" : "awaiting_lesson",
        ...omitUndefined({
          assignmentId: assignment?._id,
        }),
      });
    }

    return {
      status: verificationStatus,
      reason: verificationReason,
      checkedInAt,
      ...omitUndefined({
        distanceToBranchMeters,
        allowedDistanceMeters,
      }),
    };
  },
});
