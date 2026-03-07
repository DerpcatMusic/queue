import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  httpAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { omitUndefined } from "./lib/validation";
import { ConvexError, v } from "convex/values";

type IntegrationRoute = "payment" | "payout" | "beneficiary" | "kyc";

const integrationProviderValidator = v.union(v.literal("rapyd"), v.literal("didit"));
const integrationRouteValidator = v.union(
  v.literal("payment"),
  v.literal("payout"),
  v.literal("beneficiary"),
  v.literal("kyc"),
);
const INTEGRATION_EVENTS_ACCESS_TOKEN_ENV = "INTEGRATION_EVENTS_ACCESS_TOKEN";

export function isValidIntegrationEventsAccessToken(accessToken: string | undefined): boolean {
  const expected = process.env[INTEGRATION_EVENTS_ACCESS_TOKEN_ENV]?.trim();
  return Boolean(expected) && accessToken?.trim() === expected;
}

function requireIntegrationEventsAccessToken(accessToken: string | undefined) {
  if (!isValidIntegrationEventsAccessToken(accessToken)) {
    throw new ConvexError(
      "Unauthorized integration-events operation. Set INTEGRATION_EVENTS_ACCESS_TOKEN and pass accessToken.",
    );
  }
}

async function loadFailedIntegrationEvents(
  ctx: QueryCtx | MutationCtx,
  args: {
    provider?: "rapyd" | "didit";
    route?: IntegrationRoute;
    limit: number;
    order: "asc" | "desc";
  },
) {
  const rows: any[] = [];
  let cursor: string | null = null;

  while (rows.length < args.limit) {
    const page: {
      page: any[];
      isDone: boolean;
      continueCursor: string;
    } = args.provider
      ? await ctx.db
          .query("integrationEvents")
          .withIndex("by_processing_provider_route_createdAt", (q) =>
            q.eq("processingState", "failed").eq("provider", args.provider as "rapyd" | "didit"),
          )
          .order(args.order)
          .paginate({ cursor, numItems: Math.max(args.limit * 2, 100) })
      : await ctx.db
          .query("integrationEvents")
          .withIndex("by_processing_createdAt", (q) => q.eq("processingState", "failed"))
          .order(args.order)
          .paginate({ cursor, numItems: Math.max(args.limit * 2, 100) });

    for (const row of page.page) {
      if (args.route && row.route !== args.route) {
        continue;
      }
      rows.push(row);
      if (rows.length >= args.limit) {
        break;
      }
    }

    if (page.isDone) {
      break;
    }
    cursor = page.continueCursor;
  }

  return rows;
}

const getHeader = (req: Request, key: string): string | null =>
  req.headers.get(key) ?? req.headers.get(key.toLowerCase()) ?? null;

const normalizeText = (value: string | null | undefined, maxLength = 160): string => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const extractClientIp = (req: Request): string => {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    getHeader(req, "cf-connecting-ip") ??
    getHeader(req, "x-real-ip") ??
    getHeader(req, "x-client-ip") ??
    "unknown"
  )
    .trim()
    .slice(0, 80);
};

const buildFingerprint = async (provider: "rapyd" | "didit", req: Request): Promise<string> => {
  const source = [
    provider,
    extractClientIp(req),
    normalizeText(getHeader(req, "user-agent"), 200),
    normalizeText(getHeader(req, "x-forwarded-proto"), 20),
  ].join("|");
  return sha256Hex(source);
};

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const hmacSha256Hex = async (key: string, message: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const sortKeysRecursively = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedEntries = Object.keys(record)
      .sort()
      .map((key) => [key, sortKeysRecursively(record[key])] as const);
    return Object.fromEntries(sortedEntries);
  }
  return value;
};

const shortenFloatsRecursively = (value: unknown): unknown => {
  if (typeof value === "number" && !Number.isInteger(value)) {
    return Number(value.toFixed(3));
  }
  if (Array.isArray(value)) {
    return value.map(shortenFloatsRecursively);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, inner]) => [key, shortenFloatsRecursively(inner)]),
    );
  }
  return value;
};

const buildRapydSignature = async ({
  method,
  path,
  salt,
  timestamp,
  accessKey,
  secretKey,
  body,
  encoding,
}: {
  method: string;
  path: string;
  salt: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
  body: string;
  encoding: "hex_base64" | "raw_base64";
}): Promise<string> => {
  const toSign = `${method.toLowerCase()}${path}${salt}${timestamp}${accessKey}${secretKey}${body}`;
  if (encoding === "hex_base64") {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(toSign));
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return btoa(hex);
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(toSign));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const normalizeConfiguredWebhookCandidates = (req: Request): string[] => {
  const requestUrl = new URL(req.url);
  const configured = (
    process.env.RAPYD_WEBHOOK_URL ??
    new URL("/webhooks/rapyd", process.env.SITE_URL ?? requestUrl.origin).toString()
  ).trim();

  const candidates = new Set<string>([
    requestUrl.pathname,
    `${requestUrl.pathname}${requestUrl.search}`,
  ]);

  try {
    const parsed = new URL(configured);
    candidates.add(parsed.toString());
    candidates.add(parsed.pathname);
    candidates.add(`${parsed.pathname}${parsed.search}`);
  } catch {
    if (configured) {
      candidates.add(configured);
    }
  }

  return Array.from(candidates).filter((value) => value.length > 0);
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildCanonicalRapydPayload = (payload: unknown): Record<string, unknown> => {
  const root = toRecord(payload) ?? {};
  const data = toRecord(root.data);
  const payment = toRecord(data?.payment);
  const payout = toRecord(data?.payout);
  const checkout = toRecord(data?.checkout);
  const metadata = toRecord(data?.metadata);

  return omitUndefined({
    id: toTrimmedString(root.id),
    type: toTrimmedString(root.type) ?? toTrimmedString(root.event),
    data: data
      ? omitUndefined({
          id: toTrimmedString(data.id),
          status: toTrimmedString(data.status),
          merchant_reference_id: toTrimmedString(data.merchant_reference_id),
          payout_method_type: toTrimmedString(data.payout_method_type),
          default_payout_method_type: toTrimmedString(data.default_payout_method_type),
          payment: payment
            ? omitUndefined({
                id: toTrimmedString(payment.id),
                status: toTrimmedString(payment.status),
              })
            : undefined,
          payout: payout
            ? omitUndefined({
                id: toTrimmedString(payout.id),
                status: toTrimmedString(payout.status),
              })
            : undefined,
          checkout: checkout
            ? omitUndefined({
                id: toTrimmedString(checkout.id),
              })
            : undefined,
          metadata: metadata
            ? omitUndefined({
                payoutId: toTrimmedString(metadata.payoutId),
                paymentId: toTrimmedString(metadata.paymentId),
                merchant_reference_id: toTrimmedString(metadata.merchant_reference_id),
              })
            : undefined,
        })
      : undefined,
  });
};

const buildCanonicalDiditPayload = (payload: unknown): Record<string, unknown> => {
  const root = toRecord(payload) ?? {};
  const data = toRecord(root.data);
  return omitUndefined({
    id: toTrimmedString(root.id),
    event_id: toTrimmedString(root.event_id),
    session_id: toTrimmedString(root.session_id) ?? toTrimmedString(root.sessionId),
    status: toTrimmedString(root.status),
    vendor_data: toTrimmedString(root.vendor_data) ?? toTrimmedString(root.vendorData),
    webhook_type: toTrimmedString(root.webhook_type),
    timestamp:
      typeof root.timestamp === "string" || typeof root.timestamp === "number"
        ? String(root.timestamp)
        : undefined,
    data: data
      ? omitUndefined({
          session_id: toTrimmedString(data.session_id),
          status: toTrimmedString(data.status),
          vendor_data: toTrimmedString(data.vendor_data),
          webhook_type: toTrimmedString(data.webhook_type),
          timestamp:
            typeof data.timestamp === "string" || typeof data.timestamp === "number"
              ? String(data.timestamp)
              : undefined,
        })
      : undefined,
  });
};

const toOutcomeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeIntegrationProcessorOutcome = (value: unknown) => {
  const record = toRecord(value) ?? {};
  const reason = toOutcomeString(record.reason);
  const ignored = record.ignored === true;
  const processed = record.processed === true;
  const sourceEventId = toOutcomeString(record.eventId);
  const entityId =
    toOutcomeString(record.paymentId) ??
    toOutcomeString(record.payoutId) ??
    toOutcomeString(record.onboardingId) ??
    toOutcomeString(record.instructorId);

  return {
    success: processed || (ignored && reason === "duplicate_event"),
    reason,
    sourceEventId,
    entityId,
  };
};

export const ingestIntegrationEvent = internalMutation({
  args: {
    provider: integrationProviderValidator,
    route: integrationRouteValidator,
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.any(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationEvents")
      .withIndex("by_provider_eventId", (q) =>
        q.eq("provider", args.provider).eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existing) {
      return {
        duplicate: true,
        queued: false,
        integrationEventId: existing._id,
      };
    }

    const now = Date.now();
    const integrationEventId = await ctx.db.insert("integrationEvents", {
      provider: args.provider,
      route: args.route,
      providerEventId: args.providerEventId,
      signatureValid: args.signatureValid,
      payloadHash: args.payloadHash,
      payload: args.payload,
      processingState: "pending",
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        eventType: args.eventType,
        metadata: args.metadata,
      }),
    });

    await ctx.scheduler.runAfter(0, internal.webhooks.processIntegrationEvent, {
      integrationEventId,
    });

    return {
      duplicate: false,
      queued: true,
      integrationEventId,
    };
  },
});

export const processIntegrationEvent = internalMutation({
  args: {
    integrationEventId: v.id("integrationEvents"),
  },
  handler: async (ctx, args) => {
    const integrationEvent = await ctx.db.get(args.integrationEventId);
    if (!integrationEvent) {
      return { ignored: true, reason: "integration_event_not_found" as const };
    }
    if (integrationEvent.processingState !== "pending") {
      return {
        ignored: true,
        reason: "integration_event_already_processed" as const,
        processingState: integrationEvent.processingState,
      };
    }

    const metadata = toRecord(integrationEvent.metadata) ?? {};

    try {
      let outcome: unknown;
      if (integrationEvent.provider === "rapyd" && integrationEvent.route === "beneficiary") {
        outcome = await ctx.runMutation(internal.payments.processRapydBeneficiaryWebhookEvent, {
          providerEventId: integrationEvent.providerEventId,
          signatureValid: integrationEvent.signatureValid,
          payloadHash: integrationEvent.payloadHash,
          payload: integrationEvent.payload,
          ...omitUndefined({
            eventType: integrationEvent.eventType,
            merchantReferenceId: toOutcomeString(metadata.merchantReferenceId),
            beneficiaryId: toOutcomeString(metadata.beneficiaryId),
            payoutMethodType: toOutcomeString(metadata.payoutMethodType),
            statusRaw: toOutcomeString(metadata.statusRaw),
          }),
        });
      } else if (integrationEvent.provider === "rapyd" && integrationEvent.route === "payout") {
        outcome = await ctx.runMutation(internal.payouts.processRapydPayoutWebhookEvent, {
          providerEventId: integrationEvent.providerEventId,
          signatureValid: integrationEvent.signatureValid,
          payloadHash: integrationEvent.payloadHash,
          payload: integrationEvent.payload,
          ...omitUndefined({
            eventType: integrationEvent.eventType,
            providerPayoutId: toOutcomeString(metadata.providerPayoutId),
            payoutId: toOutcomeString(metadata.payoutId) as Id<"payouts"> | undefined,
            statusRaw: toOutcomeString(metadata.statusRaw),
          }),
        });
      } else if (integrationEvent.provider === "rapyd" && integrationEvent.route === "payment") {
        outcome = await ctx.runMutation(internal.payments.processRapydWebhookEvent, {
          providerEventId: integrationEvent.providerEventId,
          signatureValid: integrationEvent.signatureValid,
          payloadHash: integrationEvent.payloadHash,
          payload: integrationEvent.payload,
          ...omitUndefined({
            eventType: integrationEvent.eventType,
            providerPaymentId: toOutcomeString(metadata.providerPaymentId),
            providerCheckoutId: toOutcomeString(metadata.providerCheckoutId),
            merchantReferenceId: toOutcomeString(metadata.merchantReferenceId),
            statusRaw: toOutcomeString(metadata.statusRaw),
          }),
        });
      } else if (integrationEvent.provider === "didit" && integrationEvent.route === "kyc") {
        outcome = await ctx.runMutation(internal.didit.processDiditWebhookEvent, {
          providerEventId: integrationEvent.providerEventId,
          signatureValid: integrationEvent.signatureValid,
          payloadHash: integrationEvent.payloadHash,
          payload: integrationEvent.payload,
          ...omitUndefined({
            sessionId: toOutcomeString(metadata.sessionId),
            statusRaw: toOutcomeString(metadata.statusRaw),
            vendorData: toOutcomeString(metadata.vendorData),
            decision: metadata.decision,
          }),
        });
      } else {
        await ctx.db.patch(args.integrationEventId, {
          processingState: "failed",
          processingError: "unsupported_integration_route",
          updatedAt: Date.now(),
        });
        return { ignored: true, reason: "unsupported_integration_route" as const };
      }

      const normalized = normalizeIntegrationProcessorOutcome(outcome);
      await ctx.db.patch(args.integrationEventId, {
        processingState: normalized.success ? "processed" : "failed",
        processedAt: Date.now(),
        updatedAt: Date.now(),
        ...omitUndefined({
          processingError: normalized.success ? undefined : normalized.reason,
          sourceEventId: normalized.sourceEventId,
          entityId: normalized.entityId,
        }),
      });

      return {
        ignored: false,
        processed: normalized.success,
        ...omitUndefined({
          reason: normalized.reason,
          sourceEventId: normalized.sourceEventId,
          entityId: normalized.entityId,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "integration_event_processing_failed";
      await ctx.db.patch(args.integrationEventId, {
        processingState: "failed",
        processingError: message,
        updatedAt: Date.now(),
      });
      throw error;
    }
  },
});

<<<<<<< HEAD
export const listFailedIntegrationEvents = query({
  args: {
    accessToken: v.optional(v.string()),
    provider: v.optional(integrationProviderValidator),
    route: v.optional(integrationRouteValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireIntegrationEventsAccessToken(args.accessToken);

    const rawLimit = Math.floor(args.limit ?? 50);
    const limit = Math.min(Math.max(rawLimit, 1), 200);
    const rows = await loadFailedIntegrationEvents(ctx, {
      limit,
      order: "desc",
      ...omitUndefined({
        provider: args.provider,
        route: args.route,
      }),
    });

    return rows.map((row) => ({
        _id: row._id,
        provider: row.provider,
        route: row.route,
        providerEventId: row.providerEventId,
        eventType: row.eventType,
        signatureValid: row.signatureValid,
        processingError: row.processingError,
        sourceEventId: row.sourceEventId,
        entityId: row.entityId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        processedAt: row.processedAt,
      }));
  },
});

export const replayIntegrationEvent = mutation({
  args: {
    integrationEventId: v.id("integrationEvents"),
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireIntegrationEventsAccessToken(args.accessToken);

    const row = await ctx.db.get(args.integrationEventId);
    if (!row) {
      throw new ConvexError("Integration event not found");
    }

    await ctx.db.patch(args.integrationEventId, {
      processingState: "pending",
      processingError: undefined,
      processedAt: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.processIntegrationEvent, {
      integrationEventId: args.integrationEventId,
    });

    return {
      integrationEventId: args.integrationEventId,
      replayed: true,
      provider: row.provider,
      route: row.route,
      providerEventId: row.providerEventId,
    };
  },
});

export const replayFailedIntegrationEvents = mutation({
  args: {
    accessToken: v.optional(v.string()),
    provider: v.optional(integrationProviderValidator),
    route: v.optional(integrationRouteValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireIntegrationEventsAccessToken(args.accessToken);

    const rawLimit = Math.floor(args.limit ?? 25);
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const targetRows = await loadFailedIntegrationEvents(ctx, {
      limit,
      order: "asc",
      ...omitUndefined({
        provider: args.provider,
        route: args.route,
      }),
    });

    for (const row of targetRows) {
      await ctx.db.patch(row._id, {
        processingState: "pending",
        processingError: undefined,
        processedAt: undefined,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.webhooks.processIntegrationEvent, {
        integrationEventId: row._id,
      });
    }

    return {
      replayedCount: targetRows.length,
      integrationEventIds: targetRows.map((row) => row._id),
    };
  },
});

=======
>>>>>>> feat/integration-events
export const rapydWebhook = httpAction(async (ctx, req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const accessKeyHeader = getHeader(req, "access_key") ?? "";
  const salt = getHeader(req, "salt") ?? "";
  const timestamp = getHeader(req, "timestamp") ?? "";
  const signature = getHeader(req, "signature") ?? "";
  const bodyText = await req.text();

  const payloadHash = await sha256Hex(bodyText);
  const timestampSeconds = Number.parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const allowedSkewSeconds = Number.parseInt(
    (process.env.RAPYD_WEBHOOK_MAX_SKEW_SECONDS ?? "300").trim(),
    10,
  );
  const maxSkewSeconds =
    Number.isFinite(allowedSkewSeconds) && allowedSkewSeconds > 0 ? allowedSkewSeconds : 300;
  const timestampValid =
    Number.isFinite(timestampSeconds) && Math.abs(nowSeconds - timestampSeconds) <= maxSkewSeconds;

  let parsedPayload: unknown = null;
  try {
    parsedPayload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    parsedPayload = { raw: bodyText };
  }

  const payload = parsedPayload as {
    id?: string;
    type?: string;
    event?: string;
    data?: {
      id?: string;
      status?: string;
      payout_method_type?: string;
      default_payout_method_type?: string;
      payout?: { id?: string; status?: string };
      payment?: { id?: string; status?: string };
      checkout?: { id?: string };
      merchant_reference_id?: string;
      metadata?: { payoutId?: string; paymentId?: string; merchant_reference_id?: string };
    };
  };
  const eventType =
    payload.type?.toString().trim() || payload.event?.toString().trim() || undefined;
  const isPayoutEvent = eventType?.toLowerCase().includes("payout") ?? false;
  const isBeneficiaryEvent = eventType?.toLowerCase().includes("beneficiary") ?? false;

  const providerEventId = payload.id?.toString().trim() || `hash:${payloadHash}`;
  if (!providerEventId) {
    return new Response(JSON.stringify({ received: false, error: "missing_event_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const providerPayoutId =
    payload.data?.payout?.id?.toString().trim() ||
    (isPayoutEvent ? payload.data?.id?.toString().trim() : undefined) ||
    undefined;
  const providerPaymentId =
    payload.data?.payment?.id?.toString().trim() ||
    (isPayoutEvent ? undefined : payload.data?.id?.toString().trim()) ||
    undefined;
  const providerCheckoutId = payload.data?.checkout?.id?.toString().trim() || undefined;
  const payoutRefFromPayload = isPayoutEvent
    ? payload.data?.merchant_reference_id?.toString().trim() ||
      payload.data?.metadata?.payoutId?.toString().trim() ||
      undefined
    : undefined;
  const statusRaw =
    payload.data?.payout?.status?.toString().trim() ||
    payload.data?.payment?.status?.toString().trim() ||
    payload.data?.status?.toString().trim() ||
    undefined;
  const providerBeneficiaryId = isBeneficiaryEvent
    ? payload.data?.id?.toString().trim() || undefined
    : undefined;
  const merchantReferenceIdFromPayload = isBeneficiaryEvent
    ? payload.data?.merchant_reference_id?.toString().trim() ||
      payload.data?.metadata?.merchant_reference_id?.toString().trim() ||
      undefined
    : undefined;
  const paymentReferenceIdFromPayload = !isPayoutEvent && !isBeneficiaryEvent
    ? payload.data?.merchant_reference_id?.toString().trim() ||
      payload.data?.metadata?.paymentId?.toString().trim() ||
      undefined
    : undefined;
  const payoutMethodType = isBeneficiaryEvent
    ? payload.data?.payout_method_type?.toString().trim() ||
      payload.data?.default_payout_method_type?.toString().trim() ||
      undefined
    : undefined;
  const fingerprint = await buildFingerprint("rapyd", req);
  const throttleState = await ctx.runMutation(
    internal.webhookSecurity.checkInvalidSignatureThrottle,
    {
      provider: "rapyd",
      fingerprint,
    },
  );
  const canonicalPayload = buildCanonicalRapydPayload(parsedPayload);

  const expectedAccessKey = (process.env.RAPYD_ACCESS_KEY ?? "").trim();
  const webhookSecret = (
    process.env.RAPYD_WEBHOOK_SECRET ??
    process.env.RAPYD_SECRET_KEY ??
    ""
  ).trim();

  let signatureValid = false;
  if (
    webhookSecret &&
    expectedAccessKey &&
    accessKeyHeader &&
    salt &&
    timestamp &&
    signature &&
    timestampValid
  ) {
    const pathCandidates = normalizeConfiguredWebhookCandidates(req);
    for (const pathCandidate of pathCandidates) {
      const expectedHex = await buildRapydSignature({
        method: req.method,
        path: pathCandidate,
        salt,
        timestamp,
        accessKey: expectedAccessKey,
        secretKey: webhookSecret,
        body: bodyText,
        encoding: "hex_base64",
      });
      const expectedRaw = await buildRapydSignature({
        method: req.method,
        path: pathCandidate,
        salt,
        timestamp,
        accessKey: expectedAccessKey,
        secretKey: webhookSecret,
        body: bodyText,
        encoding: "raw_base64",
      });
      signatureValid =
        accessKeyHeader === expectedAccessKey &&
        (safeEqual(expectedHex, signature) || safeEqual(expectedRaw, signature));
      if (signatureValid) {
        break;
      }
    }
  }

  if (!signatureValid) {
    const throttleUpdate = await ctx.runMutation(
      internal.webhookSecurity.recordInvalidSignatureAttempt,
      {
        provider: "rapyd",
        fingerprint,
      },
    );
    if (throttleState.blocked || throttleUpdate.blocked) {
      return new Response(
        JSON.stringify({ received: true, signatureValid, timestampValid, throttled: true }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  const route: IntegrationRoute =
    isBeneficiaryEvent || merchantReferenceIdFromPayload || providerBeneficiaryId
      ? "beneficiary"
      : isPayoutEvent || providerPayoutId
        ? "payout"
        : "payment";

  await ctx.runMutation(internal.webhooks.ingestIntegrationEvent, {
    provider: "rapyd",
    route,
    providerEventId,
    signatureValid,
    payloadHash,
    payload: canonicalPayload,
    ...omitUndefined({
      eventType,
      metadata:
        route === "beneficiary"
          ? omitUndefined({
              merchantReferenceId: merchantReferenceIdFromPayload,
              beneficiaryId: providerBeneficiaryId,
              payoutMethodType,
              statusRaw,
            })
          : route === "payout"
            ? omitUndefined({
                providerPayoutId,
                payoutId: payoutRefFromPayload,
                statusRaw,
              })
            : omitUndefined({
                providerPaymentId,
                providerCheckoutId,
                merchantReferenceId: paymentReferenceIdFromPayload,
                statusRaw,
              }),
    }),
  });

  return new Response(JSON.stringify({ received: true, signatureValid, timestampValid }), {
    status: signatureValid ? 200 : 401,
    headers: { "Content-Type": "application/json" },
  });
});

const normalizeDiditSignature = (value: string | null): string =>
  (value ?? "")
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();

export const diditWebhook = httpAction(async (ctx, req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const bodyText = await req.text();
  const payloadHash = await sha256Hex(bodyText);
  const signatureV2Header = normalizeDiditSignature(getHeader(req, "x-signature-v2"));
  const signatureSimpleHeader = normalizeDiditSignature(getHeader(req, "x-signature-simple"));
  const signatureRawHeader = normalizeDiditSignature(getHeader(req, "x-signature"));
  const timestampHeader = getHeader(req, "x-timestamp");
  const expectedSecret = (process.env.DIDIT_WEBHOOK_SECRET ?? "").trim();
  const allowedSkewSeconds = Number.parseInt(
    (process.env.DIDIT_WEBHOOK_MAX_SKEW_SECONDS ?? "300").trim(),
    10,
  );
  const maxSkewSeconds =
    Number.isFinite(allowedSkewSeconds) && allowedSkewSeconds > 0 ? allowedSkewSeconds : 300;

  let parsedPayload: unknown = null;
  try {
    parsedPayload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    parsedPayload = { raw: bodyText };
  }

  const payload = parsedPayload as {
    id?: string;
    event_id?: string;
    session_id?: string;
    sessionId?: string;
    status?: string;
    vendor_data?: string;
    vendorData?: string;
    webhook_type?: string;
    timestamp?: number | string;
    data?: {
      session_id?: string;
      status?: string;
      vendor_data?: string;
      webhook_type?: string;
      timestamp?: number | string;
      decision?: unknown;
    };
    decision?: unknown;
  };

  const bodyTimestamp = String(payload.timestamp ?? payload.data?.timestamp ?? "");
  const timestampRaw = timestampHeader ?? bodyTimestamp;
  const timestampSeconds = Number.parseInt(timestampRaw, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestampValid =
    Number.isFinite(timestampSeconds) && Math.abs(nowSeconds - timestampSeconds) <= maxSkewSeconds;

  let signatureValid = false;
  if (expectedSecret && timestampValid) {
    if (signatureV2Header && timestampHeader) {
      const canonicalJson = JSON.stringify(
        sortKeysRecursively(shortenFloatsRecursively(parsedPayload ?? {})),
      );
      const expectedV2 = await hmacSha256Hex(expectedSecret, `${canonicalJson}:${timestampHeader}`);
      if (safeEqual(expectedV2, signatureV2Header)) {
        signatureValid = true;
      }
    }

    if (!signatureValid && signatureSimpleHeader) {
      const canonicalSimple = [
        bodyTimestamp,
        String(payload.session_id ?? payload.data?.session_id ?? ""),
        String(payload.status ?? payload.data?.status ?? ""),
        String(payload.webhook_type ?? payload.data?.webhook_type ?? ""),
      ].join(":");
      const expectedSimple = await hmacSha256Hex(expectedSecret, canonicalSimple);
      if (safeEqual(expectedSimple, signatureSimpleHeader)) {
        signatureValid = true;
      }
    }

    if (!signatureValid && signatureRawHeader) {
      const expectedRaw = await hmacSha256Hex(expectedSecret, bodyText);
      if (safeEqual(expectedRaw, signatureRawHeader)) {
        signatureValid = true;
      }
    }
  }

  const providerEventId =
    payload.event_id?.toString().trim() || payload.id?.toString().trim() || `hash:${payloadHash}`;
  const sessionId =
    payload.session_id?.toString().trim() ||
    payload.sessionId?.toString().trim() ||
    payload.data?.session_id?.toString().trim() ||
    undefined;
  const statusRaw =
    payload.status?.toString().trim() || payload.data?.status?.toString().trim() || undefined;
  const vendorData =
    payload.vendor_data?.toString().trim() ||
    payload.vendorData?.toString().trim() ||
    payload.data?.vendor_data?.toString().trim() ||
    undefined;
  const fingerprint = await buildFingerprint("didit", req);
  const throttleState = await ctx.runMutation(
    internal.webhookSecurity.checkInvalidSignatureThrottle,
    {
      provider: "didit",
      fingerprint,
    },
  );
  const canonicalPayload = buildCanonicalDiditPayload(parsedPayload);

  if (!signatureValid) {
    const throttleUpdate = await ctx.runMutation(
      internal.webhookSecurity.recordInvalidSignatureAttempt,
      {
        provider: "didit",
        fingerprint,
      },
    );
    if (throttleState.blocked || throttleUpdate.blocked) {
      return new Response(
        JSON.stringify({
          received: true,
          signatureValid,
          timestampValid,
          throttled: true,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  await ctx.runMutation(internal.webhooks.ingestIntegrationEvent, {
    provider: "didit",
    route: "kyc",
    providerEventId,
    signatureValid,
    payloadHash,
    payload: canonicalPayload,
    metadata: omitUndefined({
      sessionId,
      statusRaw,
      vendorData,
      decision: payload.decision ?? payload.data?.decision,
    }),
  });

  return new Response(
    JSON.stringify({
      received: true,
      signatureValid,
      timestampValid,
    }),
    {
      status: signatureValid ? 200 : 401,
      headers: { "Content-Type": "application/json" },
    },
  );
});
