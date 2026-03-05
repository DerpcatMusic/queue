import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
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
      metadata?: { payoutId?: string; merchant_reference_id?: string };
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
      undefined ||
      payload.data?.metadata?.merchant_reference_id?.toString().trim() ||
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

  if (isBeneficiaryEvent || merchantReferenceIdFromPayload || providerBeneficiaryId) {
    await ctx.runMutation(internal.payments.processRapydBeneficiaryWebhookEvent, {
      providerEventId,
      signatureValid,
      payloadHash,
      payload: canonicalPayload,
      ...omitUndefined({
        eventType,
        merchantReferenceId: merchantReferenceIdFromPayload,
        beneficiaryId: providerBeneficiaryId,
        payoutMethodType,
      }),
    });
  } else if (isPayoutEvent || providerPayoutId) {
    await ctx.runMutation(internal.payouts.processRapydPayoutWebhookEvent, {
      providerEventId,
      signatureValid,
      payloadHash,
      payload: canonicalPayload,
      ...omitUndefined({
        eventType,
        providerPayoutId,
        payoutId: payoutRefFromPayload as Id<"payouts"> | undefined,
        statusRaw,
      }),
    });
  } else {
    await ctx.runMutation(internal.payments.processRapydWebhookEvent, {
      providerEventId,
      signatureValid,
      payloadHash,
      payload: canonicalPayload,
      ...omitUndefined({
        eventType,
        providerPaymentId,
        providerCheckoutId,
        statusRaw,
      }),
    });
  }

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

  await ctx.runMutation(internal.didit.processDiditWebhookEvent, {
    providerEventId,
    signatureValid,
    payloadHash,
    payload: canonicalPayload,
    ...omitUndefined({
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
