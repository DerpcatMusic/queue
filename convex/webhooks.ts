import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { omitUndefined } from "./lib/validation";

const getHeader = (req: Request, key: string): string | null =>
  req.headers.get(key) ?? req.headers.get(key.toLowerCase()) ?? null;

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const buildRapydSignature = async ({
  path,
  salt,
  timestamp,
  accessKey,
  secretKey,
  body,
}: {
  path: string;
  salt: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
  body: string;
}): Promise<string> => {
  const toSign = `${path}${salt}${timestamp}${accessKey}${secretKey}${body}`;
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
  const hexDigest = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return btoa(hexDigest);
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
  const timestampValid =
    Number.isFinite(timestampSeconds) &&
    Math.abs(nowSeconds - timestampSeconds) <= 60;

  let parsedPayload: unknown = null;
  try {
    parsedPayload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    parsedPayload = { raw: bodyText };
  }

  const payload = parsedPayload as {
    id?: string;
    type?: string;
    data?: {
      id?: string;
      status?: string;
      payout?: { id?: string; status?: string };
      payment?: { id?: string; status?: string };
      checkout?: { id?: string };
      merchant_reference_id?: string;
      metadata?: { payoutId?: string };
    };
  };
  const eventType = payload.type?.toString().trim() || undefined;
  const isPayoutEvent = eventType?.toLowerCase().includes("payout") ?? false;

  const providerEventId = payload.id?.toString().trim();
  if (!providerEventId) {
    return new Response(
      JSON.stringify({ received: false, error: "missing_event_id" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const providerPayoutId = (
    payload.data?.payout?.id?.toString().trim() ||
    (isPayoutEvent ? payload.data?.id?.toString().trim() : undefined)
  ) || undefined;
  const providerPaymentId =
    payload.data?.payment?.id?.toString().trim() ||
    (isPayoutEvent ? undefined : payload.data?.id?.toString().trim()) ||
    undefined;
  const providerCheckoutId =
    payload.data?.checkout?.id?.toString().trim() || undefined;
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

  const expectedAccessKey = (process.env.RAPYD_ACCESS_KEY ?? "").trim();
  const webhookSecret =
    (process.env.RAPYD_WEBHOOK_SECRET ?? process.env.RAPYD_SECRET_KEY ?? "").trim();

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
    const expected = await buildRapydSignature({
      path: new URL(req.url).pathname,
      salt,
      timestamp,
      accessKey: expectedAccessKey,
      secretKey: webhookSecret,
      body: bodyText,
    });
    signatureValid =
      accessKeyHeader === expectedAccessKey && safeEqual(expected, signature);
  }

  if (isPayoutEvent || providerPayoutId) {
    await ctx.runMutation(
      internal.payouts.processRapydPayoutWebhookEvent,
      {
        providerEventId,
        signatureValid,
        payloadHash,
        payload: parsedPayload,
        ...omitUndefined({
          eventType,
          providerPayoutId,
          payoutId: payoutRefFromPayload as Id<"payouts"> | undefined,
          statusRaw,
        }),
      },
    );
  } else {
    await ctx.runMutation(
      internal.payments.processRapydWebhookEvent,
      {
        providerEventId,
        signatureValid,
        payloadHash,
        payload: parsedPayload,
        ...omitUndefined({
          eventType,
          providerPaymentId,
          providerCheckoutId,
          statusRaw,
        }),
      },
    );
  }

  return new Response(
    JSON.stringify({ received: true, signatureValid, timestampValid }),
    {
      status: signatureValid ? 200 : 401,
      headers: { "Content-Type": "application/json" },
    },
  );
});
