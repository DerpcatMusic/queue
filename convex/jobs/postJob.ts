import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { query, mutation } from "../_generated/server";
import {
  BOOST_CUSTOM_MAX,
  BOOST_CUSTOM_MIN,
  BOOST_CUSTOM_STEP,
  BOOST_PRESETS,
  BOOST_TRIGGER_MINUTES_OPTIONS,
  DEFAULT_AUTO_EXPIRE_MINUTES,
  ensureOneOf,
  assertPositiveNumber,
  normalizeTimeZone,
  scheduleGoogleCalendarSyncForUser,
  SESSION_LANGUAGE_SET,
  REQUIRED_LEVEL_SET,
} from "./_helpers";
import {
  ensureStudioInfrastructure,
  requireAccessibleStudioBranch,
  requireStudioOwnerContext,
} from "../lib/studioBranches";
import { getH3HierarchyFromCell } from "../lib/h3";
import {
  assertPositiveInteger,
  assertValidJobApplicationDeadline,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";
import { normalizeCapabilityTagArray, normalizeSportType } from "../lib/domainValidation";
import { assertStudioCanPublishJobs } from "../lib/studioCompliance";

export const getServerNow = query({
  args: {
    minuteBucket: v.optional(v.number()),
  },
  returns: v.object({
    now: v.number(),
  }),
  handler: async () => {
    return { now: Date.now() };
  },
});

export const postJob = mutation({
  args: {
    branchId: v.id("studioBranches"),
    sport: v.string(),
    requiredCapabilityTags: v.optional(v.array(v.string())),
    preferredCapabilityTags: v.optional(v.array(v.string())),
    startTime: v.number(),
    endTime: v.number(),
    timeZone: v.optional(v.string()),
    pay: v.number(),
    note: v.optional(v.string()),
    requiredLevel: v.optional(
      v.union(
        v.literal("beginner_friendly"),
        v.literal("all_levels"),
        v.literal("intermediate"),
        v.literal("advanced"),
      ),
    ),
    maxParticipants: v.optional(v.number()),
    equipmentProvided: v.optional(v.boolean()),
    sessionLanguage: v.optional(
      v.union(v.literal("hebrew"), v.literal("english"), v.literal("arabic"), v.literal("russian")),
    ),
    isRecurring: v.optional(v.boolean()),
    cancellationDeadlineHours: v.optional(v.number()),
    applicationDeadline: v.optional(v.number()),
    expiryOverrideMinutes: v.optional(v.number()),
    boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
    boostCustomAmount: v.optional(v.number()),
    boostTriggerMinutes: v.optional(v.number()),
  },
  returns: v.object({
    jobId: v.id("jobs"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    await assertStudioCanPublishJobs(ctx, studio);
    const { branch } = await requireAccessibleStudioBranch(ctx, {
      studioId: studio._id,
      branchId: args.branchId,
      allowedRoles: ["owner"],
    });

    if (!branch.h3Index) {
      throw new ConvexError("Branch must have a location before posting jobs");
    }

    await ensureStudioInfrastructure(ctx, studio, now);

    const sport = normalizeSportType(args.sport);
    const requiredCapabilityTags = normalizeCapabilityTagArray(args.requiredCapabilityTags);
    const preferredCapabilityTags = normalizeCapabilityTagArray(args.preferredCapabilityTags);
    const timeZone = normalizeTimeZone(args.timeZone);

    assertPositiveNumber(args.pay, "pay");
    if (!Number.isFinite(args.startTime) || !Number.isFinite(args.endTime)) {
      throw new ConvexError("startTime and endTime must be finite numbers");
    }
    if (args.endTime <= args.startTime) {
      throw new ConvexError("endTime must be after startTime");
    }

    if (args.requiredLevel) {
      ensureOneOf(args.requiredLevel, REQUIRED_LEVEL_SET, "requiredLevel");
    }
    if (args.sessionLanguage) {
      ensureOneOf(args.sessionLanguage, SESSION_LANGUAGE_SET, "sessionLanguage");
    }
    if (args.maxParticipants !== undefined) {
      assertPositiveInteger(args.maxParticipants, "maxParticipants");
    }
    if (args.cancellationDeadlineHours !== undefined) {
      assertPositiveInteger(args.cancellationDeadlineHours, "cancellationDeadlineHours");
    }
    assertValidJobApplicationDeadline({
      now,
      startTime: args.startTime,
      applicationDeadline: args.applicationDeadline,
    });

    // Validate boostPreset if provided
    if (args.boostPreset !== undefined && !(args.boostPreset in BOOST_PRESETS)) {
      throw new ConvexError(
        `Invalid boostPreset "${args.boostPreset}". Must be one of: ${Object.keys(BOOST_PRESETS).join(", ")}`,
      );
    }

    // Determine boost bonus amount: custom amount takes precedence over preset
    const hasBoost = args.boostPreset !== undefined || args.boostCustomAmount !== undefined;
    const boostBonusAmount =
      args.boostCustomAmount ?? (args.boostPreset ? BOOST_PRESETS[args.boostPreset] : undefined);
    const boostActive = hasBoost;

    // Validate boostCustomAmount if provided
    if (boostBonusAmount !== undefined) {
      if (boostBonusAmount < BOOST_CUSTOM_MIN || boostBonusAmount > BOOST_CUSTOM_MAX) {
        throw new ConvexError(
          `Invalid boostCustomAmount "${boostBonusAmount}". Must be between ${BOOST_CUSTOM_MIN} and ${BOOST_CUSTOM_MAX}.`,
        );
      }
      if (boostBonusAmount % BOOST_CUSTOM_STEP !== 0) {
        throw new ConvexError(
          `Invalid boostCustomAmount "${boostBonusAmount}". Must be a multiple of ${BOOST_CUSTOM_STEP}.`,
        );
      }
    }

    // Validate boostTriggerMinutes if provided
    if (args.boostTriggerMinutes !== undefined) {
      if (
        !BOOST_TRIGGER_MINUTES_OPTIONS.includes(
          args.boostTriggerMinutes as (typeof BOOST_TRIGGER_MINUTES_OPTIONS)[number],
        )
      ) {
        throw new ConvexError(
          `Invalid boostTriggerMinutes "${args.boostTriggerMinutes}". Must be one of: ${BOOST_TRIGGER_MINUTES_OPTIONS.join(", ")}.`,
        );
      }
    }

    const branchH3 = getH3HierarchyFromCell(branch.h3Index);
    const jobId = await ctx.db.insert("jobs", {
      studioId: studio._id,
      branchId: branch._id,
      h3Index: branchH3.h3Index,
      h3Res8: branchH3.h3Res8,
      h3Res7: branchH3.h3Res7,
      h3Res4: branchH3.h3Res4,
      h3Res5: branchH3.h3Res5,
      h3Res6: branchH3.h3Res6,
      sport,
      startTime: args.startTime,
      endTime: args.endTime,
      pay: args.pay,
      status: "open",
      postedAt: now,
      ...omitUndefined({
        branchNameSnapshot: branch.name,
        branchAddressSnapshot: branch.address,
        requiredCapabilityTags,
        preferredCapabilityTags,
        timeZone,
        note: trimOptionalString(args.note),
        requiredLevel: args.requiredLevel,
        maxParticipants: args.maxParticipants,
        equipmentProvided: args.equipmentProvided,
        sessionLanguage: args.sessionLanguage,
        isRecurring: args.isRecurring,
        cancellationDeadlineHours: args.cancellationDeadlineHours,
        applicationDeadline: args.applicationDeadline,
        expiryOverrideMinutes: args.expiryOverrideMinutes,
        boostPreset: args.boostPreset,
        boostBonusAmount,
        boostActive,
        boostTriggerMinutes: args.boostTriggerMinutes,
        autoAcceptEnabled: branch.autoAcceptDefault ?? studio.autoAcceptDefault,
      }),
    });

    await ctx.scheduler.runAfter(0, internal.notifications.broadcast.sendJobNotifications, {
      jobId,
    });
    await ctx.scheduler.runAfter(
      Math.max(args.endTime - now, 0),
      internal.jobs.cancellation.closeJobIfStillOpen,
      { jobId },
    );

    const expireMinutes =
      args.expiryOverrideMinutes ??
      branch.autoExpireMinutesBefore ??
      studio.autoExpireMinutesBefore ??
      DEFAULT_AUTO_EXPIRE_MINUTES;
    const expireAt = args.startTime - expireMinutes * 60 * 1000;
    const expireDelay = Math.max(expireAt - now, 0);
    if (expireAt > now) {
      await ctx.scheduler.runAfter(expireDelay, internal.jobs.cancellation.autoExpireUnfilledJob, {
        jobId,
      });
    }

    await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);

    return { jobId };
  },
});
