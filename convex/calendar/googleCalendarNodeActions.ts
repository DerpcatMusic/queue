"use node";

import { ConvexError, v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { encryptCalendarToken, encryptRequiredCalendarToken } from "../lib/calendarCrypto";
import { omitUndefined } from "../lib/validation";
import {
  assertGoogleClientIdAllowed,
  type CalendarOwnerProfile,
  calendarInternal,
  deleteGoogleEvent,
  exchangeGoogleAuthorizationCode,
  exchangeGoogleServerAuthCode,
  fetchGoogleAccountEmail,
  type GoogleIntegrationRecord,
  getGoogleAccessToken,
  getGoogleClientSecret,
  getGoogleServerClientId,
  parseScopes,
  runGoogleCalendarSync,
} from "./googleCalendarNodeShared";

export const connectGoogleCalendarWithCodeInternal = internalAction({
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
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || (currentUser.role !== "instructor" && currentUser.role !== "studio")) {
      throw new ConvexError("Only instructors and studios can connect Google Calendar");
    }

    assertGoogleClientIdAllowed(args.clientId);

    const profile = (await ctx.runQuery(calendarInternal.getCalendarProfileForUser, {
      userId: currentUser._id,
    })) as CalendarOwnerProfile | null;
    if (!profile) {
      throw new ConvexError("Calendar profile not found");
    }

    const existingIntegration = (await ctx.runQuery(calendarInternal.getGoogleIntegrationForUser, {
      userId: currentUser._id,
    })) as GoogleIntegrationRecord | null;

    const token = await exchangeGoogleAuthorizationCode({
      code: args.code,
      codeVerifier: args.codeVerifier,
      redirectUri: args.redirectUri,
      clientId: args.clientId,
    });

    const refreshToken = token.refresh_token
      ? encryptCalendarToken(token.refresh_token)
      : existingIntegration?.refreshToken;
    const accessToken = token.access_token;
    if (!accessToken) {
      throw new ConvexError("Google access token was missing from authorization response");
    }
    const accountEmail = await fetchGoogleAccountEmail(accessToken);

    await ctx.runMutation(calendarInternal.upsertGoogleIntegration, {
      userId: currentUser._id,
      role: profile.role,
      ...(profile.instructorId ? { instructorId: profile.instructorId } : {}),
      ...(profile.studioId ? { studioId: profile.studioId } : {}),
      accountEmail,
      oauthClientId: args.clientId,
      accessToken: encryptRequiredCalendarToken(accessToken),
      refreshToken,
      accessTokenExpiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000,
      scopes: parseScopes(token.scope),
      enableSync: true,
      clearError: true,
    });

    await runGoogleCalendarSync(ctx, {
      userId: currentUser._id,
      requireConnected: true,
    });

    return {
      ok: true,
      connected: true,
      ...omitUndefined({ accountEmail }),
    };
  },
});

export const connectGoogleCalendarWithServerAuthCodeInternal = internalAction({
  args: {
    serverAuthCode: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    connected: v.boolean(),
    accountEmail: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || (currentUser.role !== "instructor" && currentUser.role !== "studio")) {
      throw new ConvexError("Only instructors and studios can connect Google Calendar");
    }

    const profile = (await ctx.runQuery(calendarInternal.getCalendarProfileForUser, {
      userId: currentUser._id,
    })) as CalendarOwnerProfile | null;
    if (!profile) {
      throw new ConvexError("Calendar profile not found");
    }

    const existingIntegration = (await ctx.runQuery(calendarInternal.getGoogleIntegrationForUser, {
      userId: currentUser._id,
    })) as GoogleIntegrationRecord | null;

    const clientId = getGoogleServerClientId();
    assertGoogleClientIdAllowed(clientId);
    const clientSecret = getGoogleClientSecret();

    const token = await exchangeGoogleServerAuthCode({
      serverAuthCode: args.serverAuthCode,
      clientId,
      clientSecret,
    });

    const refreshToken = token.refresh_token
      ? encryptCalendarToken(token.refresh_token)
      : existingIntegration?.refreshToken;
    const accessToken = token.access_token;
    if (!accessToken) {
      throw new ConvexError("Google access token was missing from authorization response");
    }
    const accountEmail = await fetchGoogleAccountEmail(accessToken);

    await ctx.runMutation(calendarInternal.upsertGoogleIntegration, {
      userId: currentUser._id,
      role: profile.role,
      ...(profile.instructorId ? { instructorId: profile.instructorId } : {}),
      ...(profile.studioId ? { studioId: profile.studioId } : {}),
      accountEmail,
      oauthClientId: clientId,
      accessToken: encryptRequiredCalendarToken(accessToken),
      refreshToken,
      accessTokenExpiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000,
      scopes: parseScopes(token.scope),
      enableSync: true,
      clearError: true,
    });

    await runGoogleCalendarSync(ctx, {
      userId: currentUser._id,
      requireConnected: true,
    });

    return {
      ok: true,
      connected: true,
      ...omitUndefined({ accountEmail }),
    };
  },
});

export const syncMyGoogleCalendarEventsInternal = internalAction({
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    syncedCount: number;
    removedCount: number;
    importedCount: number;
    importedRemovedCount: number;
  }> => {
    const currentUser = (await ctx.runQuery(api.users.getCurrent.getCurrentUser as any, {})) as {
      _id: Id<"users">;
      role: string;
    } | null;
    if (!currentUser || (currentUser.role !== "instructor" && currentUser.role !== "studio")) {
      throw new ConvexError("Only instructors and studios can sync Google Calendar");
    }

    return await runGoogleCalendarSync(ctx, {
      userId: currentUser._id,
      ...omitUndefined({
        startTime: args.startTime,
        endTime: args.endTime,
        limit: args.limit,
      }),
      requireConnected: true,
    });
  },
});

export const disconnectGoogleCalendarInternal = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    deletedRemoteEvents: v.boolean(),
  }),
  handler: async (ctx) => {
    const currentUser = await ctx.runQuery(api.users.getCurrent.getCurrentUser, {});
    if (!currentUser || (currentUser.role !== "instructor" && currentUser.role !== "studio")) {
      throw new ConvexError("Only instructors and studios can disconnect Google Calendar");
    }

    const integration = (await ctx.runQuery(calendarInternal.getGoogleIntegrationForUser, {
      userId: currentUser._id,
    })) as GoogleIntegrationRecord | null;
    if (!integration) {
      await ctx.runMutation(calendarInternal.disconnectGoogleIntegrationLocally, {
        userId: currentUser._id,
      });
      return { ok: true, deletedRemoteEvents: true };
    }

    let deletedRemoteEvents = true;
    try {
      const accessToken = await getGoogleAccessToken(ctx, integration, Date.now());
      const mappings = (await ctx.runQuery(calendarInternal.getEventMappingsForIntegration, {
        integrationId: integration._id,
      })) as Array<{ providerEventId: string }>;

      for (const mapping of mappings) {
        try {
          await deleteGoogleEvent({ accessToken, providerEventId: mapping.providerEventId });
        } catch {
          deletedRemoteEvents = false;
        }
      }
    } catch {
      deletedRemoteEvents = false;
    }

    await ctx.runMutation(calendarInternal.disconnectGoogleIntegrationLocally, {
      userId: currentUser._id,
    });

    return {
      ok: true,
      deletedRemoteEvents,
    };
  },
});

export const syncGoogleCalendarForUserInternal = internalAction({
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
    return await runGoogleCalendarSync(ctx, {
      userId: args.userId,
      ...omitUndefined({
        startTime: args.startTime,
        endTime: args.endTime,
        limit: args.limit,
      }),
      requireConnected: false,
    });
  },
});
