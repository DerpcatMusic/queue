import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { googleCalendarNodeInternal } from "./googleCalendarShared";

export const connectGoogleCalendarWithCode = action({
  args: {
    code: v.string(),
    codeVerifier: v.string(),
    redirectUri: v.string(),
    clientId: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    connected: v.boolean(),
    accountEmail: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await ctx.runAction(
      googleCalendarNodeInternal.connectGoogleCalendarWithCodeInternal,
      args,
    );
  },
});

export const connectGoogleCalendarWithServerAuthCode = action({
  args: {
    serverAuthCode: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    connected: v.boolean(),
    accountEmail: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await ctx.runAction(
      googleCalendarNodeInternal.connectGoogleCalendarWithServerAuthCodeInternal,
      args,
    );
  },
});

export const syncMyGoogleCalendarEvents = action({
  args: {
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    syncedCount: v.number(),
    removedCount: v.number(),
    importedCount: v.number(),
    importedRemovedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    return await ctx.runAction(googleCalendarNodeInternal.syncMyGoogleCalendarEventsInternal, args);
  },
});

export const disconnectGoogleCalendar = action({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    deletedRemoteEvents: v.boolean(),
  }),
  handler: async (ctx) => {
    return await ctx.runAction(googleCalendarNodeInternal.disconnectGoogleCalendarInternal, {});
  },
});

export const syncGoogleCalendarForUser = internalAction({
  args: {
    userId: v.id("users"),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    syncedCount: v.number(),
    removedCount: v.number(),
    importedCount: v.number(),
    importedRemovedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    return await ctx.runAction(googleCalendarNodeInternal.syncGoogleCalendarForUserInternal, args);
  },
});
