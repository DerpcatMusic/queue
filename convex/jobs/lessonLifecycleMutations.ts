import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import {
  enforceInstructorMarketplaceActionPolicy,
  readLessonSettlementPolicy,
  transitionLessonCheckInPolicy,
} from "../policy/marketplace";
import {
  enqueueUserNotification,
  FIVE_MINUTES_MS,
  getAllowedCheckInDistanceMeters,
  getDistanceMeters,
  LESSON_CHECK_IN_MAX_ACCURACY_METERS,
  LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS,
  LESSON_CHECK_IN_WINDOW_AFTER_MS,
  requireInstructorProfile,
  toDisplayLabel,
} from "./_helpers";

export const markLessonCompleted = mutation({
  args: {
    jobId: v.id("jobs"),
    checkoutLatitude: v.optional(v.number()),
    checkoutLongitude: v.optional(v.number()),
    checkoutAccuracyMeters: v.optional(v.number()),
    checkoutSampledAt: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized for this lesson");
    }
    if (job.status === "cancelled") {
      throw new ConvexError("Cancelled lessons cannot be completed");
    }
    if (job.status === "completed") {
      return { ok: true };
    }

    const now = Date.now();
    if (now + FIVE_MINUTES_MS < job.endTime) {
      throw new ConvexError("Lesson can be completed near or after end time");
    }

    await enforceInstructorMarketplaceActionPolicy(ctx, {
      instructor,
      job,
      actionLabel: "Lesson completion",
    });

    const settlementPolicy = await ctx.db
      .query("jobSettlementPolicies")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .unique();
    const requiresVerifiedCheckOut = settlementPolicy?.requiresVerifiedCheckOut ?? true;
    const hasCheckoutProof =
      args.checkoutLatitude !== undefined &&
      args.checkoutLongitude !== undefined &&
      args.checkoutAccuracyMeters !== undefined &&
      args.checkoutSampledAt !== undefined;
    if (requiresVerifiedCheckOut && !hasCheckoutProof) {
      throw new ConvexError("Verified lesson check-out is required before completion");
    }

    const latestVerifiedCheckIn = await ctx.db
      .query("lessonCheckIns")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", job._id).eq("instructorId", instructor._id),
      )
      .order("desc")
      .first();
    if (!latestVerifiedCheckIn || latestVerifiedCheckIn.verificationStatus !== "verified") {
      throw new ConvexError("Verified lesson check-in is required before completion");
    }

    let checkoutDistanceMeters: number | undefined;
    let checkoutAllowedDistanceMeters: number | undefined;
    let checkoutVerificationStatus: "verified" | "rejected" = "verified";
    let checkoutVerificationReason:
      | "verified"
      | "outside_radius"
      | "accuracy_too_low"
      | "sample_too_old"
      | "outside_check_out_window"
      | "branch_location_missing" = "verified";

    const branch = await ctx.db.get("studioBranches", job.branchId);
    if (!branch) {
      throw new ConvexError("Branch not found");
    }

    if (hasCheckoutProof) {
      if (
        !Number.isFinite(args.checkoutLatitude) ||
        !Number.isFinite(args.checkoutLongitude) ||
        !Number.isFinite(args.checkoutAccuracyMeters) ||
        !Number.isFinite(args.checkoutSampledAt)
      ) {
        throw new ConvexError("Checkout location, accuracy, and sample time are required");
      }
      const nowForCheckout = Date.now();
      if (
        nowForCheckout < job.endTime ||
        nowForCheckout > job.endTime + LESSON_CHECK_IN_WINDOW_AFTER_MS
      ) {
        checkoutVerificationStatus = "rejected";
        checkoutVerificationReason = "outside_check_out_window";
      } else if (nowForCheckout - args.checkoutSampledAt > LESSON_CHECK_IN_MAX_SAMPLE_AGE_MS) {
        checkoutVerificationStatus = "rejected";
        checkoutVerificationReason = "sample_too_old";
      } else if (args.checkoutAccuracyMeters > LESSON_CHECK_IN_MAX_ACCURACY_METERS) {
        checkoutVerificationStatus = "rejected";
        checkoutVerificationReason = "accuracy_too_low";
      } else if (!Number.isFinite(branch.latitude) || !Number.isFinite(branch.longitude)) {
        checkoutVerificationStatus = "rejected";
        checkoutVerificationReason = "branch_location_missing";
      } else {
        checkoutDistanceMeters = getDistanceMeters(
          {
            latitude: args.checkoutLatitude,
            longitude: args.checkoutLongitude,
          },
          {
            latitude: branch.latitude!,
            longitude: branch.longitude!,
          },
        );
        checkoutAllowedDistanceMeters = getAllowedCheckInDistanceMeters(branch);
        if (checkoutDistanceMeters > checkoutAllowedDistanceMeters) {
          checkoutVerificationStatus = "rejected";
          checkoutVerificationReason = "outside_radius";
        }
      }
      if (checkoutVerificationStatus === "rejected") {
        throw new ConvexError(
          `Checkout could not be verified (${checkoutVerificationReason}). Move closer and try again.`,
        );
      }
    }

    const assignmentRows = await ctx.db
      .query("jobAssignments")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();
    const assignment =
      assignmentRows.find(
        (row) => row.instructorId === instructor._id && row.status === "accepted",
      ) ?? null;
    const settlementState = await readLessonSettlementPolicy(ctx, {
      jobId: job._id,
      ...omitUndefined({
        assignmentId: assignment?._id,
      }),
    });

    await ctx.db.patch("jobs", job._id, { status: "completed" });
    if (assignment) {
      await ctx.db.patch("jobAssignments", assignment._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("lessonPresenceEvents", {
      jobId: job._id,
      branchId: job.branchId,
      studioId: job.studioId,
      instructorId: instructor._id,
      actorUserId: instructor.userId,
      eventType: "check_out",
      verificationStatus: checkoutVerificationStatus,
      verificationReason: checkoutVerificationReason,
      occurredAt: now,
      createdAt: now,
      ...omitUndefined({
        assignmentId: assignment?._id,
        latitude: args.checkoutLatitude,
        longitude: args.checkoutLongitude,
        accuracyMeters: args.checkoutAccuracyMeters,
        sampledAt: args.checkoutSampledAt,
        distanceToBranchMeters: checkoutDistanceMeters,
        allowedDistanceMeters: checkoutAllowedDistanceMeters,
      }),
    });
    await transitionLessonCheckInPolicy(ctx, {
      job,
      instructorId: instructor._id,
      instructorUserId: instructor.userId,
      lessonStatus: hasCheckoutProof ? "confirmed" : "completed",
      settlementStatus: settlementState?.paymentStatus === "paid" ? "settled" : "ready_for_payment",
      lessonCompletedAt: now,
      ...omitUndefined({
        assignmentId: assignment?._id,
      }),
    });
    await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "lesson_completed",
    });
    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        actorUserId: instructor.userId,
        kind: "lesson_completed",
        title: "Lesson marked complete",
        body: `${instructor.displayName} marked ${toDisplayLabel(job.sport)} as complete.`,
        jobId: job._id,
      });
    }

    return { ok: true };
  },
});

export const emitLessonLifecycleEvent = internalMutation({
  args: {
    jobId: v.id("jobs"),
    instructorId: v.id("instructorProfiles"),
    event: v.union(v.literal("lesson_started"), v.literal("lesson_completed")),
  },
  returns: v.object({ emitted: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    const instructor = await ctx.db.get("instructorProfiles", args.instructorId);
    if (!job || !instructor) {
      return { emitted: false };
    }

    if (job.filledByInstructorId !== instructor._id) {
      return { emitted: false };
    }
    if (job.status === "cancelled" || job.status === "open") {
      return { emitted: false };
    }

    const now = Date.now();
    if (args.event === "lesson_started" && now < job.startTime) {
      return { emitted: false };
    }
    if (args.event === "lesson_completed" && now < job.endTime) {
      return { emitted: false };
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const studioName = studio?.studioName ?? "Your studio";

    await enqueueUserNotification(ctx, {
      recipientUserId: instructor.userId,
      kind: args.event,
      title: args.event === "lesson_started" ? "Lesson started" : "Lesson ended",
      body:
        args.event === "lesson_started"
          ? `${toDisplayLabel(job.sport)} at ${studioName} is now live.`
          : `${toDisplayLabel(job.sport)} at ${studioName} ended. Confirm check-out to mark it complete.`,
      jobId: job._id,
      ...(studio?.userId !== undefined ? { actorUserId: studio.userId } : {}),
    });

    return { emitted: true };
  },
});
