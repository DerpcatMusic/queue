import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { GOOGLE_PROVIDER } from "../lib/calendarShared";
import { omitUndefined } from "../lib/validation";

export const getMyGoogleCalendarStatus = query({
  args: {},
  returns: v.object({
    connected: v.boolean(),
    hasRefreshToken: v.boolean(),
    accountEmail: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user?.isActive || (user.role !== "instructor" && user.role !== "studio")) {
      return { connected: false, hasRefreshToken: false };
    }

    const integration = await ctx.db
      .query("calendarIntegrations")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", GOOGLE_PROVIDER),
      )
      .unique();

    if (!integration || integration.status !== "connected") {
      return { connected: false, hasRefreshToken: false };
    }

    return {
      connected: true,
      hasRefreshToken: Boolean(integration.refreshToken),
      ...omitUndefined({
        accountEmail: integration.accountEmail,
        lastSyncedAt: integration.lastSyncedAt,
        lastError: integration.lastError,
      }),
    };
  },
});

export const getMyGoogleCalendarAgenda = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      providerEventId: v.string(),
      title: v.string(),
      status: v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
      startTime: v.number(),
      endTime: v.number(),
      isAllDay: v.boolean(),
      location: v.optional(v.string()),
      htmlLink: v.optional(v.string()),
      timeZone: v.optional(v.string()),
      providerUpdatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.startTime) || !Number.isFinite(args.endTime)) {
      throw new ConvexError("startTime and endTime must be finite numbers");
    }
    if (args.endTime < args.startTime) {
      throw new ConvexError("endTime must be greater than or equal to startTime");
    }

    const user = await getCurrentUserDoc(ctx);
    if (!user?.isActive || (user.role !== "instructor" && user.role !== "studio")) {
      return [];
    }

    const integration = await ctx.db
      .query("calendarIntegrations")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", GOOGLE_PROVIDER),
      )
      .unique();
    if (!integration || integration.status !== "connected") {
      return [];
    }

    const rawLimit = args.limit ?? 1000;
    const limit = Math.max(1, Math.min(rawLimit, 1000));
    const rows = await ctx.db
      .query("calendarExternalEvents")
      .withIndex("by_integration_start_time", (q) =>
        q
          .eq("integrationId", integration._id)
          .gte("startTime", args.startTime)
          .lte("startTime", args.endTime),
      )
      .take(limit);

    return rows.map((row) => ({
      providerEventId: row.providerEventId,
      title: row.title,
      status: row.status,
      startTime: row.startTime,
      endTime: row.endTime,
      isAllDay: row.isAllDay,
      ...omitUndefined({
        location: row.location,
        htmlLink: row.htmlLink,
        timeZone: row.timeZone,
        providerUpdatedAt: row.providerUpdatedAt,
      }),
    }));
  },
});

export const getCalendarProfileForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      role: v.literal("instructor"),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
      instructorId: v.id("instructorProfiles"),
    }),
    v.object({
      role: v.literal("studio"),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
      studioId: v.id("studioProfiles"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const instructorProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
    if (instructorProfile) {
      return {
        role: "instructor" as const,
        calendarProvider: instructorProfile.calendarProvider ?? "none",
        calendarSyncEnabled: instructorProfile.calendarSyncEnabled ?? false,
        ...(instructorProfile.calendarConnectedAt !== undefined
          ? { calendarConnectedAt: instructorProfile.calendarConnectedAt }
          : {}),
        instructorId: instructorProfile._id,
      };
    }

    const studioProfile = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
    if (!studioProfile) {
      return null;
    }

    return {
      role: "studio" as const,
      calendarProvider: studioProfile.calendarProvider ?? "none",
      calendarSyncEnabled: studioProfile.calendarSyncEnabled ?? false,
      ...(studioProfile.calendarConnectedAt !== undefined
        ? { calendarConnectedAt: studioProfile.calendarConnectedAt }
        : {}),
      studioId: studioProfile._id,
    };
  },
});

export const getCalendarTimelineForUser = internalQuery({
  args: {
    userId: v.id("users"),
    startTime: v.number(),
    endTime: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      lessonId: v.id("jobs"),
      roleView: v.union(v.literal("instructor"), v.literal("studio")),
      studioName: v.string(),
      instructorName: v.optional(v.string()),
      sport: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      status: v.union(
        v.literal("open"),
        v.literal("filled"),
        v.literal("cancelled"),
        v.literal("completed"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.startTime) || !Number.isFinite(args.endTime)) {
      throw new ConvexError("startTime and endTime must be finite numbers");
    }
    if (args.endTime < args.startTime) {
      throw new ConvexError("endTime must be greater than or equal to startTime");
    }

    const rawLimit = args.limit ?? 400;
    const limit = Math.max(1, Math.min(rawLimit, 1000));

    const instructorProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
    if (instructorProfile) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_filledByInstructor_startTime", (q) =>
          q
            .eq("filledByInstructorId", instructorProfile._id)
            .gte("startTime", args.startTime)
            .lte("startTime", args.endTime),
        )
        .order("asc")
        .take(limit);

      const studioIds = [...new Set(jobs.map((job) => job.studioId))];
      const studios = await Promise.all(studioIds.map((studioId) => ctx.db.get(studioId)));
      const studioNameById = new Map<string, string>();
      for (let index = 0; index < studioIds.length; index += 1) {
        const studioId = studioIds[index];
        const studio = studios[index] as { studioName?: string } | null;
        if (studio?.studioName) {
          studioNameById.set(String(studioId), studio.studioName);
        }
      }

      return jobs.map((job) => ({
        lessonId: job._id,
        roleView: "instructor" as const,
        studioName: studioNameById.get(String(job.studioId)) ?? "Unknown studio",
        instructorName: instructorProfile.displayName,
        sport: job.sport,
        startTime: job.startTime,
        endTime: job.endTime,
        status: job.status,
        ...(job.timeZone ? { timeZone: job.timeZone } : {}),
      }));
    }

    const studioProfile = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
    if (!studioProfile) {
      return [];
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_startTime", (q) =>
        q
          .eq("studioId", studioProfile._id)
          .gte("startTime", args.startTime)
          .lte("startTime", args.endTime),
      )
      .order("asc")
      .take(limit);

    const instructorIds = [
      ...new Set(jobs.map((job) => job.filledByInstructorId).filter((id) => Boolean(id))),
    ];
    const instructors = await Promise.all(
      instructorIds.map((instructorId) => ctx.db.get(instructorId)),
    );
    const instructorNameById = new Map<string, string>();
    for (let index = 0; index < instructorIds.length; index += 1) {
      const instructorId = instructorIds[index];
      const instructor = instructors[index] as { displayName?: string } | null;
      if (instructor?.displayName) {
        instructorNameById.set(String(instructorId), instructor.displayName);
      }
    }

    return jobs.map((job) => ({
      lessonId: job._id,
      roleView: "studio" as const,
      studioName: studioProfile.studioName,
      ...omitUndefined({
        instructorName: job.filledByInstructorId
          ? instructorNameById.get(String(job.filledByInstructorId))
          : undefined,
      }),
      sport: job.sport,
      startTime: job.startTime,
      endTime: job.endTime,
      status: job.status,
      ...(job.timeZone ? { timeZone: job.timeZone } : {}),
    }));
  },
});

export const getGoogleIntegrationForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("calendarIntegrations"),
      role: v.union(v.literal("instructor"), v.literal("studio")),
      status: v.union(v.literal("connected"), v.literal("error"), v.literal("revoked")),
      instructorId: v.optional(v.id("instructorProfiles")),
      studioId: v.optional(v.id("studioProfiles")),
      accessToken: v.optional(v.string()),
      refreshToken: v.optional(v.string()),
      oauthClientId: v.optional(v.string()),
      accessTokenExpiresAt: v.optional(v.number()),
      agendaSyncToken: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("calendarIntegrations")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", GOOGLE_PROVIDER),
      )
      .unique();
    if (!integration) {
      return null;
    }
    const inferredRole =
      integration.role ?? (integration.studioId ? ("studio" as const) : ("instructor" as const));
    return {
      _id: integration._id,
      role: inferredRole,
      status: integration.status,
      ...omitUndefined({
        instructorId: integration.instructorId,
        studioId: integration.studioId,
        accessToken: integration.accessToken,
        refreshToken: integration.refreshToken,
        oauthClientId: integration.oauthClientId,
        accessTokenExpiresAt: integration.accessTokenExpiresAt,
        agendaSyncToken: integration.agendaSyncToken,
      }),
    };
  },
});

export const getEventMappingsForIntegration = internalQuery({
  args: { integrationId: v.id("calendarIntegrations") },
  returns: v.array(
    v.object({
      externalEventId: v.string(),
      providerEventId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("calendarEventMappings")
      .withIndex("by_integration", (q) => q.eq("integrationId", args.integrationId))
      .collect();
    return rows.map((row) => ({
      externalEventId: row.externalEventId,
      providerEventId: row.providerEventId,
    }));
  },
});
