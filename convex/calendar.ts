"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "./lib/auth";
import { omitUndefined } from "./lib/validation";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_PROVIDER = "google" as const;
const GOOGLE_EVENT_SOURCE_KEY = "queueSource";
const GOOGLE_EVENT_SOURCE_VALUE = "queue-job";
const GOOGLE_EVENT_EXTERNAL_ID_KEY = "queueExternalEventId";
const GOOGLE_EVENTS_LIST_PAGE_SIZE = 250;
const CALENDAR_TOKEN_ENCRYPTION_PREFIX = "enc:v1:";
const CALENDAR_TOKEN_ENCRYPTION_SECRET_ENV = "CALENDAR_TOKEN_ENCRYPTION_SECRET";
const calendarInternal = (internal as unknown as { calendar: Record<string, unknown> })
  .calendar as any;
type CalendarOwnerRole = "instructor" | "studio";

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
  roleView: CalendarOwnerRole;
  studioName: string;
  instructorName?: string;
  sport: string;
  startTime: number;
  endTime: number;
  timeZone?: string;
  status: "open" | "filled" | "cancelled" | "completed";
};

type GoogleCalendarEvent = {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  extendedProperties?: {
    private?: Record<string, string | undefined>;
  };
};

type ImportedGoogleCalendarEvent = {
  providerEventId: string;
  title: string;
  status: "confirmed" | "tentative" | "cancelled";
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  location?: string;
  htmlLink?: string;
  timeZone?: string;
  providerUpdatedAt?: number;
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

function getCalendarTokenEncryptionSecret(): string | undefined {
  const secret = process.env[CALENDAR_TOKEN_ENCRYPTION_SECRET_ENV]?.trim();
  return secret ? secret : undefined;
}

function deriveCalendarTokenKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function isEncryptedCalendarToken(value: string | undefined): boolean {
  return Boolean(value?.startsWith(CALENDAR_TOKEN_ENCRYPTION_PREFIX));
}

export function encryptCalendarToken(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  if (isEncryptedCalendarToken(value)) {
    return value;
  }
  const secret = getCalendarTokenEncryptionSecret();
  if (!secret) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveCalendarTokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
  return `${CALENDAR_TOKEN_ENCRYPTION_PREFIX}${payload}`;
}

function encryptRequiredCalendarToken(value: string): string {
  return encryptCalendarToken(value) ?? value;
}

export function decryptCalendarToken(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  if (!isEncryptedCalendarToken(value)) {
    return value;
  }

  const secret = getCalendarTokenEncryptionSecret();
  if (!secret) {
    throw new ConvexError(
      "Calendar token encryption secret is required to decrypt stored calendar credentials",
    );
  }

  const encoded = value.slice(CALENDAR_TOKEN_ENCRYPTION_PREFIX.length);
  const raw = Buffer.from(encoded, "base64url");
  if (raw.length <= 28) {
    throw new ConvexError("Stored calendar token ciphertext is invalid");
  }

  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveCalendarTokenKey(secret), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new ConvexError("Stored calendar token could not be decrypted");
  }
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
  const descriptionLines = [
    row.roleView === "studio" ? "Queue posted job" : "Queue accepted job",
    `Studio: ${row.studioName}`,
    ...(row.instructorName ? [`Instructor: ${row.instructorName}`] : []),
  ];

  return {
    summary: `${row.sport} lesson`,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: new Date(row.startTime).toISOString(),
      ...(row.timeZone ? { timeZone: row.timeZone } : {}),
    },
    end: {
      dateTime: new Date(row.endTime).toISOString(),
      ...(row.timeZone ? { timeZone: row.timeZone } : {}),
    },
    extendedProperties: {
      private: {
        [GOOGLE_EVENT_SOURCE_KEY]: GOOGLE_EVENT_SOURCE_VALUE,
        [GOOGLE_EVENT_EXTERNAL_ID_KEY]: row.lessonId,
      },
    },
  };
}

function parseGoogleEventTimestamp(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function normalizeImportedGoogleEvent(
  event: GoogleCalendarEvent,
): ImportedGoogleCalendarEvent | null {
  const providerEventId = event.id?.trim();
  if (!providerEventId) {
    return null;
  }

  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startTime = parseGoogleEventTimestamp(event.start?.dateTime ?? event.start?.date);
  const endTime = parseGoogleEventTimestamp(event.end?.dateTime ?? event.end?.date);
  if (startTime === undefined || endTime === undefined || endTime <= startTime) {
    return null;
  }

  const status =
    event.status === "cancelled"
      ? "cancelled"
      : event.status === "tentative"
        ? "tentative"
        : "confirmed";
  const title = event.summary?.trim() || "Google Calendar event";
  const providerUpdatedAt = parseGoogleEventTimestamp(event.updated);

  return {
    providerEventId,
    title,
    status,
    startTime,
    endTime,
    isAllDay,
    ...omitUndefined({
      location: event.location?.trim() || undefined,
      htmlLink: event.htmlLink?.trim() || undefined,
      timeZone: event.start?.timeZone ?? event.end?.timeZone,
      providerUpdatedAt,
    }),
  };
}

export function isQueueManagedGoogleEvent(
  event: GoogleCalendarEvent,
  mappedProviderEventIds: ReadonlySet<string>,
) {
  const providerEventId = event.id?.trim();
  if (providerEventId && mappedProviderEventIds.has(providerEventId)) {
    return true;
  }

  return (
    event.extendedProperties?.private?.[GOOGLE_EVENT_SOURCE_KEY] === GOOGLE_EVENT_SOURCE_VALUE
  );
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

async function listGoogleAgendaChanges(args: {
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

async function getGoogleAccessToken(
  ctx: any,
  integration: GoogleIntegrationRecord,
  now: number,
) {
  let accessToken = integration.accessToken ?? "";
  let accessTokenExpiresAt = integration.accessTokenExpiresAt ?? 0;
  if (!accessToken || accessTokenExpiresAt < now + 60_000) {
    if (!integration.refreshToken || !integration.oauthClientId) {
      throw new ConvexError("Google Calendar integration is missing refresh credentials");
    }
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
    .filter((row) => row.status !== "cancelled" && row.endTime >= args.now - 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.startTime - b.startTime);

  const existingMappings = (await args.ctx.runQuery(calendarInternal.getEventMappingsForIntegration, {
    integrationId: args.integrationId,
  })) as Array<{ externalEventId: string; providerEventId: string }>;
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
    await deleteGoogleEvent({ accessToken: args.accessToken, providerEventId: mapping.providerEventId });
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
    ...(args.integration.agendaSyncToken
      ? { syncToken: args.integration.agendaSyncToken }
      : {}),
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
    throw error;
  }
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
    if (!user || !user.isActive || (user.role !== "instructor" && user.role !== "studio")) {
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
      status: v.union(
        v.literal("confirmed"),
        v.literal("tentative"),
        v.literal("cancelled"),
      ),
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
    if (!user || !user.isActive || (user.role !== "instructor" && user.role !== "studio")) {
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
      role: profile.role,
      ...(profile.instructorId ? { instructorId: profile.instructorId } : {}),
      ...(profile.studioId ? { studioId: profile.studioId } : {}),
      accountEmail,
      oauthClientId: args.clientId,
      accessToken,
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
    const currentUser = await ctx.runQuery(api.users.getCurrentUser as any, {});
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

export const disconnectGoogleCalendar = action({
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
    const instructorProfile = (await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique()) as
      | {
          _id: Id<"instructorProfiles">;
          calendarProvider?: "none" | "google" | "apple";
          calendarSyncEnabled?: boolean;
          calendarConnectedAt?: number;
        }
      | null;
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

    const studioProfile = (await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique()) as
      | {
          _id: Id<"studioProfiles">;
          calendarProvider?: "none" | "google" | "apple";
          calendarSyncEnabled?: boolean;
          calendarConnectedAt?: number;
        }
      | null;
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

    const instructorProfile = (await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique()) as { _id: Id<"instructorProfiles">; displayName: string } | null;
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

    const studioProfile = (await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique()) as { _id: Id<"studioProfiles">; studioName: string } | null;
    if (!studioProfile) {
      return [];
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_startTime", (q) =>
        q.eq("studioId", studioProfile._id).gte("startTime", args.startTime).lte("startTime", args.endTime),
      )
      .order("asc")
      .take(limit);

    const instructorIds = [
      ...new Set(
        jobs
          .map((job) => job.filledByInstructorId)
          .filter((id): id is Id<"instructorProfiles"> => Boolean(id)),
      ),
    ];
    const instructors = await Promise.all(instructorIds.map((instructorId) => ctx.db.get(instructorId)));
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
      integration.role ??
      (integration.studioId ? ("studio" as const) : ("instructor" as const));
    return {
      _id: integration._id,
      role: inferredRole,
      status: integration.status,
      ...omitUndefined({
        instructorId: integration.instructorId,
        studioId: integration.studioId,
        accessToken: decryptCalendarToken(integration.accessToken),
        refreshToken: decryptCalendarToken(integration.refreshToken),
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
      accessToken: encryptRequiredCalendarToken(args.accessToken),
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scopes: args.scopes,
      agendaSyncToken: undefined,
      ...omitUndefined({
        accountEmail: args.accountEmail,
        instructorId: args.instructorId,
        studioId: args.studioId,
        refreshToken: encryptCalendarToken(args.refreshToken),
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
          refreshToken: encryptCalendarToken(args.refreshToken),
        }),
        oauthClientId: args.oauthClientId,
        accessToken: encryptRequiredCalendarToken(args.accessToken),
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
      accessToken: encryptRequiredCalendarToken(args.accessToken),
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
        status: v.union(
          v.literal("confirmed"),
          v.literal("tentative"),
          v.literal("cancelled"),
        ),
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
    const profile = (await ctx.runQuery(calendarInternal.getCalendarProfileForUser, {
      userId: args.userId,
    })) as CalendarOwnerProfile | null;
    if (!profile) {
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

    if (profile.role === "instructor") {
      if (!profile.instructorId) {
        throw new ConvexError("Instructor profile not found");
      }
      await ctx.db.patch(profile.instructorId, {
        calendarProvider: "none",
        calendarSyncEnabled: false,
        updatedAt: Date.now(),
      });
    } else {
      if (!profile.studioId) {
        throw new ConvexError("Studio profile not found");
      }
      await ctx.db.patch(profile.studioId, {
        calendarProvider: "none",
        calendarSyncEnabled: false,
        updatedAt: Date.now(),
      });
    }

    return { ok: true };
  },
});
