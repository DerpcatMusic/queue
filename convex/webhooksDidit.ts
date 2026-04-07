import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { omitUndefined } from "./lib/validation";

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

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
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
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
};

const buildFingerprint = async (req: Request): Promise<string> => {
  const source = [
    "didit",
    extractClientIp(req),
    normalizeText(getHeader(req, "user-agent"), 200),
    normalizeText(getHeader(req, "x-forwarded-proto"), 20),
  ].join("|");
  return sha256Hex(source);
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

const normalizeDiditSignature = (value: string | null): string =>
  (value ?? "")
    .replace(/^sha256=/i, "")
    .replace(/^v\d+=/i, "")
    .trim()
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

  if (!expectedSecret) {
    return new Response(
      JSON.stringify({
        received: true,
        signatureValid: false,
        error: "DIDIT_WEBHOOK_SECRET is not configured - webhook security disabled",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

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
  if (timestampValid) {
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

  const fingerprint = await buildFingerprint(req);
  const throttleState = await ctx.runMutation(
    internal.webhookSecurity.checkInvalidSignatureThrottle,
    { provider: "didit", fingerprint },
  );

  if (!signatureValid) {
    const throttleUpdate = await ctx.runMutation(
      internal.webhookSecurity.recordInvalidSignatureAttempt,
      { provider: "didit", fingerprint },
    );
    if (throttleState.blocked || throttleUpdate.blocked) {
      return new Response(
        JSON.stringify({ received: true, signatureValid, timestampValid, throttled: true }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  await ctx.runMutation(internal.didit.processDiditWebhookEvent, {
    providerEventId,
    signatureValid,
    payloadHash,
    payload: buildCanonicalDiditPayload(parsedPayload),
    ...omitUndefined({
      sessionId,
      statusRaw,
      vendorData,
      decision: payload.decision ?? payload.data?.decision,
    }),
  });

  return new Response(
    JSON.stringify({ received: true, signatureValid, timestampValid }),
    {
      status: signatureValid ? 200 : 401,
      headers: { "Content-Type": "application/json" },
    },
  );
});
