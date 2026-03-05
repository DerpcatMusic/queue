"use node";

import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getCurrentUser as getCurrentUserDoc, requireUserRole } from "./lib/auth";
import { omitUndefined } from "./lib/validation";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_PROVIDER = "google" as const;
const calendarInternal = (internal as unknown as { calendar: Record<string, unknown> })
  .calendar as any;

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type TimelineRow = {
  lessonId: string;
  studioName: string;
  sport: string;
  startTime: number;
  endTime: number;
  status: "open" | "filled" | "cancelled" | "completed";
};

function parseScopes(scope: string | undefined): string[] {
  if (!scope) {
    return [];
  }
  return scope
    .split(" ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function getAllowedGoogleClientIds() {
  const csv = process.env.GOOGLE_CALENDAR_CLIENT_IDS?.trim();
  if (!csv) {
    return [];
  }
  return csv
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function assertGoogleClientIdAllowed(clientId: string) {
  const allowed = getAllowedGoogleClientIds();
  if (allowed.length === 0) {
    return;
  }
  if (!allowed.includes(clientId)) {
    throw new ConvexError("Google client ID is not allowed for this environment");
  }
}

async function exchangeGoogleAuthorizationCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new ConvexError(
      payload.error_description ?? payload.error ?? "Failed to exchange Google authorization code",
    );
  }

  return payload;
}

async function refreshGoogleAccessToken(args: {
  refreshToken: string;
  clientId: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
    client_id: args.clientId,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new ConvexError(
      payload.error_description ?? payload.error ?? "Failed to refresh Google token",
    );
  }

  return payload;
}

async function fetchGoogleAccountEmail(accessToken: string): Promise<string | undefined> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return undefined;
  }
  const payload = (await response.json()) as { email?: string };
  return payload.email?.trim() || undefined;
}

function buildGoogleEventBody(row: TimelineRow) {
  return {
    summary: `${row.sport} lesson`,
    description: `Studio: ${row.studioName}`,
    start: {
      dateTime: new Date(row.startTime).toISOString(),
    },
    end: {
      dateTime: new Date(row.endTime).toISOString(),
    },
  };
}

async function upsertGoogleEvent(args: {
  accessToken: string;
  providerEventId?: string;
  row: TimelineRow;
}): Promise<{ eventId: string; etag?: string }> {
  const body = JSON.stringify(buildGoogleEventBody(args.row));

  if (args.providerEventId) {
    const updateResponse = await fetch(
      `${GOOGLE_EVENTS_BASE}/${encodeURIComponent(args.providerEventId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          "Content-Type": "application/json",
        },
        body,
      },
    );

    if (updateResponse.ok) {
      const payload = (await updateResponse.json()) as { id?: string; etag?: string };
      if (payload.id) {
        return {
          eventId: payload.id,
          ...omitUndefined({ etag: payload.etag }),
        };
      }
    } else if (updateResponse.status !== 404) {
      const message = await updateResponse.text();
      throw new ConvexError(`Google update failed: ${message}`);
    }
  }

  const createResponse = await fetch(GOOGLE_EVENTS_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (!createResponse.ok) {
    const message = await createResponse.text();
    throw new ConvexError(`Google create failed: ${message}`);
  }

  const payload = (await createResponse.json()) as { id?: string; etag?: string };
  if (!payload.id) {
    throw new ConvexError("Google event creation returned no event id");
  }
  return {
    eventId: payload.id,
    ...omitUndefined({ etag: payload.etag }),
  };
}

async function deleteGoogleEvent(args: { accessToken: string; providerEventId: string }) {
  const response = await fetch(
    `${GOOGLE_EVENTS_BASE}/${encodeURIComponent(args.providerEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${args.accessToken}` },
    },
  );
  if (response.ok || response.status === 404) {
    return;
  }
  const message = await response.text();
  throw new ConvexError(`Google delete failed: ${message}`);
}

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
    if (!user || !user.isActive || user.role !== "instructor") {
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

export const disconnectGoogleCalendar = mutation({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!profile) {
      throw new ConvexError("Instructor profile not found");
    }

    const integration = await ctx.db
      .query("calendarIntegrations")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", GOOGLE_PROVIDER),
      )
      .unique();

    if (integration) {
      const mappings = await ctx.db
        .query("calendarEventMappings")
        .withIndex("by_integration", (q) => q.eq("integrationId", integration._id))
        .collect();
      await Promise.all(mappings.map((mapping) => ctx.db.delete(mapping._id)));
      await ctx.db.delete(integration._id);
    }

    await ctx.db.patch(profile._id, {
      calendarProvider: "none",
      calendarSyncEnabled: false,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

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
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Only instructors can connect Google Calendar");
    }

    assertGoogleClientIdAllowed(args.clientId);

    const profile = await ctx.runQuery(calendarInternal.getInstructorProfileForUser, {
      userId: currentUser._id,
    });
    if (!profile) {
      throw new ConvexError("Instructor profile not found");
    }

    const existingIntegration = await ctx.runQuery(calendarInternal.getGoogleIntegrationForUser, {
      userId: currentUser._id,
    });

    const token = await exchangeGoogleAuthorizationCode({
      code: args.code,
      codeVerifier: args.codeVerifier,
      redirectUri: args.redirectUri,
      clientId: args.clientId,
    });

    const refreshToken = token.refresh_token ?? existingIntegration?.refreshToken;
    const accessToken = token.access_token;
    if (!accessToken) {
      throw new ConvexError("Google access token was missing from authorization response");
    }
    const accountEmail = await fetchGoogleAccountEmail(accessToken);

    await ctx.runMutation(calendarInternal.upsertGoogleIntegration, {
      userId: currentUser._id,
      instructorId: profile._id,
      accountEmail,
      oauthClientId: args.clientId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000,
      scopes: parseScopes(token.scope),
      enableSync: true,
      clearError: true,
    });

    return {
      ok: true,
      connected: true,
      ...omitUndefined({ accountEmail }),
    };
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
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "instructor") {
      throw new ConvexError("Only instructors can sync Google Calendar");
    }

    const integration = await ctx.runQuery(calendarInternal.getGoogleIntegrationForUser, {
      userId: currentUser._id,
    });
    if (!integration || integration.status !== "connected") {
      throw new ConvexError("Google Calendar is not connected");
    }
    if (!integration.refreshToken || !integration.oauthClientId) {
      throw new ConvexError("Google Calendar integration is missing refresh credentials");
    }

    try {
      let accessToken = integration.accessToken ?? "";
      let accessTokenExpiresAt = integration.accessTokenExpiresAt ?? 0;
      if (!accessToken || accessTokenExpiresAt < now + 60_000) {
        const refreshed = await refreshGoogleAccessToken({
          refreshToken: integration.refreshToken,
          clientId: integration.oauthClientId,
        });
        accessToken = refreshed.access_token ?? "";
        accessTokenExpiresAt = now + Math.max(60, refreshed.expires_in ?? 3600) * 1000;

        await ctx.runMutation(calendarInternal.updateGoogleAccessToken, {
          integrationId: integration._id,
          accessToken,
          accessTokenExpiresAt,
          scopes: parseScopes(refreshed.scope),
        });
      }

      const startTime = args.startTime ?? now - 7 * 24 * 60 * 60 * 1000;
      const endTime = args.endTime ?? now + 90 * 24 * 60 * 60 * 1000;
      const limit = Math.max(50, Math.min(1000, args.limit ?? 400));
      const timeline = (await ctx.runQuery(api.jobs.getMyCalendarTimeline, {
        startTime,
        endTime,
        limit,
      })) as TimelineRow[];

      const targetRows = timeline
        .filter((row) => row.status !== "cancelled" && row.endTime >= now - 7 * 24 * 60 * 60 * 1000)
        .sort((a, b) => a.startTime - b.startTime);

      const existingMappings = (await ctx.runQuery(
        calendarInternal.getEventMappingsForIntegration,
        {
          integrationId: integration._id,
        },
      )) as Array<{ externalEventId: string; providerEventId: string }>;
      const mappingByExternalId = new Map(
        existingMappings.map((mapping: { externalEventId: string; providerEventId: string }) => [
          mapping.externalEventId,
          mapping.providerEventId,
        ]),
      );

      const nextMappings: Array<{
        externalEventId: string;
        providerEventId: string;
        providerEtag?: string;
        startTime: number;
        endTime: number;
      }> = [];

      for (const row of targetRows) {
        const updated = await upsertGoogleEvent({
          accessToken,
          ...omitUndefined({ providerEventId: mappingByExternalId.get(row.lessonId) }),
          row,
        });
        nextMappings.push({
          externalEventId: row.lessonId,
          providerEventId: updated.eventId,
          ...omitUndefined({ providerEtag: updated.etag }),
          startTime: row.startTime,
          endTime: row.endTime,
        });
      }

      const activeExternalIds = new Set(nextMappings.map((mapping) => mapping.externalEventId));
      let removedCount = 0;
      for (const mapping of existingMappings) {
        if (activeExternalIds.has(mapping.externalEventId)) {
          continue;
        }
        await deleteGoogleEvent({ accessToken, providerEventId: mapping.providerEventId });
        removedCount += 1;
      }

      await ctx.runMutation(calendarInternal.replaceEventMappingsForIntegration, {
        integrationId: integration._id,
        mappings: nextMappings,
      });
      await ctx.runMutation(calendarInternal.markGoogleSyncResult, {
        integrationId: integration._id,
        lastSyncedAt: Date.now(),
        lastError: undefined,
      });

      return {
        ok: true,
        syncedCount: nextMappings.length,
        removedCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Calendar sync failed";
      await ctx.runMutation(calendarInternal.markGoogleSyncResult, {
        integrationId: integration._id,
        lastError: message,
      });
      throw error;
    }
  },
});

export const getInstructorProfileForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.object({ _id: v.id("instructorProfiles") }), v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) {
      return null;
    }
    return { _id: profile._id };
  },
});

export const getGoogleIntegrationForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("calendarIntegrations"),
      status: v.union(v.literal("connected"), v.literal("error"), v.literal("revoked")),
      accessToken: v.optional(v.string()),
      refreshToken: v.optional(v.string()),
      oauthClientId: v.optional(v.string()),
      accessTokenExpiresAt: v.optional(v.number()),
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
    return {
      _id: integration._id,
      status: integration.status,
      ...omitUndefined({
        accessToken: integration.accessToken,
        refreshToken: integration.refreshToken,
        oauthClientId: integration.oauthClientId,
        accessTokenExpiresAt: integration.accessTokenExpiresAt,
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

export const upsertGoogleIntegration = internalMutation({
  args: {
    userId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
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
      accountEmail: args.accountEmail,
      oauthClientId: args.oauthClientId,
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scopes: args.scopes,
      ...(args.refreshToken ? { refreshToken: args.refreshToken } : {}),
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
        instructorId: args.instructorId,
        provider: GOOGLE_PROVIDER,
        status: "connected",
        ...omitUndefined({
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

    await ctx.db.patch(args.instructorId, {
      calendarProvider: "google",
      calendarSyncEnabled: args.enableSync,
      calendarConnectedAt: now,
      updatedAt: now,
    });

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
