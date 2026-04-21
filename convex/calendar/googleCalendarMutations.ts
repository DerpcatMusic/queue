import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { GOOGLE_PROVIDER } from "../lib/calendarShared";
import { omitUndefined } from "../lib/validation";

export const upsertGoogleIntegration = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
    instructorId: v.optional(v.id("instructorProfiles")),
    studioId: v.optional(v.id("studioProfiles")),
    accountEmail: v.optional(v.string()),
    oauthClientId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.number(),
    scopes: v.array(v.string()),
    enableSync: v.boolean(),
    clearError: v.boolean(),
  },
  returns: v.id("calendarIntegrations"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("calendarIntegrations")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", GOOGLE_PROVIDER),
      )
      .unique();

    const patch = {
      status: "connected" as const,
      role: args.role,
      oauthClientId: args.oauthClientId,
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scopes: args.scopes,
      agendaSyncToken: undefined,
      ...omitUndefined({
        accountEmail: args.accountEmail,
        instructorId: args.instructorId,
        studioId: args.studioId,
        refreshToken: args.refreshToken,
      }),
      ...(args.clearError ? { lastError: undefined } : {}),
      updatedAt: now,
    };

    let integrationId: Id<"calendarIntegrations">;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      integrationId = existing._id;
    } else {
      integrationId = await ctx.db.insert("calendarIntegrations", {
        userId: args.userId,
        role: args.role,
        provider: GOOGLE_PROVIDER,
        status: "connected",
        ...omitUndefined({
          instructorId: args.instructorId,
          studioId: args.studioId,
          accountEmail: args.accountEmail,
          refreshToken: args.refreshToken,
        }),
        oauthClientId: args.oauthClientId,
        accessToken: args.accessToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
        scopes: args.scopes,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.role === "instructor") {
      if (!args.instructorId) {
        throw new ConvexError("Instructor profile is required for instructor calendar integration");
      }
      await ctx.db.patch(args.instructorId, {
        calendarProvider: "google",
        calendarSyncEnabled: args.enableSync,
        calendarConnectedAt: now,
        updatedAt: now,
      });
    } else {
      if (!args.studioId) {
        throw new ConvexError("Studio profile is required for studio calendar integration");
      }
      await ctx.db.patch(args.studioId, {
        calendarProvider: "google",
        calendarSyncEnabled: args.enableSync,
        calendarConnectedAt: now,
        updatedAt: now,
      });
    }

    return integrationId;
  },
});

export const updateGoogleAccessToken = internalMutation({
  args: {
    integrationId: v.id("calendarIntegrations"),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scopes: args.scopes,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const markGoogleSyncResult = internalMutation({
  args: {
    integrationId: v.id("calendarIntegrations"),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      ...omitUndefined({
        lastSyncedAt: args.lastSyncedAt,
        lastError: args.lastError,
      }),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const replaceEventMappingsForIntegration = internalMutation({
  args: {
    integrationId: v.id("calendarIntegrations"),
    mappings: v.array(
      v.object({
        externalEventId: v.string(),
        providerEventId: v.string(),
        providerEtag: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
      }),
    ),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("calendarEventMappings")
      .withIndex("by_integration", (q) => q.eq("integrationId", args.integrationId))
      .collect();

    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
    await Promise.all(
      args.mappings.map((mapping) =>
        ctx.db.insert("calendarEventMappings", {
          integrationId: args.integrationId,
          externalEventId: mapping.externalEventId,
          providerEventId: mapping.providerEventId,
          ...omitUndefined({ providerEtag: mapping.providerEtag }),
          startTime: mapping.startTime,
          endTime: mapping.endTime,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
    return { ok: true };
  },
});

export const applyGoogleAgendaSyncResult = internalMutation({
  args: {
    integrationId: v.id("calendarIntegrations"),
    nextSyncToken: v.optional(v.string()),
    resetImportedEvents: v.boolean(),
    events: v.array(
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
    deletedProviderEventIds: v.array(v.string()),
  },
  returns: v.object({
    importedCount: v.number(),
    removedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let removedCount = 0;

    if (args.resetImportedEvents) {
      const existing = await ctx.db
        .query("calendarExternalEvents")
        .withIndex("by_integration", (q) => q.eq("integrationId", args.integrationId))
        .collect();
      removedCount += existing.length;
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
    }

    for (const providerEventId of args.deletedProviderEventIds) {
      const existing = await ctx.db
        .query("calendarExternalEvents")
        .withIndex("by_integration_provider_event", (q) =>
          q.eq("integrationId", args.integrationId).eq("providerEventId", providerEventId),
        )
        .unique();
      if (!existing) {
        continue;
      }
      await ctx.db.delete(existing._id);
      removedCount += 1;
    }

    for (const event of args.events) {
      const existing = await ctx.db
        .query("calendarExternalEvents")
        .withIndex("by_integration_provider_event", (q) =>
          q.eq("integrationId", args.integrationId).eq("providerEventId", event.providerEventId),
        )
        .unique();

      const patch = {
        title: event.title,
        status: event.status,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        ...omitUndefined({
          location: event.location,
          htmlLink: event.htmlLink,
          timeZone: event.timeZone,
          providerUpdatedAt: event.providerUpdatedAt,
        }),
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("calendarExternalEvents", {
          integrationId: args.integrationId,
          providerEventId: event.providerEventId,
          title: event.title,
          status: event.status,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          ...omitUndefined({
            location: event.location,
            htmlLink: event.htmlLink,
            timeZone: event.timeZone,
            providerUpdatedAt: event.providerUpdatedAt,
          }),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.integrationId, {
      agendaSyncToken: args.nextSyncToken,
      updatedAt: now,
    });

    return {
      importedCount: args.events.length,
      removedCount,
    };
  },
});

export const disconnectGoogleIntegrationLocally = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const [instructorProfile, studioProfile] = await Promise.all([
      ctx.db
        .query("instructorProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .unique(),
      ctx.db
        .query("studioProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .unique(),
    ]);
    if (!instructorProfile && !studioProfile) {
      throw new ConvexError("Calendar profile not found");
    }

    const integration = await ctx.db
      .query("calendarIntegrations")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", GOOGLE_PROVIDER),
      )
      .unique();

    if (integration) {
      const [mappings, importedEvents] = await Promise.all([
        ctx.db
          .query("calendarEventMappings")
          .withIndex("by_integration", (q) => q.eq("integrationId", integration._id))
          .collect(),
        ctx.db
          .query("calendarExternalEvents")
          .withIndex("by_integration", (q) => q.eq("integrationId", integration._id))
          .collect(),
      ]);

      await Promise.all([
        ...mappings.map((mapping) => ctx.db.delete(mapping._id)),
        ...importedEvents.map((row) => ctx.db.delete(row._id)),
      ]);
      await ctx.db.delete(integration._id);
    }

    if (instructorProfile) {
      await ctx.db.patch(instructorProfile._id, {
        calendarProvider: "none",
        calendarSyncEnabled: false,
        updatedAt: Date.now(),
      });
    }
    if (studioProfile) {
      await ctx.db.patch(studioProfile._id, {
        calendarProvider: "none",
        calendarSyncEnabled: false,
        updatedAt: Date.now(),
      });
    }

    return { ok: true };
  },
});
