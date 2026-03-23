"use node";

import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import {
  decryptCalendarToken,
  encryptCalendarToken,
  encryptRequiredCalendarToken,
} from "./lib/calendarCrypto";
import {
  buildGoogleEventBody,
  type CalendarOwnerRole,
  type GoogleCalendarEvent,
  type ImportedGoogleCalendarEvent,
  isQueueManagedGoogleEvent,
  normalizeImportedGoogleEvent,
  type TimelineRow,
} from "./lib/calendarShared";
import { omitUndefined } from "./lib/validation";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_EVENTS_LIST_PAGE_SIZE = 250;
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

type GoogleIntegrationRecord = {
  _id: Id<"calendarIntegrations">;
  role: CalendarOwnerRole;
  status: "connected" | "error" | "revoked";
  instructorId?: Id<"instructorProfiles">;
  studioId?: Id<"studioProfiles">;
  accessToken?: string;
  refreshToken?: string;
  oauthClientId?: string;
  accessTokenExpiresAt?: number;
  agendaSyncToken?: string;
};

const GOOGLE_REFRESH_CREDENTIALS_MISSING_ERROR =
  "Google Calendar integration is missing refresh credentials";

type CalendarOwnerProfile = {
  role: CalendarOwnerRole;
  calendarProvider: "none" | "google" | "apple";
  calendarSyncEnabled: boolean;
  calendarConnectedAt?: number;
  instructorId?: Id<"instructorProfiles">;
  studioId?: Id<"studioProfiles">;
};

function parseScopes(scope: string | undefined): string[] {
  if (!scope) {
    return [];
  }
  return scope
    .split(" ")
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0);
}

function getAllowedGoogleClientIds() {
  const csv = process.env.GOOGLE_CALENDAR_CLIENT_IDS?.trim();
  if (!csv) {
    return [];
  }
  return csv
    .split(",")
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0);
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

function getGoogleServerClientId() {
  const clientId = process.env.GOOGLE_CALENDAR_SERVER_CLIENT_ID?.trim();
  if (!clientId) {
    throw new ConvexError("GOOGLE_CALENDAR_SERVER_CLIENT_ID is not configured");
  }
  return clientId;
}

function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new ConvexError("GOOGLE_CALENDAR_CLIENT_SECRET is not configured");
  }
  return clientSecret;
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

async function exchangeGoogleServerAuthCode(args: {
  serverAuthCode: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.serverAuthCode,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: "",
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new ConvexError(
      payload.error_description ?? payload.error ?? "Failed to exchange Google server auth code",
    );
  }

  return payload;
}

async function refreshGoogleAccessToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
    client_id: args.clientId,
  });
  if (args.clientSecret) {
    body.set("client_secret", args.clientSecret);
  }

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

async function listGoogleAgendaChanges(args: { accessToken: string; syncToken?: string }): Promise<{
  events: GoogleCalendarEvent[];
  nextSyncToken?: string;
  resetImportedEvents: boolean;
}> {
  let syncToken = args.syncToken;
  let resetImportedEvents = !syncToken;

  while (true) {
    const params = new URLSearchParams({
      maxResults: String(GOOGLE_EVENTS_LIST_PAGE_SIZE),
      showDeleted: "true",
      singleEvents: "true",
    });
    if (syncToken) {
      params.set("syncToken", syncToken);
    }

    let pageToken: string | undefined;
    const events: GoogleCalendarEvent[] = [];
    let nextSyncToken: string | undefined;

    while (true) {
      const pageParams = new URLSearchParams(params);
      if (pageToken) {
        pageParams.set("pageToken", pageToken);
      }

      const response = await fetch(`${GOOGLE_EVENTS_BASE}?${pageParams.toString()}`, {
        headers: { Authorization: `Bearer ${args.accessToken}` },
      });
      if (response.status === 410 && syncToken) {
        syncToken = undefined;
        resetImportedEvents = true;
        break;
      }
      if (!response.ok) {
        const message = await response.text();
        throw new ConvexError(`Google agenda import failed: ${message}`);
      }

      const payload = (await response.json()) as {
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };
      events.push(...(payload.items ?? []));
      if (payload.nextPageToken) {
        pageToken = payload.nextPageToken;
        continue;
      }

      nextSyncToken = payload.nextSyncToken;
      return nextSyncToken
        ? { events, nextSyncToken, resetImportedEvents }
        : { events, resetImportedEvents };
    }
  }
}

async function getGoogleAccessToken(ctx: any, integration: GoogleIntegrationRecord, now: number) {
  let accessToken = decryptCalendarToken(integration.accessToken) ?? "";
  let accessTokenExpiresAt = integration.accessTokenExpiresAt ?? 0;
  if (!accessToken || accessTokenExpiresAt < now + 60_000) {
    const refreshToken = decryptCalendarToken(integration.refreshToken);
    if (!refreshToken || !integration.oauthClientId) {
      throw new ConvexError(GOOGLE_REFRESH_CREDENTIALS_MISSING_ERROR);
    }
    const refreshed = await refreshGoogleAccessToken({
      refreshToken,
      clientId: integration.oauthClientId,
      ...(integration.oauthClientId === process.env.GOOGLE_CALENDAR_SERVER_CLIENT_ID?.trim()
        ? { clientSecret: getGoogleClientSecret() }
        : {}),
    });
    accessToken = refreshed.access_token ?? "";
    accessTokenExpiresAt = now + Math.max(60, refreshed.expires_in ?? 3600) * 1000;

    await ctx.runMutation(calendarInternal.updateGoogleAccessToken, {
      integrationId: integration._id,
      accessToken: encryptRequiredCalendarToken(accessToken),
      accessTokenExpiresAt,
      scopes: parseScopes(refreshed.scope),
    });
  }

  return accessToken;
}

async function syncQueueEventsToGoogle(args: {
  ctx: any;
  userId: Id<"users">;
  integrationId: Id<"calendarIntegrations">;
  accessToken: string;
  now: number;
  startTime?: number;
  endTime?: number;
  limit?: number;
}) {
  const startTime = args.startTime ?? args.now - 7 * 24 * 60 * 60 * 1000;
  const endTime = args.endTime ?? args.now + 90 * 24 * 60 * 60 * 1000;
  const limit = Math.max(50, Math.min(1000, args.limit ?? 400));
  const timeline = (await args.ctx.runQuery(calendarInternal.getCalendarTimelineForUser, {
    userId: args.userId,
    startTime,
    endTime,
    limit,
  })) as TimelineRow[];

  const targetRows = timeline
    .filter(
      (row) => row.status !== "cancelled" && row.endTime >= args.now - 7 * 24 * 60 * 60 * 1000,
    )
    .sort((a, b) => a.startTime - b.startTime);

  const existingMappings = (await args.ctx.runQuery(
    calendarInternal.getEventMappingsForIntegration,
    {
      integrationId: args.integrationId,
    },
  )) as Array<{ externalEventId: string; providerEventId: string }>;
  const mappingByExternalId = new Map(
    existingMappings.map((mapping) => [mapping.externalEventId, mapping.providerEventId]),
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
      accessToken: args.accessToken,
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
    await deleteGoogleEvent({
      accessToken: args.accessToken,
      providerEventId: mapping.providerEventId,
    });
    removedCount += 1;
  }

  await args.ctx.runMutation(calendarInternal.replaceEventMappingsForIntegration, {
    integrationId: args.integrationId,
    mappings: nextMappings,
  });

  return {
    syncedCount: nextMappings.length,
    removedCount,
    mappedProviderEventIds: new Set(nextMappings.map((mapping) => mapping.providerEventId)),
  };
}

async function syncGoogleAgendaIntoConvex(args: {
  ctx: any;
  integration: GoogleIntegrationRecord;
  accessToken: string;
  mappedProviderEventIds: ReadonlySet<string>;
}) {
  const imported = await listGoogleAgendaChanges({
    accessToken: args.accessToken,
    ...(args.integration.agendaSyncToken ? { syncToken: args.integration.agendaSyncToken } : {}),
  });

  const nextEvents: ImportedGoogleCalendarEvent[] = [];
  const deletedProviderEventIds = new Set<string>();
  for (const event of imported.events) {
    const providerEventId = event.id?.trim();
    if (!providerEventId) {
      continue;
    }
    if (event.status === "cancelled") {
      deletedProviderEventIds.add(providerEventId);
      continue;
    }
    if (isQueueManagedGoogleEvent(event, args.mappedProviderEventIds)) {
      deletedProviderEventIds.add(providerEventId);
      continue;
    }

    const normalized = normalizeImportedGoogleEvent(event);
    if (!normalized) {
      deletedProviderEventIds.add(providerEventId);
      continue;
    }
    nextEvents.push(normalized);
  }

  const result = (await args.ctx.runMutation(calendarInternal.applyGoogleAgendaSyncResult, {
    integrationId: args.integration._id,
    nextSyncToken: imported.nextSyncToken,
    resetImportedEvents: imported.resetImportedEvents,
    events: nextEvents,
    deletedProviderEventIds: Array.from(deletedProviderEventIds),
  })) as {
    importedCount: number;
    removedCount: number;
  };

  return {
    importedCount: result.importedCount,
    importedRemovedCount: result.removedCount,
  };
}

async function runGoogleCalendarSync(
  ctx: any,
  args: {
    userId: Id<"users">;
    startTime?: number;
    endTime?: number;
    limit?: number;
    requireConnected: boolean;
  },
) {
  const integration = (await ctx.runQuery(calendarInternal.getGoogleIntegrationForUser, {
    userId: args.userId,
  })) as GoogleIntegrationRecord | null;
  if (!integration || integration.status !== "connected") {
    if (args.requireConnected) {
      throw new ConvexError("Google Calendar is not connected");
    }
    return {
      ok: true,
      syncedCount: 0,
      removedCount: 0,
      importedCount: 0,
      importedRemovedCount: 0,
    };
  }

  const profile = (await ctx.runQuery(calendarInternal.getCalendarProfileForUser, {
    userId: args.userId,
  })) as CalendarOwnerProfile | null;
  if (!profile) {
    if (args.requireConnected) {
      throw new ConvexError("Calendar profile not found");
    }
    return {
      ok: true,
      syncedCount: 0,
      removedCount: 0,
      importedCount: 0,
      importedRemovedCount: 0,
    };
  }

  const now = Date.now();
  try {
    const accessToken = await getGoogleAccessToken(ctx, integration, now);
    const existingMappings = (await ctx.runQuery(calendarInternal.getEventMappingsForIntegration, {
      integrationId: integration._id,
    })) as Array<{ externalEventId: string; providerEventId: string }>;
    let pushResult = {
      syncedCount: 0,
      removedCount: 0,
      mappedProviderEventIds: new Set(existingMappings.map((mapping) => mapping.providerEventId)),
    };

    if (profile.calendarProvider === "google" && profile.calendarSyncEnabled) {
      pushResult = await syncQueueEventsToGoogle({
        ctx,
        userId: args.userId,
        integrationId: integration._id,
        accessToken,
        now,
        ...omitUndefined({
          startTime: args.startTime,
          endTime: args.endTime,
          limit: args.limit,
        }),
      });
    }

    const agendaResult = await syncGoogleAgendaIntoConvex({
      ctx,
      integration,
      accessToken,
      mappedProviderEventIds: pushResult.mappedProviderEventIds,
    });

    await ctx.runMutation(calendarInternal.markGoogleSyncResult, {
      integrationId: integration._id,
      lastSyncedAt: Date.now(),
      lastError: undefined,
    });

    return {
      ok: true,
      syncedCount: pushResult.syncedCount,
      removedCount: pushResult.removedCount,
      importedCount: agendaResult.importedCount,
      importedRemovedCount: agendaResult.importedRemovedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed";
    await ctx.runMutation(calendarInternal.markGoogleSyncResult, {
      integrationId: integration._id,
      lastError: message,
    });
    if (message === GOOGLE_REFRESH_CREDENTIALS_MISSING_ERROR) {
      return {
        ok: true,
        syncedCount: 0,
        removedCount: 0,
        importedCount: 0,
        importedRemovedCount: 0,
      };
    }
    throw error;
  }
}

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
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
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
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
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
    const currentUser = (await ctx.runQuery(api.users.getCurrentUser as any, {})) as {
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
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
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
