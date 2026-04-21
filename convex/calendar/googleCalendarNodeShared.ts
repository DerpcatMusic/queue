"use node";

import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { decryptCalendarToken, encryptRequiredCalendarToken } from "../lib/calendarCrypto";
import {
  buildGoogleEventBody,
  type CalendarOwnerRole,
  type GoogleCalendarEvent,
  type ImportedGoogleCalendarEvent,
  isQueueManagedGoogleEvent,
  normalizeImportedGoogleEvent,
  type TimelineRow,
} from "../lib/calendarShared";
import { omitUndefined } from "../lib/validation";

export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const GOOGLE_EVENTS_LIST_PAGE_SIZE = 250;
export const calendarInternal = (
  internal as unknown as { calendar: { googleCalendar: Record<string, unknown> } }
).calendar.googleCalendar as any;
export const GOOGLE_REFRESH_CREDENTIALS_MISSING_ERROR =
  "Google Calendar integration is missing refresh credentials";
const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type GoogleIntegrationRecord = {
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

export type CalendarOwnerProfile = {
  role: CalendarOwnerRole;
  calendarProvider: "none" | "google" | "apple";
  calendarSyncEnabled: boolean;
  calendarConnectedAt?: number;
  instructorId?: Id<"instructorProfiles">;
  studioId?: Id<"studioProfiles">;
};

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConvexError(`Google API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parseScopes(scope: string | undefined): string[] {
  if (!scope) {
    return [];
  }
  return scope
    .split(" ")
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0);
}

export function getAllowedGoogleClientIds() {
  const csv = process.env.GOOGLE_CALENDAR_CLIENT_IDS?.trim();
  if (!csv) {
    return [];
  }
  return csv
    .split(",")
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0);
}

export function assertGoogleClientIdAllowed(clientId: string) {
  const allowed = getAllowedGoogleClientIds();
  if (allowed.length === 0) {
    return;
  }
  if (!allowed.includes(clientId)) {
    throw new ConvexError("Google client ID is not allowed for this environment");
  }
}

export function getGoogleServerClientId() {
  const clientId = process.env.GOOGLE_CALENDAR_SERVER_CLIENT_ID?.trim();
  if (!clientId) {
    throw new ConvexError("GOOGLE_CALENDAR_SERVER_CLIENT_ID is not configured");
  }
  return clientId;
}

export function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new ConvexError("GOOGLE_CALENDAR_CLIENT_SECRET is not configured");
  }
  return clientSecret;
}

export async function exchangeGoogleAuthorizationCode(args: {
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

  const response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
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

export async function exchangeGoogleServerAuthCode(args: {
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

  const response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
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

export async function refreshGoogleAccessToken(args: {
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

  const response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
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

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | undefined> {
  const response = await fetchWithTimeout(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return undefined;
  }
  const payload = (await response.json()) as { email?: string };
  return payload.email?.trim() || undefined;
}

export async function upsertGoogleEvent(args: {
  accessToken: string;
  providerEventId?: string;
  row: TimelineRow;
}): Promise<{ eventId: string; etag?: string }> {
  const body = JSON.stringify(buildGoogleEventBody(args.row));

  if (args.providerEventId) {
    const updateResponse = await fetchWithTimeout(
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

  const createResponse = await fetchWithTimeout(GOOGLE_EVENTS_BASE, {
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

export async function deleteGoogleEvent(args: { accessToken: string; providerEventId: string }) {
  const response = await fetchWithTimeout(
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

export async function listGoogleAgendaChanges(args: {
  accessToken: string;
  syncToken?: string;
}): Promise<{
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

      const response = await fetchWithTimeout(`${GOOGLE_EVENTS_BASE}?${pageParams.toString()}`, {
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

export async function getGoogleAccessToken(
  ctx: any,
  integration: GoogleIntegrationRecord,
  now: number,
) {
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

export async function syncQueueEventsToGoogle(args: {
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

export async function syncGoogleAgendaIntoConvex(args: {
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

export async function runGoogleCalendarSync(
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
